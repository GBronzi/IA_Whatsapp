/**
 * backup-manager.js - Módulo para gestionar backups automáticos de la base de datos
 */

const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const archiver = require('archiver');
const extract = require('extract-zip');
const logger = require('./logger');
const { format } = require('date-fns');
const { es } = require('date-fns/locale');

// Configuración
const BACKUP_DIR = path.join(app.getPath('userData'), 'backups');
const BACKUP_CONFIG_PATH = path.join(app.getPath('userData'), 'backup-config.json');
const DB_PATH = path.join(app.getPath('userData'), 'database.sqlite');
const MAX_BACKUPS = 10; // Número máximo de backups a mantener

// Estado de backups
let backupConfig = {
    enabled: true,
    interval: 24, // Horas entre backups
    maxBackups: MAX_BACKUPS,
    lastBackup: null,
    backupOnExit: true,
    backupOnStart: true,
    compressionLevel: 9, // 0-9, donde 9 es la máxima compresión
    includeAttachments: true,
    backupPath: BACKUP_DIR
};

// Intervalo de backup
let backupInterval;

/**
 * Inicializa el módulo de backup
 * @returns {Promise<boolean>} - true si la inicialización fue exitosa
 */
async function initialize() {
    try {
        // Crear directorio de backups si no existe
        try {
            await fs.access(BACKUP_DIR);
        } catch (error) {
            await fs.mkdir(BACKUP_DIR, { recursive: true });
            logger.info(`Directorio de backups creado: ${BACKUP_DIR}`);
        }
        
        // Cargar configuración
        await loadConfig();
        
        // Configurar backup automático
        if (backupConfig.enabled) {
            setupAutoBackup();
        }
        
        // Realizar backup al iniciar si está configurado
        if (backupConfig.backupOnStart) {
            setTimeout(async () => {
                await createBackup('Backup automático al iniciar');
            }, 30000); // 30 segundos después de iniciar
        }
        
        // Configurar backup al cerrar
        if (backupConfig.backupOnExit) {
            app.on('will-quit', async (event) => {
                // Prevenir que la aplicación se cierre hasta que termine el backup
                event.preventDefault();
                
                try {
                    await createBackup('Backup automático al cerrar');
                } catch (error) {
                    logger.error(`Error al crear backup al cerrar: ${error.message}`);
                } finally {
                    // Continuar con el cierre de la aplicación
                    app.exit();
                }
            });
        }
        
        logger.info('Módulo de backup inicializado correctamente');
        return true;
    } catch (error) {
        logger.error(`Error al inicializar módulo de backup: ${error.message}`);
        return false;
    }
}

/**
 * Carga la configuración desde el archivo
 * @returns {Promise<void>}
 */
async function loadConfig() {
    try {
        // Verificar si existe el archivo de configuración
        try {
            await fs.access(BACKUP_CONFIG_PATH);
        } catch (error) {
            // Si no existe, crear uno con valores por defecto
            await saveConfig();
            return;
        }
        
        // Leer archivo de configuración
        const data = await fs.readFile(BACKUP_CONFIG_PATH, 'utf8');
        const config = JSON.parse(data);
        
        // Actualizar configuración
        backupConfig = {
            ...backupConfig,
            ...config
        };
        
        logger.info('Configuración de backup cargada correctamente');
    } catch (error) {
        logger.error(`Error al cargar configuración de backup: ${error.message}`);
    }
}

/**
 * Guarda la configuración en el archivo
 * @returns {Promise<void>}
 */
async function saveConfig() {
    try {
        await fs.writeFile(BACKUP_CONFIG_PATH, JSON.stringify(backupConfig, null, 2));
        logger.info('Configuración de backup guardada correctamente');
    } catch (error) {
        logger.error(`Error al guardar configuración de backup: ${error.message}`);
    }
}

/**
 * Configura el backup automático
 */
function setupAutoBackup() {
    // Limpiar intervalo existente
    if (backupInterval) {
        clearInterval(backupInterval);
    }
    
    // Configurar nuevo intervalo
    const intervalMs = backupConfig.interval * 60 * 60 * 1000; // Convertir horas a milisegundos
    backupInterval = setInterval(async () => {
        await createBackup('Backup automático programado');
    }, intervalMs);
    
    logger.info(`Backup automático configurado cada ${backupConfig.interval} horas`);
}

/**
 * Crea un backup de la base de datos
 * @param {string} description - Descripción del backup
 * @returns {Promise<Object>} - Información del backup creado
 */
