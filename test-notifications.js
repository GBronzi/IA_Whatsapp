/**
 * Script de prueba para verificar el sistema de notificaciones
 */

// Cargar variables de entorno
require('dotenv').config();

// Importar módulos
const sentimentAnalyzer = require('./sentiment-analyzer');
const logger = require('./logger');

// Función principal de prueba
async function runTests() {
    console.log('=== Iniciando pruebas del sistema de notificaciones ===');
    
    // Prueba 1: Análisis de sentimiento positivo
    console.log('\n=== Prueba 1: Análisis de sentimiento positivo ===');
    const mensajePositivo = 'Estoy muy contento con el servicio, muchas gracias por su atención.';
    
    try {
        const resultadoPositivo = await sentimentAnalyzer.analyzeSentiment(mensajePositivo);
        console.log('Resultado del análisis de sentimiento positivo:', JSON.stringify(resultadoPositivo, null, 2));
    } catch (error) {
        console.error('Error al analizar sentimiento positivo:', error.message);
    }
    
    // Prueba 2: Análisis de sentimiento negativo
    console.log('\n=== Prueba 2: Análisis de sentimiento negativo ===');
    const mensajeNegativo = 'Estoy muy molesto con el servicio, no me han respondido y necesito hablar con un supervisor urgentemente.';
    
    try {
        const resultadoNegativo = await sentimentAnalyzer.analyzeSentiment(mensajeNegativo);
        console.log('Resultado del análisis de sentimiento negativo:', JSON.stringify(resultadoNegativo, null, 2));
    } catch (error) {
        console.error('Error al analizar sentimiento negativo:', error.message);
    }
    
    // Prueba 3: Análisis de urgencia
    console.log('\n=== Prueba 3: Análisis de urgencia ===');
    const mensajeUrgente = 'Necesito ayuda urgente, es una emergencia, por favor responda lo antes posible.';
    
    try {
        const resultadoUrgente = await sentimentAnalyzer.analyzeSentiment(mensajeUrgente);
        console.log('Resultado del análisis de urgencia:', JSON.stringify(resultadoUrgente, null, 2));
    } catch (error) {
        console.error('Error al analizar urgencia:', error.message);
    }
    
    console.log('\n=== Pruebas completadas ===');
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
