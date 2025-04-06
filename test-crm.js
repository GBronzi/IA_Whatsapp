/**
 * Script de prueba para verificar la integración con Google Sheets
 */

// Cargar variables de entorno
require('dotenv').config();

// Importar módulos
const crmManager = require('./crm-manager');
const logger = require('./logger');

// Función principal de prueba
async function runTests() {
    console.log('=== Iniciando pruebas de integración con CRM ===');
    
    // Inicializar gestor de CRM
    const crm = await crmManager.initialize({
        activeCrm: 'googleSheets',
        googleSheets: {
            docId: process.env.SPREADSHEET_ID || '',
            credentials: null,
            sheetIndex: 0
        },
        bitrix24: {
            webhook: process.env.BITRIX24_WEBHOOK || '',
            enabled: false
        }
    });
    
    // Verificar si se inicializó correctamente
    if (!crm) {
        console.error('Error: No se pudo inicializar el gestor de CRM');
        return;
    }
    
    console.log('Gestor de CRM inicializado correctamente');
    
    // Obtener estado del CRM
    const status = crmManager.getCrmStatus();
    console.log('Estado del CRM:', JSON.stringify(status, null, 2));
    
    // Prueba 1: Guardar mensaje en Google Sheets
    console.log('\n=== Prueba 1: Guardar mensaje en Google Sheets ===');
    const mensajePrueba = {
        chatId: 'test123@c.us',
        nombre: 'Cliente de Prueba',
        mensaje: 'Este es un mensaje de prueba para verificar la integración con Google Sheets',
        tipo: 'recibido',
        timestamp: new Date().toISOString()
    };
    
    try {
        const result = await crm.saveMessageToSheet(mensajePrueba);
        console.log('Resultado de guardar mensaje:', result ? 'Éxito' : 'Error');
    } catch (error) {
        console.error('Error al guardar mensaje:', error.message);
    }
    
    // Prueba 2: Guardar datos de cliente en Google Sheets
    console.log('\n=== Prueba 2: Guardar datos de cliente en Google Sheets ===');
    const clientePrueba = {
        chatId: 'test123@c.us',
        nombre: 'Juan Pérez',
        apellido: 'González',
        telefono: '123456789',
        correo: 'juan@ejemplo.com',
        curso: 'Curso de Programación',
        producto: 'Curso Premium',
        monto: '99.99',
        comentarios: 'Cliente interesado en el curso premium'
    };
    
    try {
        const result = await crm.syncClientData(clientePrueba);
        console.log('Resultado de guardar datos de cliente:', result.success ? 'Éxito' : 'Error');
    } catch (error) {
        console.error('Error al guardar datos de cliente:', error.message);
    }
    
    // Prueba 3: Obtener productos desde Google Sheets (si está implementado)
    console.log('\n=== Prueba 3: Obtener productos desde Google Sheets ===');
    try {
        if (crm.getProducts) {
            const products = await crm.getProducts();
            console.log(`Se obtuvieron ${products ? products.length : 0} productos`);
            if (products && products.length > 0) {
                console.log('Primer producto:', JSON.stringify(products[0], null, 2));
            }
        } else {
            console.log('La función getProducts no está implementada');
        }
    } catch (error) {
        console.error('Error al obtener productos:', error.message);
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
