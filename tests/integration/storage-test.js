/**
 * Pruebas de almacenamiento para el Asistente de Ventas WhatsApp
 * 
 * Este script verifica el guardado de mensajes y respuestas de la IA.
 */

const assert = require('assert');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// Importar módulos a probar
let db;
try {
    db = require('../../database');
} catch (error) {
    console.error(`Error al cargar base de datos: ${error.message}`);
}

// Configuración de prueba
const TEST_CHAT_ID = 'test_storage_1234567890@c.us';
const TEST_MESSAGES = [
    { role: 'user', content: 'Hola' },
    { role: 'assistant', content: '¡Hola! ¿En qué puedo ayudarte?' },
    { role: 'user', content: 'Quiero información sobre sus productos' },
    { role: 'assistant', content: 'Tenemos una amplia gama de productos. ¿Sobre cuál te gustaría saber más?' },
    { role: 'user', content: 'Gracias por la información' },
    { role: 'assistant', content: 'De nada. ¿Hay algo más en lo que pueda ayudarte?' }
];

// Resultados de las pruebas
const results = {
    date: new Date().toISOString(),
    tests: [],
    summary: {
        total: 0,
        passed: 0,
        failed: 0
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
        status: 'failed',
        duration: 0,
        error: null
    };
    
    try {
        const start = performance.now();
        await testFn();
        const end = performance.now();
        
        testResult.status = 'passed';
        testResult.duration = end - start;
        
        results.summary.passed++;
        console.log(`✓ Prueba pasada: ${name} (${testResult.duration.toFixed(2)} ms)`);
    } catch (error) {
        testResult.error = error.message;
        console.error(`✗ Prueba fallida: ${name}`);
        console.error(`  Error: ${error.message}`);
    }
    
    results.tests.push(testResult);
    results.summary.total++;
}

/**
 * Prueba de guardado y recuperación de mensajes
 */
async function testMessageStorage() {
    if (!db) {
        throw new Error('Módulo de base de datos no disponible');
    }
    
    // Inicializar base de datos
    await db.initializeDatabase();
    
    // Limpiar datos de prueba anteriores
    await db.deleteChatHistory(TEST_CHAT_ID);
    
    // Guardar mensajes
    for (const message of TEST_MESSAGES) {
        await db.saveMessage({
            chatId: TEST_CHAT_ID,
            role: message.role,
            content: message.content,
            timestamp: Date.now()
        });
    }
    
    // Recuperar historial de chat
    const chatHistory = await db.getChatHistory(TEST_CHAT_ID);
    
    // Verificar que se hayan guardado todos los mensajes
    assert.strictEqual(chatHistory.length, TEST_MESSAGES.length);
    
    // Verificar que los mensajes se hayan guardado correctamente
    for (let i = 0; i < TEST_MESSAGES.length; i++) {
        assert.strictEqual(chatHistory[i].role, TEST_MESSAGES[i].role);
        assert.strictEqual(chatHistory[i].content, TEST_MESSAGES[i].content);
    }
    
    // Limpiar datos de prueba
    await db.deleteChatHistory(TEST_CHAT_ID);
}

/**
 * Prueba de guardado y recuperación de información de cliente
 */
async function testClientInfoStorage() {
    if (!db) {
        throw new Error('Módulo de base de datos no disponible');
    }
    
    // Inicializar base de datos
    await db.initializeDatabase();
    
    // Datos de cliente de prueba
    const clientInfo = {
        chatId: TEST_CHAT_ID,
        name: 'Cliente de Prueba',
        phone: '1234567890',
        email: 'test@example.com',
        preferences: {
            language: 'es',
            notifications: true
        },
        lastInteraction: Date.now()
    };
    
    // Guardar información de cliente
    await db.saveClientInfo(clientInfo);
    
    // Recuperar información de cliente
    const savedClientInfo = await db.getClientInfo(TEST_CHAT_ID);
    
    // Verificar que la información se haya guardado correctamente
    assert.strictEqual(savedClientInfo.chatId, clientInfo.chatId);
    assert.strictEqual(savedClientInfo.name, clientInfo.name);
    assert.strictEqual(savedClientInfo.phone, clientInfo.phone);
    assert.strictEqual(savedClientInfo.email, clientInfo.email);
    assert.deepStrictEqual(savedClientInfo.preferences, clientInfo.preferences);
    
    // Actualizar información de cliente
    const updatedClientInfo = {
        ...clientInfo,
        name: 'Cliente Actualizado',
        preferences: {
            ...clientInfo.preferences,
            notifications: false
        }
    };
    
    await db.saveClientInfo(updatedClientInfo);
    
    // Recuperar información actualizada
    const savedUpdatedClientInfo = await db.getClientInfo(TEST_CHAT_ID);
    
    // Verificar que la información se haya actualizado correctamente
    assert.strictEqual(savedUpdatedClientInfo.name, updatedClientInfo.name);
    assert.deepStrictEqual(savedUpdatedClientInfo.preferences, updatedClientInfo.preferences);
    
    // Limpiar datos de prueba
    await db.deleteClientInfo(TEST_CHAT_ID);
}

/**
 * Prueba de recuperación de chats inactivos
 */
