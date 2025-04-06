/**
 * migrate.js - Script para migrar datos del formato antiguo (en memoria) al nuevo (base de datos)
 * 
 * Uso: node migrate.js
 */

const fs = require('fs').promises;
const path = require('path');
const config = require('./config');
const db = require('./database');
const logger = require('./logger');

// Inicializar la base de datos
db.initializeDatabase();

/**
 * Migra los datos de un archivo JSON al nuevo formato de base de datos
 */
async function migrateFromJson(filePath) {
    try {
        logger.info(`Intentando migrar datos desde ${filePath}...`);
        
        // Verificar si el archivo existe
        try {
            await fs.access(filePath);
        } catch (error) {
            logger.warn(`El archivo ${filePath} no existe. No hay datos para migrar.`);
            return { success: false, message: 'Archivo no encontrado' };
        }
        
        // Leer el archivo
        const data = await fs.readFile(filePath, 'utf8');
        const chatHistories = JSON.parse(data);
        
        if (!chatHistories || typeof chatHistories !== 'object') {
            logger.warn('El formato del archivo no es válido. Debe ser un objeto JSON.');
            return { success: false, message: 'Formato inválido' };
        }
        
        // Estadísticas de migración
        const stats = {
            chats: 0,
            messages: 0,
            clientData: 0
        };
        
        // Migrar cada chat
        for (const [chatId, chatData] of Object.entries(chatHistories)) {
            if (!chatData.history || !Array.isArray(chatData.history)) {
                logger.warn(`Chat ${chatId} no tiene un historial válido. Omitiendo.`);
                continue;
            }
            
            stats.chats++;
            
            // Migrar mensajes
            for (const msg of chatData.history) {
                if (!msg.role || !msg.content) {
                    logger.warn(`Mensaje inválido en chat ${chatId}. Omitiendo.`);
                    continue;
                }
                
                const name = msg.role === 'user' 
                    ? (chatData.collectedData?.nombre || 'Usuario') 
                    : 'Bot';
                
                await db.saveMessage(chatId, name, msg.role, msg.content);
                stats.messages++;
            }
            
            // Migrar datos de cliente si existen
            if (chatData.collectedData && Object.keys(chatData.collectedData).length > 0) {
                await db.saveClientData(chatId, chatData.collectedData);
                stats.clientData++;
            }
        }
        
        logger.info(`Migración completada con éxito. Estadísticas:`, stats);
        return { success: true, stats };
        
    } catch (error) {
        logger.error(`Error durante la migración: ${error.message}`, { error });
        return { success: false, message: error.message };
    } finally {
        // Cerrar la base de datos
        db.closeDatabase();
    }
}

/**
 * Función principal
 */
async function main() {
    // Archivo de respaldo para guardar los datos antiguos
    const backupFile = path.join(__dirname, 'chat_histories_backup.json');
    
    // Intentar crear datos de prueba si no hay archivo de respaldo
    try {
        await fs.access(backupFile);
        logger.info(`Usando archivo de respaldo existente: ${backupFile}`);
    } catch (error) {
        // Crear datos de prueba
        logger.info('No se encontró archivo de respaldo. Creando datos de prueba...');
        
        const sampleData = {
            '1234567890@c.us': {
                history: [
                    { role: 'user', content: 'Hola, me interesa un curso de programación' },
                    { role: 'assistant', content: '¡Hola! Claro, tenemos varios cursos de programación. ¿Qué lenguaje te interesa aprender?' },
                    { role: 'user', content: 'Me gustaría aprender Python' },
                    { role: 'assistant', content: 'Excelente elección. Nuestro curso de Python dura 8 semanas y cuesta $499. ¿Te gustaría más información?' }
                ],
                lastInteraction: Date.now(),
                collectedData: {
                    nombre: 'Juan Pérez',
                    correo: 'juan@ejemplo.com',
                    telefono: '123456789',
                    curso: 'Python',
                    pago: 'Tarjeta'
                }
            },
            '0987654321@c.us': {
                history: [
                    { role: 'user', content: 'Buenos días, ¿qué cursos tienen?' },
                    { role: 'assistant', content: 'Buenos días. Ofrecemos cursos de programación, diseño y marketing. ¿En cuál estás interesado?' }
                ],
                lastInteraction: Date.now() - 3600000, // 1 hora atrás
                collectedData: {
                    nombre: 'María García'
                }
            }
        };
        
        await fs.writeFile(backupFile, JSON.stringify(sampleData, null, 2));
        logger.info(`Datos de prueba creados y guardados en ${backupFile}`);
    }
    
    // Migrar datos
    const result = await migrateFromJson(backupFile);
    
    if (result.success) {
        logger.info('Migración completada con éxito.');
        logger.info(`Chats migrados: ${result.stats.chats}`);
        logger.info(`Mensajes migrados: ${result.stats.messages}`);
        logger.info(`Datos de cliente migrados: ${result.stats.clientData}`);
    } else {
        logger.error(`Error en la migración: ${result.message}`);
    }
}

// Ejecutar la función principal
main().catch(error => {
    logger.error(`Error fatal: ${error.message}`, { error });
    process.exit(1);
});
