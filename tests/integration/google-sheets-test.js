/**
 * Pruebas de integración con Google Sheets para el Asistente de Ventas WhatsApp
 * 
 * Este script verifica la integración con Google Sheets para el almacenamiento de datos.
 */

const assert = require('assert');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// Importar módulos a probar
let sheetsManager;
try {
    sheetsManager = require('../../sheets-manager');
} catch (error) {
    console.error(`Error al cargar gestor de Google Sheets: ${error.message}`);
}

// Configuración de prueba
const TEST_SHEET_ID = process.env.TEST_SHEET_ID || ''; // Debe configurarse en las variables de entorno
const TEST_CLIENT = {
    phone: 'test_1234567890',
    name: 'Cliente de Prueba',
    email: 'test@example.com',
    status: 'Nuevo',
    source: 'WhatsApp',
    date: new Date().toISOString().split('T')[0]
};

// Resultados de las pruebas
const results = {
    date: new Date().toISOString(),
    tests: [],
    summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
    }
};

/**
 * Ejecuta una prueba y registra el resultado
 * @param {string} name - Nombre de la prueba
 * @param {Function} testFn - Función de prueba
 */
async function runTest(name, testFn) {
    console.log(`Ejecutando prueba: ${name}`);
    
    const testResult = {
        name,
        status: 'skipped',
        duration: 0,
        error: null
    };
    
    // Verificar si se puede ejecutar la prueba
    if (!sheetsManager || !TEST_SHEET_ID) {
        console.warn(`Prueba omitida: ${name} - Gestor de Google Sheets no disponible o ID de hoja no configurado`);
        results.summary.skipped++;
        results.tests.push(testResult);
        results.summary.total++;
        return;
    }
    
    try {
        const start = performance.now();
        await testFn();
        const end = performance.now();
        
        testResult.status = 'passed';
        testResult.duration = end - start;
        
        results.summary.passed++;
        console.log(`✓ Prueba pasada: ${name} (${testResult.duration.toFixed(2)} ms)`);
    } catch (error) {
        testResult.status = 'failed';
        testResult.error = error.message;
        
        results.summary.failed++;
        console.error(`✗ Prueba fallida: ${name}`);
        console.error(`  Error: ${error.message}`);
    }
    
    results.tests.push(testResult);
    results.summary.total++;
}

/**
 * Prueba de conexión con Google Sheets
 */
async function testConnection() {
    // Verificar conexión
    const connected = await sheetsManager.verifyConnection(TEST_SHEET_ID);
    
    // Verificar resultado
    assert.strictEqual(connected, true);
}

/**
 * Prueba de guardado y recuperación de cliente
 */
async function testClientStorage() {
    // Guardar cliente
    const result = await sheetsManager.saveClient(TEST_SHEET_ID, TEST_CLIENT);
    
    // Verificar resultado
    assert.strictEqual(result.success, true);
    
    // Recuperar clientes
    const clients = await sheetsManager.getClients(TEST_SHEET_ID);
    
    // Verificar que el cliente se haya guardado correctamente
    const savedClient = clients.find(client => client.phone === TEST_CLIENT.phone);
    
    assert.ok(savedClient, 'Cliente no encontrado en la hoja');
    assert.strictEqual(savedClient.name, TEST_CLIENT.name);
    assert.strictEqual(savedClient.email, TEST_CLIENT.email);
    assert.strictEqual(savedClient.status, TEST_CLIENT.status);
    
    // Eliminar cliente de prueba
    await sheetsManager.deleteClient(TEST_SHEET_ID, TEST_CLIENT.phone);
}

/**
 * Prueba de actualización de cliente
 */
async function testClientUpdate() {
    // Guardar cliente
    await sheetsManager.saveClient(TEST_SHEET_ID, TEST_CLIENT);
    
    // Actualizar cliente
    const updatedClient = {
        ...TEST_CLIENT,
        name: 'Cliente Actualizado',
        status: 'Interesado',
        lastContact: new Date().toISOString().split('T')[0]
    };
    
    const result = await sheetsManager.updateClient(TEST_SHEET_ID, updatedClient);
    
    // Verificar resultado
    assert.strictEqual(result.success, true);
    
    // Recuperar clientes
    const clients = await sheetsManager.getClients(TEST_SHEET_ID);
    
    // Verificar que el cliente se haya actualizado correctamente
    const savedClient = clients.find(client => client.phone === TEST_CLIENT.phone);
    
    assert.ok(savedClient, 'Cliente no encontrado en la hoja');
    assert.strictEqual(savedClient.name, updatedClient.name);
    assert.strictEqual(savedClient.status, updatedClient.status);
    
    // Eliminar cliente de prueba
    await sheetsManager.deleteClient(TEST_SHEET_ID, TEST_CLIENT.phone);
}

/**
 * Prueba de guardado de interacción
 */