async function testInactiveChats() {
    if (!db) {
        throw new Error('Módulo de base de datos no disponible');
    }
    
    // Inicializar base de datos
    await db.initializeDatabase();
    
    // Crear varios chats con diferentes tiempos de inactividad
    const chatIds = [
        'test_inactive_1@c.us',
        'test_inactive_2@c.us',
        'test_inactive_3@c.us',
        'test_inactive_4@c.us',
        'test_inactive_5@c.us'
    ];
    
    // Limpiar datos de prueba anteriores
    for (const chatId of chatIds) {
        await db.deleteChatHistory(chatId);
        await db.deleteClientInfo(chatId);
    }
    
    // Crear chats con diferentes tiempos de inactividad
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    
    // Chat 1: Activo hace 30 minutos
    await db.saveMessage({
        chatId: chatIds[0],
        role: 'user',
        content: 'Mensaje reciente',
        timestamp: now - (30 * 60 * 1000)
    });
    
    // Chat 2: Inactivo hace 2 horas
    await db.saveMessage({
        chatId: chatIds[1],
        role: 'user',
        content: 'Mensaje de hace 2 horas',
        timestamp: now - (2 * oneHour)
    });
    
    // Chat 3: Inactivo hace 1 día
    await db.saveMessage({
        chatId: chatIds[2],
        role: 'user',
        content: 'Mensaje de hace 1 día',
        timestamp: now - oneDay
    });
    
    // Chat 4: Inactivo hace 2 días
    await db.saveMessage({
        chatId: chatIds[3],
        role: 'user',
        content: 'Mensaje de hace 2 días',
        timestamp: now - (2 * oneDay)
    });
    
    // Chat 5: Inactivo hace 7 días
    await db.saveMessage({
        chatId: chatIds[4],
        role: 'user',
        content: 'Mensaje de hace 7 días',
        timestamp: now - (7 * oneDay)
    });
    
    // Obtener chats inactivos por más de 1 día
    const inactiveChats = await db.getInactiveChats(oneDay);
    
    // Verificar que se hayan identificado correctamente los chats inactivos
    assert.ok(inactiveChats.includes(chatIds[2])); // 1 día
    assert.ok(inactiveChats.includes(chatIds[3])); // 2 días
    assert.ok(inactiveChats.includes(chatIds[4])); // 7 días
    
    // Verificar que no se hayan incluido los chats activos
    assert.ok(!inactiveChats.includes(chatIds[0])); // 30 minutos
    assert.ok(!inactiveChats.includes(chatIds[1])); // 2 horas
    
    // Limpiar datos de prueba
    for (const chatId of chatIds) {
        await db.deleteChatHistory(chatId);
        await db.deleteClientInfo(chatId);
    }
}

/**
 * Prueba de rendimiento de la base de datos
 */
async function testDatabasePerformance() {
    if (!db) {
        throw new Error('Módulo de base de datos no disponible');
    }
    
    // Inicializar base de datos
    await db.initializeDatabase();
    
    // Configuración de la prueba
    const chatId = 'test_performance@c.us';
    const messageCount = 100;
    
    // Limpiar datos de prueba anteriores
    await db.deleteChatHistory(chatId);
    
    // Medir tiempo de guardado
    const saveStart = performance.now();
    
    for (let i = 0; i < messageCount; i++) {
        await db.saveMessage({
            chatId,
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Mensaje de prueba ${i + 1}`,
            timestamp: Date.now() - (messageCount - i) * 1000
        });
    }
    
    const saveEnd = performance.now();
    const saveTime = saveEnd - saveStart;
    
    // Medir tiempo de recuperación
    const retrieveStart = performance.now();
    const chatHistory = await db.getChatHistory(chatId);
    const retrieveEnd = performance.now();
    const retrieveTime = retrieveEnd - retrieveStart;
    
    // Verificar que se hayan guardado todos los mensajes
    assert.strictEqual(chatHistory.length, messageCount);
    
    // Calcular rendimiento
    const saveAvg = saveTime / messageCount;
    const retrieveAvg = retrieveTime / messageCount;
    
    console.log(`Rendimiento de guardado: ${saveAvg.toFixed(2)} ms por mensaje`);
    console.log(`Rendimiento de recuperación: ${retrieveAvg.toFixed(2)} ms por mensaje`);
    
    // Verificar que el rendimiento sea aceptable
    assert.ok(saveAvg < 50, `Tiempo de guardado demasiado alto: ${saveAvg.toFixed(2)} ms`);
    assert.ok(retrieveAvg < 1, `Tiempo de recuperación demasiado alto: ${retrieveAvg.toFixed(2)} ms`);
    
    // Limpiar datos de prueba
    await db.deleteChatHistory(chatId);
}

/**
 * Ejecuta las pruebas de almacenamiento
 */
async function runStorageTests() {
    console.log('Iniciando pruebas de almacenamiento...');
    
    // Ejecutar pruebas
    await runTest('Guardado y recuperación de mensajes', testMessageStorage);
    await runTest('Guardado y recuperación de información de cliente', testClientInfoStorage);
    await runTest('Recuperación de chats inactivos', testInactiveChats);
    await runTest('Rendimiento de la base de datos', testDatabasePerformance);
    
    // Mostrar resumen
    console.log('\nResumen de pruebas de almacenamiento:');
    console.log('--------------------------------');
    console.log(`Total de pruebas: ${results.summary.total}`);
    console.log(`Pruebas pasadas: ${results.summary.passed}`);
    console.log(`Pruebas fallidas: ${results.summary.total - results.summary.passed}`);
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
    
    console.log('Pruebas de almacenamiento completadas.');
    
    return results.summary.total === results.summary.passed;
}

// Ejecutar pruebas
runStorageTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error(`Error al ejecutar pruebas de almacenamiento: ${error.message}`);
    process.exit(1);
});
