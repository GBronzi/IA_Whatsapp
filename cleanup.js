/**
 * cleanup.js - Script para limpiar archivos obsoletos y no utilizados
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Elimina archivos obsoletos
 */
async function cleanupObsoleteFiles() {
    try {
        logger.info('Iniciando limpieza de archivos obsoletos...');
        
        // Eliminar archivos .old en la carpeta sessions
        const sessionsDir = path.join(__dirname, 'sessions');
        if (fs.existsSync(sessionsDir)) {
            const files = fs.readdirSync(sessionsDir);
            let oldFilesCount = 0;
            
            for (const file of files) {
                if (file.endsWith('.old')) {
                    fs.unlinkSync(path.join(sessionsDir, file));
                    oldFilesCount++;
                }
            }
            
            logger.info(`Se eliminaron ${oldFilesCount} archivos .old de la carpeta sessions`);
        }
        
        // Eliminar archivos de caché de Bitrix24
        const bitrixCacheFile = path.join(__dirname, 'bitrix24-cache.json');
        if (fs.existsSync(bitrixCacheFile)) {
            fs.unlinkSync(bitrixCacheFile);
            logger.info('Se eliminó el archivo bitrix24-cache.json');
        }
        
        logger.info('Limpieza de archivos obsoletos completada');
    } catch (error) {
        logger.error(`Error al limpiar archivos obsoletos: ${error.message}`);
    }
}

// Ejecutar limpieza
cleanupObsoleteFiles().catch(error => {
    console.error(`Error al ejecutar limpieza: ${error.message}`);
});