async function testInteractionStorage() {
    // Guardar cliente
    await sheetsManager.saveClient(TEST_SHEET_ID, TEST_CLIENT);
    
    // Guardar interacción
    const interaction = {
        phone: TEST_CLIENT.phone,
        date: new Date().toISOString(),
        message: 'Mensaje de prueba',
        response: 'Respuesta de prueba',
        status: 'Completado'
    };
    
    const result = await sheetsManager.saveInteraction(TEST_SHEET_ID, interaction);
    
    // Verificar resultado
    assert.strictEqual(result.success, true);
    
    // Recuperar interacciones
    const interactions = await sheetsManager.getInteractions(TEST_SHEET_ID, TEST_CLIENT.phone);
    
    // Verificar que la interacción se haya guardado correctamente
    assert.ok(interactions.length > 0, 'No se encontraron interacciones');
    
    const savedInteraction = interactions[interactions.length - 1];
    assert.strictEqual(savedInteraction.message, interaction.message);
    assert.strictEqual(savedInteraction.response, interaction.response);
    
    // Eliminar cliente e interacciones de prueba
    await sheetsManager.deleteClient(TEST_SHEET_ID, TEST_CLIENT.phone);
    await sheetsManager.deleteInteractions(TEST_SHEET_ID, TEST_CLIENT.phone);
}

/**
 * Prueba de rendimiento
 */
async function testPerformance() {
    // Configuración de la prueba
    const clientCount = 5;
    const interactionsPerClient = 3;
    
    // Medir tiempo de guardado de clientes
    const clientSaveStart = performance.now();
    
    const clients = [];
    for (let i = 0; i < clientCount; i++) {
        const client = {
            phone: `test_perf_${i}_${Date.now()}`,
            name: `Cliente de Prueba ${i + 1}`,
            email: `test${i + 1}@example.com`,
            status: 'Nuevo',
            source: 'WhatsApp',
            date: new Date().toISOString().split('T')[0]
        };
        
        clients.push(client);
        await sheetsManager.saveClient(TEST_SHEET_ID, client);
    }
    
    const clientSaveEnd = performance.now();
    const clientSaveTime = clientSaveEnd - clientSaveStart;
    
    // Medir tiempo de guardado de interacciones
    const interactionSaveStart = performance.now();
    
    for (const client of clients) {
        for (let i = 0; i < interactionsPerClient; i++) {
            const interaction = {
                phone: client.phone,
                date: new Date().toISOString(),
                message: `Mensaje de prueba ${i + 1}`,
                response: `Respuesta de prueba ${i + 1}`,
                status: 'Completado'
            };
            
            await sheetsManager.saveInteraction(TEST_SHEET_ID, interaction);
        }
    }
    
    const interactionSaveEnd = performance.now();
    const interactionSaveTime = interactionSaveEnd - interactionSaveStart;
    
    // Medir tiempo de recuperación de clientes
    const clientRetrieveStart = performance.now();
    const allClients = await sheetsManager.getClients(TEST_SHEET_ID);
    const clientRetrieveEnd = performance.now();
    const clientRetrieveTime = clientRetrieveEnd - clientRetrieveStart;
    
    // Calcular rendimiento
    const clientSaveAvg = clientSaveTime / clientCount;
    const interactionSaveAvg = interactionSaveTime / (clientCount * interactionsPerClient);
    
    console.log(`Rendimiento de guardado de clientes: ${clientSaveAvg.toFixed(2)} ms por cliente`);
    console.log(`Rendimiento de guardado de interacciones: ${interactionSaveAvg.toFixed(2)} ms por interacción`);
    console.log(`Rendimiento de recuperación de clientes: ${clientRetrieveTime.toFixed(2)} ms total`);
    
    // Verificar que el rendimiento sea aceptable
    assert.ok(clientSaveAvg < 1000, `Tiempo de guardado de clientes demasiado alto: ${clientSaveAvg.toFixed(2)} ms`);
    assert.ok(interactionSaveAvg < 1000, `Tiempo de guardado de interacciones demasiado alto: ${interactionSaveAvg.toFixed(2)} ms`);
    assert.ok(clientRetrieveTime < 5000, `Tiempo de recuperación de clientes demasiado alto: ${clientRetrieveTime.toFixed(2)} ms`);
    
    // Limpiar datos de prueba
    for (const client of clients) {
        await sheetsManager.deleteClient(TEST_SHEET_ID, client.phone);
        await sheetsManager.deleteInteractions(TEST_SHEET_ID, client.phone);
    }
}

/**
 * Ejecuta las pruebas de integración con Google Sheets
 */
async function runGoogleSheetsTests() {
    console.log('Iniciando pruebas de integración con Google Sheets...');
    
    // Ejecutar pruebas
    await runTest('Conexión con Google Sheets', testConnection);
    await runTest('Guardado y recuperación de cliente', testClientStorage);
    await runTest('Actualización de cliente', testClientUpdate);
    await runTest('Guardado de interacción', testInteractionStorage);
    await runTest('Rendimiento', testPerformance);
    
    // Mostrar resumen
    console.log('\nResumen de pruebas de integración con Google Sheets:');
    console.log('--------------------------------');
    console.log(`Total de pruebas: ${results.summary.total}`);
    console.log(`Pruebas pasadas: ${results.summary.passed}`);
    console.log(`Pruebas fallidas: ${results.summary.failed}`);
    console.log(`Pruebas omitidas: ${results.summary.skipped}`);
    console.log('--------------------------------');
    
    // Mostrar pruebas fallidas
    const failedTests = results.tests.filter(test => test.status === 'failed');
    if (failedTests.length > 0) {
        console.log('\nPruebas fallidas:');
        for (const test of failedTests) {
            console.log(`- ${test.name}: ${test.error}`);
        }
        console.log('--------------------------------');
    }
    
    console.log('Pruebas de integración con Google Sheets completadas.');
    
    return results.summary.failed === 0;
}

// Ejecutar pruebas
runGoogleSheetsTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error(`Error al ejecutar pruebas de integración con Google Sheets: ${error.message}`);
    process.exit(1);
});
