/**
 * Script de prueba para verificar el sistema de filtrado de mensajes
 */

// Cargar variables de entorno
require('dotenv').config();

// Importar módulos
const db = require('./database');
const logger = require('./logger');

// Función principal de prueba
async function runTests() {
    console.log('=== Iniciando pruebas del sistema de filtrado de mensajes ===');
    
    // Inicializar base de datos
    try {
        db.initializeDatabase();
        console.log('Base de datos inicializada correctamente');
    } catch (error) {
        console.error('Error al inicializar base de datos:', error.message);
        return;
    }
    
    // Prueba 1: Verificar si un mensaje de grupo sería procesado
    console.log('\n=== Prueba 1: Verificar filtrado de mensajes de grupo ===');
    const mensajeGrupo = {
        id: 'msg_group_1',
        from: 'grupo123@g.us',
        body: 'Mensaje de prueba en un grupo',
        timestamp: Math.floor(Date.now() / 1000)
    };
    
    const resultadoGrupo = shouldProcessMessage(mensajeGrupo);
    console.log('¿Procesar mensaje de grupo?', resultadoGrupo ? 'Sí' : 'No');
    
    // Prueba 2: Verificar si un mensaje de estado sería procesado
    console.log('\n=== Prueba 2: Verificar filtrado de mensajes de estado ===');
    const mensajeEstado = {
        id: 'msg_status_1',
        from: 'status@broadcast',
        body: 'Mensaje de prueba en un estado',
        timestamp: Math.floor(Date.now() / 1000)
    };
    
    const resultadoEstado = shouldProcessMessage(mensajeEstado);
    console.log('¿Procesar mensaje de estado?', resultadoEstado ? 'Sí' : 'No');
    
    // Prueba 3: Verificar si un mensaje antiguo sería procesado
    console.log('\n=== Prueba 3: Verificar filtrado de mensajes antiguos ===');
    const mensajeAntiguo = {
        id: 'msg_old_1',
        from: 'usuario123@c.us',
        body: 'Mensaje de prueba antiguo',
        timestamp: Math.floor((Date.now() - 120000) / 1000) // 2 minutos atrás
    };
    
    const resultadoAntiguo = shouldProcessMessage(mensajeAntiguo);
    console.log('¿Procesar mensaje antiguo?', resultadoAntiguo ? 'Sí' : 'No');
    
    // Prueba 4: Verificar si un mensaje nuevo sería procesado
    console.log('\n=== Prueba 4: Verificar procesamiento de mensajes nuevos ===');
    const mensajeNuevo = {
        id: 'msg_new_1',
        from: 'usuario123@c.us',
        body: 'Mensaje de prueba nuevo',
        timestamp: Math.floor(Date.now() / 1000)
    };
    
    const resultadoNuevo = shouldProcessMessage(mensajeNuevo);
    console.log('¿Procesar mensaje nuevo?', resultadoNuevo ? 'Sí' : 'No');
    
    // Prueba 5: Verificar si un mensaje ya procesado sería procesado de nuevo
    console.log('\n=== Prueba 5: Verificar filtrado de mensajes ya procesados ===');
    
    // Guardar mensaje como procesado
    await db.saveMessage('usuario123@c.us', 'Usuario de Prueba', 'user', 'Mensaje de prueba procesado', 'msg_processed_1', 1);
    
    const mensajeProcesado = {
        id: 'msg_processed_1',
        from: 'usuario123@c.us',
        body: 'Mensaje de prueba procesado',
        timestamp: Math.floor(Date.now() / 1000)
    };
    
    const resultadoProcesado = await isMessageAlreadyProcessed(mensajeProcesado);
    console.log('¿Mensaje ya procesado?', resultadoProcesado ? 'Sí' : 'No');
    
    console.log('\n=== Pruebas completadas ===');
    
    // Cerrar base de datos
    db.closeDatabase();
}

// Función para verificar si un mensaje debería ser procesado
function shouldProcessMessage(msg) {
    // Verificar si es un mensaje de grupo
    if (msg.from.endsWith('@g.us')) {
        console.log('Mensaje de grupo detectado, se ignorará');
        return false;
    }
    
    // Verificar si es un mensaje de estado
    if (msg.from === 'status@broadcast') {
        console.log('Mensaje de estado detectado, se ignorará');
        return false;
    }
    
    // Verificar si es un mensaje antiguo (más de 60 segundos)
    const isNewMessage = msg.timestamp * 1000 > Date.now() - 60000;
    if (!isNewMessage) {
        console.log('Mensaje antiguo detectado, se ignorará');
        return false;
    }
    
    return true;
}

// Función para verificar si un mensaje ya ha sido procesado
async function isMessageAlreadyProcessed(msg) {
    if (!msg.id) return false;
    
    const isProcessed = db.isMessageProcessed(msg.id);
    if (isProcessed) {
        console.log(`Mensaje ${msg.id} ya procesado, se ignorará`);
    }
    
    return isProcessed;
}

// Ejecutar pruebas
runTests()
    .then(() => {
        console.log('Pruebas finalizadas');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error en las pruebas:', error);
        process.exit(1);
    });
