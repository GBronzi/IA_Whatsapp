/**
 * start.js - Script de inicio para el asistente de ventas de WhatsApp
 *
 * Este script verifica que todo esté configurado correctamente antes de iniciar el asistente.
 */

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { execSync } = require('child_process');

// Cargar configuración
require('dotenv').config();
const config = require('./config');
const logger = require('./logger');

/**
 * Verifica que Ollama esté en ejecución y tenga el modelo necesario
 */
async function checkOllama() {
    try {
        logger.info('Verificando conexión con Ollama...');

        // Extraer la URL base de Ollama
        const ollamaBaseUrl = config.OLLAMA_URL.split('/api/')[0];

        // Verificar que Ollama esté en ejecución
        await axios.get(`${ollamaBaseUrl}/api/tags`, { timeout: 5000 });

        // Verificar que el modelo esté disponible
        const response = await axios.get(`${ollamaBaseUrl}/api/tags`, { timeout: 5000 });
        const models = response.data.models || [];

        const modelExists = models.some(model => model.name === config.OLLAMA_MODEL);

        if (!modelExists) {
            logger.warn(`El modelo ${config.OLLAMA_MODEL} no está disponible en Ollama.`);
            logger.info(`Modelos disponibles: ${models.map(m => m.name).join(', ')}`);

            // Preguntar si desea descargar el modelo
            console.log(`\n¿Deseas descargar el modelo ${config.OLLAMA_MODEL}? (s/n)`);
            const answer = await new Promise(resolve => {
                process.stdin.once('data', data => {
                    resolve(data.toString().trim().toLowerCase());
                });
            });

            if (answer === 's' || answer === 'si' || answer === 'y' || answer === 'yes') {
                logger.info(`Descargando modelo ${config.OLLAMA_MODEL}...`);
                console.log(`\nEsto puede tardar varios minutos dependiendo de tu conexión a internet.`);

                try {
                    await axios.post(`${ollamaBaseUrl}/api/pull`, {
                        name: config.OLLAMA_MODEL
                    }, { timeout: 600000 }); // 10 minutos de timeout

                    logger.info(`Modelo ${config.OLLAMA_MODEL} descargado correctamente.`);
                } catch (error) {
                    logger.error(`Error al descargar el modelo: ${error.message}`);
                    return false;
                }
            } else {
                logger.warn(`No se descargará el modelo. El asistente no funcionará correctamente.`);
                return false;
            }
        } else {
            logger.info(`Modelo ${config.OLLAMA_MODEL} disponible en Ollama.`);
        }

        return true;
    } catch (error) {
        logger.error(`Error al verificar Ollama: ${error.message}`);
        logger.error('Asegúrate de que Ollama esté en ejecución con el comando: ollama serve');
        return false;
    }
}

/**
 * Verifica que las credenciales de Google estén configuradas correctamente
 */
async function checkGoogleCredentials() {
    try {
        logger.info('Verificando credenciales de Google...');

        // Verificar que el archivo de credenciales existe
        try {
            await fs.access(config.CREDENTIALS_PATH);
        } catch (error) {
            logger.error(`El archivo de credenciales ${config.CREDENTIALS_PATH} no existe.`);
            return false;
        }

        // Verificar que el archivo tiene el formato correcto
        const credentials = JSON.parse(await fs.readFile(config.CREDENTIALS_PATH, 'utf8'));

        if (!credentials.type || !credentials.project_id || !credentials.private_key || !credentials.client_email) {
            logger.error('El archivo de credenciales no tiene el formato correcto.');
            return false;
        }

        logger.info('Credenciales de Google configuradas correctamente.');
        return true;
    } catch (error) {
        logger.error(`Error al verificar credenciales de Google: ${error.message}`);
        return false;
    }
}

/**
 * Verifica que la base de datos esté inicializada
 */
async function checkDatabase() {
    try {
        logger.info('Verificando base de datos...');

        // Verificar si existe el archivo de base de datos
        const fs = require('fs');
        if (!fs.existsSync(config.DB_PATH)) {
            logger.info(`La base de datos no existe. Se creará una nueva en: ${config.DB_PATH}`);
        }

        // Importar módulo de base de datos
        const db = require('./database');

        // Inicializar base de datos
        try {
            db.initializeDatabase();

            // Cerrar conexión
            db.closeDatabase();

            logger.info('Base de datos inicializada correctamente.');
            return true;
        } catch (dbError) {
            logger.error(`Error al inicializar la base de datos: ${dbError.message}`);

            // Si hay un error, intentar eliminar la base de datos y crear una nueva
            if (fs.existsSync(config.DB_PATH)) {
                logger.warn('Intentando eliminar la base de datos corrupta y crear una nueva...');
                fs.unlinkSync(config.DB_PATH);

                // Intentar inicializar de nuevo
                try {
                    db.initializeDatabase();
                    db.closeDatabase();
                    logger.info('Base de datos recreada correctamente.');
                    return true;
                } catch (recreateError) {
                    logger.error(`Error al recrear la base de datos: ${recreateError.message}`);
                    return false;
                }
            }

            return false;
        }
    } catch (error) {
        logger.error(`Error al verificar base de datos: ${error.message}`);
        return false;
    }
}

/**
 * Función principal
 */
async function main() {
    logger.info('=== Iniciando verificación del asistente de ventas de WhatsApp ===');

    // Verificar Ollama
    const ollamaOk = await checkOllama();
    if (!ollamaOk) {
        logger.error('Verificación de Ollama fallida. Corrige los errores antes de continuar.');
        process.exit(1);
    }

    // Verificar credenciales de Google
    const googleOk = await checkGoogleCredentials();
    if (!googleOk) {
        logger.error('Verificación de credenciales de Google fallida. Corrige los errores antes de continuar.');
        process.exit(1);
    }

    // Verificar base de datos
    const dbOk = await checkDatabase();
    if (!dbOk) {
        logger.error('Verificación de base de datos fallida. Corrige los errores antes de continuar.');
        process.exit(1);
    }

    logger.info('=== Verificación completada con éxito ===');
    logger.info('Iniciando asistente de ventas de WhatsApp...');

    // Iniciar el asistente
    try {
        require('./index');
    } catch (error) {
        logger.error(`Error al iniciar el asistente: ${error.message}`);
        process.exit(1);
    }
}

// Ejecutar la función principal
main().catch(error => {
    logger.error(`Error fatal: ${error.message}`);
    process.exit(1);
});
