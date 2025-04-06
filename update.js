/**
 * update.js - Script para actualizar el proyecto a la nueva versión
 * 
 * Este script realiza las siguientes acciones:
 * 1. Hace una copia de seguridad del archivo index.js original
 * 2. Reemplaza index.js con la nueva versión
 * 3. Ejecuta la migración de datos
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Cargar logger
const logger = require('./logger');

/**
 * Función principal
 */
async function main() {
    logger.info('=== Iniciando actualización del asistente de ventas de WhatsApp ===');
    
    try {
        // 1. Verificar que existe index.js.new
        try {
            await fs.access(path.join(__dirname, 'index.js.new'));
        } catch (error) {
            logger.error('No se encontró el archivo index.js.new. No se puede continuar con la actualización.');
            process.exit(1);
        }
        
        // 2. Hacer copia de seguridad de index.js
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(__dirname, `index.js.backup.${timestamp}`);
        
        logger.info(`Creando copia de seguridad de index.js en ${backupPath}...`);
        await fs.copyFile(path.join(__dirname, 'index.js'), backupPath);
        
        // 3. Reemplazar index.js con index.js.new
        logger.info('Reemplazando index.js con la nueva versión...');
        await fs.rename(path.join(__dirname, 'index.js.new'), path.join(__dirname, 'index.js'));
        
        // 4. Ejecutar migración de datos
        logger.info('Ejecutando migración de datos...');
        
        // Crear archivo de respaldo de chatHistories si no existe
        try {
            // Verificar si el archivo de respaldo ya existe
            await fs.access(path.join(__dirname, 'chat_histories_backup.json'));
            logger.info('El archivo de respaldo de chatHistories ya existe.');
        } catch (error) {
            // Extraer chatHistories del archivo de respaldo
            logger.info('Creando archivo de respaldo de chatHistories...');
            
            try {
                // Leer el archivo de respaldo
                const backupContent = await fs.readFile(backupPath, 'utf8');
                
                // Buscar la definición de chatHistories
                const match = backupContent.match(/const\s+chatHistories\s*=\s*({[^;]*});/s);
                
                if (match && match[1]) {
                    // Intentar evaluar el objeto (con precaución)
                    try {
                        // Crear un archivo temporal con el código para evaluar
                        const tempFile = path.join(__dirname, 'temp_eval.js');
                        await fs.writeFile(tempFile, `
                            const chatHistories = ${match[1]};
                            const fs = require('fs');
                            fs.writeFileSync('chat_histories_backup.json', JSON.stringify(chatHistories, null, 2));
                        `);
                        
                        // Ejecutar el archivo temporal
                        execSync(`node ${tempFile}`);
                        
                        // Eliminar el archivo temporal
                        await fs.unlink(tempFile);
                        
                        logger.info('Archivo de respaldo de chatHistories creado correctamente.');
                    } catch (evalError) {
                        logger.error(`Error al evaluar chatHistories: ${evalError.message}`);
                        logger.warn('No se pudo crear el archivo de respaldo de chatHistories. La migración puede fallar.');
                    }
                } else {
                    logger.warn('No se encontró la definición de chatHistories en el archivo de respaldo.');
                    logger.warn('No se pudo crear el archivo de respaldo de chatHistories. La migración puede fallar.');
                }
            } catch (readError) {
                logger.error(`Error al leer el archivo de respaldo: ${readError.message}`);
                logger.warn('No se pudo crear el archivo de respaldo de chatHistories. La migración puede fallar.');
            }
        }
        
        // Ejecutar la migración
        try {
            execSync('node migrate.js', { stdio: 'inherit' });
        } catch (migrateError) {
            logger.error(`Error durante la migración: ${migrateError.message}`);
            logger.warn('La migración falló, pero la actualización continuará.');
        }
        
        logger.info('=== Actualización completada con éxito ===');
        logger.info('Puedes iniciar el asistente con el comando: npm start');
        
    } catch (error) {
        logger.error(`Error durante la actualización: ${error.message}`);
        logger.error('La actualización falló. Por favor, revisa los errores e intenta de nuevo.');
        process.exit(1);
    }
}

// Ejecutar la función principal
main().catch(error => {
    logger.error(`Error fatal: ${error.message}`);
    process.exit(1);
});