async function createBackup(description = 'Backup manual') {
    try {
        // Verificar si existe la base de datos
        try {
            await fs.access(DB_PATH);
        } catch (error) {
            throw new Error('No se encontró la base de datos');
        }
        
        // Generar nombre de archivo
        const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
        const backupFileName = `backup_${timestamp}.zip`;
        const backupPath = path.join(backupConfig.backupPath, backupFileName);
        
        // Crear archivo de backup
        const output = fs.createWriteStream(backupPath);
        const archive = archiver('zip', {
            zlib: { level: backupConfig.compressionLevel }
        });
        
        // Manejar eventos
        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                logger.warn(`Advertencia al crear backup: ${err.message}`);
            } else {
                throw err;
            }
        });
        
        archive.on('error', (err) => {
            throw err;
        });
        
        // Pipe archive to the file
        archive.pipe(output);
        
        // Crear backup de la base de datos
        const dbBackupPath = await createDatabaseBackup();
        
        // Añadir archivo de base de datos al zip
        archive.file(dbBackupPath, { name: path.basename(dbBackupPath) });
        
        // Añadir archivos adjuntos si está configurado
        if (backupConfig.includeAttachments) {
            const mediaDir = path.join(app.getPath('userData'), 'media');
            try {
                await fs.access(mediaDir);
                archive.directory(mediaDir, 'media');
            } catch (error) {
                logger.warn(`No se encontró el directorio de medios: ${error.message}`);
            }
        }
        
        // Añadir archivo de metadatos
        const metadata = {
            timestamp: new Date().toISOString(),
            description,
            version: app.getVersion(),
            platform: process.platform,
            arch: process.arch,
            includeAttachments: backupConfig.includeAttachments
        };
        
        archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
        
        // Finalizar archivo
        await archive.finalize();
        
        // Esperar a que termine de escribir
        await new Promise((resolve, reject) => {
            output.on('close', resolve);
            output.on('error', reject);
        });
        
        // Eliminar archivo temporal de base de datos
        await fs.unlink(dbBackupPath);
        
        // Actualizar configuración
        backupConfig.lastBackup = new Date().toISOString();
        await saveConfig();
        
        // Limpiar backups antiguos
        await cleanupOldBackups();
        
        logger.info(`Backup creado correctamente: ${backupPath}`);
        
        return {
            path: backupPath,
            filename: backupFileName,
            timestamp: metadata.timestamp,
            description,
            size: (await fs.stat(backupPath)).size
        };
    } catch (error) {
        logger.error(`Error al crear backup: ${error.message}`);
        throw error;
    }
}

/**
 * Crea un backup de la base de datos
 * @returns {Promise<string>} - Ruta al archivo de backup
 */
