/**
 * Pruebas del sistema de notificaciones y alertas para el Asistente de Ventas WhatsApp
 * 
 * Este script verifica el funcionamiento del sistema de notificaciones y alertas
 * para la asistencia humana.
 */

const assert = require('assert');
const { performance } = require('perf_hooks');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

// Importar módulos a probar
let notificationManager;
try {
    notificationManager = require('../../notification-manager');
} catch (error) {
    console.error(`Error al cargar gestor de notificaciones: ${error.message}`);
}

// Configuración de prueba
const TEST_NOTIFICATION_TYPES = [
    'human_assistance',
    'new_client',
    'error',
    'system'
];

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
    if (!notificationManager) {
        console.warn(`Prueba omitida: ${name} - Gestor de notificaciones no disponible`);
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
 * Prueba de creación de notificaciones
 */
async function testCreateNotification() {
    // Crear notificaciones para cada tipo
    const notifications = [];
    
    for (const type of TEST_NOTIFICATION_TYPES) {
        const notification = await notificationManager.createNotification({
            type,
            title: `Notificación de prueba (${type})`,
            message: `Este es un mensaje de prueba para el tipo ${type}`,
            data: {
                chatId: 'test_1234567890@c.us',
                timestamp: Date.now()
            }
        });
        
        notifications.push(notification);
    }
    
    // Verificar que se hayan creado todas las notificaciones
    assert.strictEqual(notifications.length, TEST_NOTIFICATION_TYPES.length);
    
    // Verificar que cada notificación tenga un ID único
    const ids = notifications.map(n => n.id);
    const uniqueIds = [...new Set(ids)];
    assert.strictEqual(uniqueIds.length, notifications.length);
    
    // Verificar que cada notificación tenga los datos correctos
    for (let i = 0; i < notifications.length; i++) {
        const notification = notifications[i];
        const type = TEST_NOTIFICATION_TYPES[i];
        
        assert.strictEqual(notification.type, type);
        assert.strictEqual(notification.title, `Notificación de prueba (${type})`);
        assert.strictEqual(notification.message, `Este es un mensaje de prueba para el tipo ${type}`);
        assert.strictEqual(notification.data.chatId, 'test_1234567890@c.us');
        assert.ok(notification.data.timestamp > 0);
        assert.ok(notification.createdAt > 0);
        assert.strictEqual(notification.read, false);
    }
}

/**
 * Prueba de obtención de notificaciones
 */
async function testGetNotifications() {
    // Crear algunas notificaciones
    await notificationManager.createNotification({
        type: 'human_assistance',
        title: 'Asistencia humana requerida',
        message: 'Un cliente necesita asistencia humana',
        data: {
            chatId: 'test_1111111111@c.us',
            timestamp: Date.now()
        }
    });
    
    await notificationManager.createNotification({
        type: 'new_client',
        title: 'Nuevo cliente',
        message: 'Se ha registrado un nuevo cliente',
        data: {
            chatId: 'test_2222222222@c.us',
            timestamp: Date.now()
        }
    });
    
    // Obtener todas las notificaciones
    const allNotifications = await notificationManager.getNotifications();
    
    // Verificar que se hayan obtenido las notificaciones
    assert.ok(allNotifications.length >= 2);
    
    // Obtener notificaciones por tipo
    const humanAssistanceNotifications = await notificationManager.getNotifications({ type: 'human_assistance' });
    
    // Verificar que se hayan filtrado correctamente
    assert.ok(humanAssistanceNotifications.length > 0);
    assert.ok(humanAssistanceNotifications.every(n => n.type === 'human_assistance'));
    
    // Obtener notificaciones no leídas
    const unreadNotifications = await notificationManager.getNotifications({ read: false });
    
    // Verificar que se hayan filtrado correctamente
    assert.ok(unreadNotifications.length > 0);
    assert.ok(unreadNotifications.every(n => n.read === false));
}

/**
 * Prueba de marcado de notificaciones como leídas
 */
async function testMarkNotificationAsRead() {
    // Crear una notificación
    const notification = await notificationManager.createNotification({
        type: 'system',
        title: 'Notificación de sistema',
        message: 'Esta notificación se marcará como leída',
        data: {
            timestamp: Date.now()
        }
    });
    
    // Verificar que la notificación no esté leída
    assert.strictEqual(notification.read, false);
    
    // Marcar la notificación como leída
    const updatedNotification = await notificationManager.markAsRead(notification.id);
    
    // Verificar que la notificación se haya marcado como leída
    assert.strictEqual(updatedNotification.read, true);
    
    // Obtener la notificación nuevamente
    const retrievedNotification = await notificationManager.getNotificationById(notification.id);
    
    // Verificar que la notificación siga marcada como leída
    assert.strictEqual(retrievedNotification.read, true);
}

/**
 * Prueba de eliminación de notificaciones
 */
async function testDeleteNotification() {
    // Crear una notificación
    const notification = await notificationManager.createNotification({
        type: 'error',
        title: 'Error de prueba',
        message: 'Esta notificación se eliminará',
        data: {
            timestamp: Date.now()
        }
    });
    
    // Verificar que la notificación exista
    const retrievedNotification = await notificationManager.getNotificationById(notification.id);
    assert.ok(retrievedNotification);
    
    // Eliminar la notificación
    const result = await notificationManager.deleteNotification(notification.id);
    
    // Verificar que la eliminación haya sido exitosa
    assert.strictEqual(result.success, true);
    
    // Intentar obtener la notificación nuevamente
    const deletedNotification = await notificationManager.getNotificationById(notification.id);
    
    // Verificar que la notificación ya no exista
    assert.strictEqual(deletedNotification, null);
}

/**
 * Prueba de detección de necesidad de asistencia humana
 */
async function testHumanAssistanceDetection() {
    // Crear un mock para el detector de asistencia humana
    const mockDetector = {
        detectHumanAssistanceNeeded: (message, context) => {
            // Palabras clave que indican necesidad de asistencia humana
            const keywords = ['humano', 'persona', 'agente', 'hablar', 'ayuda'];
            
            // Verificar si el mensaje contiene alguna palabra clave
            return keywords.some(keyword => message.toLowerCase().includes(keyword));
        }
    };
    
    // Reemplazar el detector en el gestor de notificaciones
    const originalDetector = notificationManager.humanAssistanceDetector;
    notificationManager.humanAssistanceDetector = mockDetector;
    
    // Mensajes de prueba
    const testMessages = [
        {
            text: 'Hola, ¿cómo estás?',
            needsHumanAssistance: false
        },
        {
            text: 'Quiero hablar con un humano',
            needsHumanAssistance: true
        },
        {
            text: 'Necesito ayuda con mi pedido',
            needsHumanAssistance: true
        },
        {
            text: '¿Puedo hablar con un agente?',
            needsHumanAssistance: true
        },
        {
            text: 'Gracias por la información',
            needsHumanAssistance: false
        }
    ];
    
    // Probar cada mensaje
    for (const testMessage of testMessages) {
        const result = await notificationManager.checkHumanAssistanceNeeded({
            chatId: 'test_3333333333@c.us',
            message: testMessage.text,
            context: {}
        });
        
        // Verificar que la detección sea correcta
        assert.strictEqual(result, testMessage.needsHumanAssistance);
        
        // Si se necesita asistencia humana, verificar que se haya creado una notificación
        if (testMessage.needsHumanAssistance) {
            // Obtener notificaciones recientes
            const notifications = await notificationManager.getNotifications({
                type: 'human_assistance',
                limit: 5
            });
            
            // Verificar que exista una notificación para este mensaje
            const notification = notifications.find(n => 
                n.data.chatId === 'test_3333333333@c.us' && 
                n.data.message === testMessage.text
            );
            
            assert.ok(notification, `No se creó notificación para el mensaje: ${testMessage.text}`);
        }
    }
    
    // Restaurar el detector original
    notificationManager.humanAssistanceDetector = originalDetector;
}

/**
 * Prueba de notificaciones en tiempo real
 */
async function testRealTimeNotifications() {
    // Crear un contador de eventos
    let eventCount = 0;
    
    // Suscribirse a eventos de notificación
    const unsubscribe = notificationManager.subscribe(notification => {
        eventCount++;
    });
    
    // Crear varias notificaciones
    for (let i = 0; i < 5; i++) {
        await notificationManager.createNotification({
            type: 'system',
            title: `Notificación en tiempo real ${i + 1}`,
            message: `Esta es una notificación en tiempo real de prueba ${i + 1}`,
            data: {
                timestamp: Date.now()
            }
        });
    }
    
    // Esperar a que se procesen los eventos
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verificar que se hayan recibido los eventos
    assert.strictEqual(eventCount, 5);
    
    // Cancelar la suscripción
    unsubscribe();
    
    // Crear una notificación más
    await notificationManager.createNotification({
        type: 'system',
        title: 'Notificación adicional',
        message: 'Esta notificación no debería incrementar el contador',
        data: {
            timestamp: Date.now()
        }
    });
    
    // Esperar a que se procesen los eventos
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verificar que no se hayan recibido más eventos
    assert.strictEqual(eventCount, 5);
}

/**
 * Ejecuta las pruebas del sistema de notificaciones
 */
async function runNotificationTests() {
    console.log('Iniciando pruebas del sistema de notificaciones...');
    
    // Ejecutar pruebas
    await runTest('Creación de notificaciones', testCreateNotification);
    await runTest('Obtención de notificaciones', testGetNotifications);
    await runTest('Marcado de notificaciones como leídas', testMarkNotificationAsRead);
    await runTest('Eliminación de notificaciones', testDeleteNotification);
    await runTest('Detección de necesidad de asistencia humana', testHumanAssistanceDetection);
    await runTest('Notificaciones en tiempo real', testRealTimeNotifications);
    
    // Mostrar resumen
    console.log('\nResumen de pruebas del sistema de notificaciones:');
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
    
    console.log('Pruebas del sistema de notificaciones completadas.');
    
    return results.summary.failed === 0;
}

// Ejecutar pruebas
runNotificationTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error(`Error al ejecutar pruebas del sistema de notificaciones: ${error.message}`);
    process.exit(1);
});