async function createDatabaseBackup() {
    return new Promise((resolve, reject) => {
        try {
            // Crear archivo temporal
            const tempDbPath = path.join(app.getPath('temp'), `db_backup_${Date.now()}.sqlite`);
            
            // Abrir base de datos original
            const db = new sqlite3.Database(DB_PATH);
            
            // Crear backup
            const backupDb = new sqlite3.Database(tempDbPath);
            
            db.serialize(() => {
                // Backup
                db.backup(backupDb)
                    .then(() => {
                        // Cerrar bases de datos
                        db.close();
                        backupDb.close();
                        
                        resolve(tempDbPath);
                    })
                    .catch((error) => {
                        // Cerrar bases de datos
                        db.close();
                        backupDb.close();
                        
                        reject(error);
                    });
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Limpia backups antiguos
 * @returns {Promise<void>}
 */
async function cleanupOldBackups() {
    try {
        // Obtener lista de backups
        const backups = await getBackupsList();
        
        // Si hay más backups que el máximo permitido, eliminar los más antiguos
        if (backups.length > backupConfig.maxBackups) {
            // Ordenar por fecha (más antiguos primero)
            backups.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // Eliminar backups antiguos
            const backupsToDelete = backups.slice(0, backups.length - backupConfig.maxBackups);
            
            for (const backup of backupsToDelete) {
                await fs.unlink(backup.path);
                logger.info(`Backup antiguo eliminado: ${backup.filename}`);
            }
        }
    } catch (error) {
        logger.error(`Error al limpiar backups antiguos: ${error.message}`);
    }
}

/**
 * Obtiene la lista de backups disponibles
 * @returns {Promise<Array>} - Lista de backups
 */
async function getBackupsList() {
    try {
        // Obtener lista de archivos en el directorio de backups
        const files = await fs.readdir(backupConfig.backupPath);
        
        // Filtrar solo archivos zip
        const backupFiles = files.filter(file => file.endsWith('.zip'));
        
        // Obtener información de cada backup
        const backups = [];
        
        for (const file of backupFiles) {
            try {
                const filePath = path.join(backupConfig.backupPath, file);
                const stats = await fs.stat(filePath);
                
                // Extraer timestamp del nombre del archivo
                const match = file.match(/backup_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})\.zip/);
                const timestamp = match ? match[1].replace(/_/g, ' ').replace(/-/g, ':') : null;
                
                backups.push({
                    filename: file,
                    path: filePath,
                    size: stats.size,
                    timestamp: timestamp ? new Date(timestamp).toISOString() : stats.mtime.toISOString(),
                    formattedDate: format(
                        timestamp ? new Date(timestamp) : stats.mtime,
                        "d 'de' MMMM 'de' yyyy 'a las' HH:mm:ss",
                        { locale: es }
                    )
                });
            } catch (error) {
                logger.error(`Error al obtener información del backup ${file}: ${error.message}`);
            }
        }
        
        // Ordenar por fecha (más recientes primero)
        backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return backups;
    } catch (error) {
        logger.error(`Error al obtener lista de backups: ${error.message}`);
        return [];
    }
}

/**
 * Restaura un backup
 * @param {string} backupPath - Ruta al archivo de backup
 * @returns {Promise<boolean>} - true si la restauración fue exitosa
 */
async function restoreBackup(backupPath) {
    try {
        // Verificar si existe el archivo de backup
        try {
            await fs.access(backupPath);
        } catch (error) {
            throw new Error('No se encontró el archivo de backup');
        }
        
        // Crear directorio temporal para extraer el backup
        const tempDir = path.join(app.getPath('temp'), `backup_restore_${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });
        
        // Extraer backup
        await extract(backupPath, { dir: tempDir });
        
        // Buscar archivo de base de datos
        const files = await fs.readdir(tempDir);
        const dbFile = files.find(file => file.endsWith('.sqlite'));
        
        if (!dbFile) {
            throw new Error('No se encontró archivo de base de datos en el backup');
        }
        
        // Ruta al archivo de base de datos extraído
        const extractedDbPath = path.join(tempDir, dbFile);
        
        // Crear backup de la base de datos actual antes de restaurar
        await createBackup('Backup automático antes de restaurar');
        
        // Cerrar conexiones a la base de datos
        await closeAllDatabaseConnections();
        
        // Restaurar base de datos
        await fs.copyFile(extractedDbPath, DB_PATH);
        
        // Restaurar archivos adjuntos si existen
        const mediaDir = path.join(tempDir, 'media');
        try {
            await fs.access(mediaDir);
            
            // Crear directorio de medios si no existe
            const appMediaDir = path.join(app.getPath('userData'), 'media');
            try {
                await fs.access(appMediaDir);
            } catch (error) {
                await fs.mkdir(appMediaDir, { recursive: true });
            }
            
            // Copiar archivos
            const mediaFiles = await fs.readdir(mediaDir);
            for (const file of mediaFiles) {
                await fs.copyFile(
                    path.join(mediaDir, file),
                    path.join(appMediaDir, file)
                );
            }
            
            logger.info('Archivos adjuntos restaurados correctamente');
        } catch (error) {
            logger.warn(`No se encontraron archivos adjuntos en el backup: ${error.message}`);
        }
        
        // Limpiar directorio temporal
        await fs.rm(tempDir, { recursive: true, force: true });
        
        logger.info(`Backup restaurado correctamente: ${backupPath}`);
        return true;
    } catch (error) {
        logger.error(`Error al restaurar backup: ${error.message}`);
        return false;
    }
}

/**
 * Cierra todas las conexiones a la base de datos
 * @returns {Promise<void>}
 */
async function closeAllDatabaseConnections() {
    return new Promise((resolve) => {
        // Forzar recolección de basura para cerrar conexiones
        global.gc && global.gc();
        
        // Esperar un momento para asegurar que se cierren las conexiones
        setTimeout(resolve, 1000);
    });
}

/**
 * Elimina un backup
 * @param {string} backupPath - Ruta al archivo de backup
 * @returns {Promise<boolean>} - true si la eliminación fue exitosa
 */
async function deleteBackup(backupPath) {
    try {
        // Verificar si existe el archivo de backup
        try {
            await fs.access(backupPath);
        } catch (error) {
            throw new Error('No se encontró el archivo de backup');
        }
        
        // Eliminar archivo
        await fs.unlink(backupPath);
        
        logger.info(`Backup eliminado correctamente: ${backupPath}`);
        return true;
    } catch (error) {
        logger.error(`Error al eliminar backup: ${error.message}`);
        return false;
    }
}

/**
 * Actualiza la configuración de backup
 * @param {Object} config - Nueva configuración
 * @returns {Promise<boolean>} - true si la configuración se actualizó correctamente
 */
async function updateConfig(config) {
    try {
        // Actualizar configuración
        const oldEnabled = backupConfig.enabled;
        const oldInterval = backupConfig.interval;
        
        backupConfig = {
            ...backupConfig,
            ...config
        };
        
        // Guardar configuración
        await saveConfig();
        
        // Si cambió la configuración de backup automático
        if (oldEnabled !== backupConfig.enabled || oldInterval !== backupConfig.interval) {
            if (backupConfig.enabled) {
                setupAutoBackup();
            } else if (backupInterval) {
                clearInterval(backupInterval);
                backupInterval = null;
            }
        }
        
        return true;
    } catch (error) {
        logger.error(`Error al actualizar configuración de backup: ${error.message}`);
        return false;
    }
}

/**
 * Obtiene la configuración actual de backup
 * @returns {Object} - Configuración actual
 */
function getConfig() {
    return { ...backupConfig };
}

module.exports = {
    initialize,
    createBackup,
    restoreBackup,
    deleteBackup,
    getBackupsList,
    updateConfig,
    getConfig
};
