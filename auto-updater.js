/**
 * auto-updater.js - Módulo para gestionar actualizaciones automáticas
 */

const { app, dialog } = require('electron');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const logger = require('./logger');

// Configuración
const UPDATE_SERVER_URL = process.env.UPDATE_SERVER_URL || 'https://api.tuempresa.com/updates';
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
const UPDATE_CONFIG_PATH = path.join(app.getPath('userData'), 'update-config.json');

// Estado de actualizaciones
let updateConfig = {
    lastCheck: null,
    autoCheck: true,
    autoDownload: false,
    autoInstall: false,
    channel: 'stable',
    ignoreVersions: []
};

// Intervalo de verificación
let checkInterval;

/**
 * Inicializa el módulo de actualizaciones
 * @returns {Promise<boolean>} - true si la inicialización fue exitosa
 */
async function initialize() {
    try {
        // Cargar configuración
        await loadConfig();
        
        // Configurar verificación periódica
        if (updateConfig.autoCheck) {
            setupAutoCheck();
        }
        
        logger.info('Módulo de actualizaciones inicializado correctamente');
        return true;
    } catch (error) {
        logger.error(`Error al inicializar módulo de actualizaciones: ${error.message}`);
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
            await fs.access(UPDATE_CONFIG_PATH);
        } catch (error) {
            // Si no existe, crear uno con valores por defecto
            await saveConfig();
            return;
        }
        
        // Leer archivo de configuración
        const data = await fs.readFile(UPDATE_CONFIG_PATH, 'utf8');
        const config = JSON.parse(data);
        
        // Actualizar configuración
        updateConfig = {
            ...updateConfig,
            ...config
        };
        
        logger.info('Configuración de actualizaciones cargada correctamente');
    } catch (error) {
        logger.error(`Error al cargar configuración de actualizaciones: ${error.message}`);
    }
}

/**
 * Guarda la configuración en el archivo
 * @returns {Promise<void>}
 */
async function saveConfig() {
    try {
        await fs.writeFile(UPDATE_CONFIG_PATH, JSON.stringify(updateConfig, null, 2));
        logger.info('Configuración de actualizaciones guardada correctamente');
    } catch (error) {
        logger.error(`Error al guardar configuración de actualizaciones: ${error.message}`);
    }
}

/**
 * Configura la verificación automática de actualizaciones
 */
function setupAutoCheck() {
    // Limpiar intervalo existente
    if (checkInterval) {
        clearInterval(checkInterval);
    }
    
    // Configurar nuevo intervalo
    checkInterval = setInterval(async () => {
        await checkForUpdates();
    }, UPDATE_CHECK_INTERVAL);
    
    // Verificar al iniciar
    setTimeout(async () => {
        await checkForUpdates();
    }, 10000); // 10 segundos después de iniciar
}

/**
 * Verifica si hay actualizaciones disponibles
 * @param {boolean} silent - Si es true, no muestra diálogos
 * @returns {Promise<Object|null>} - Información de la actualización o null si no hay
 */
async function checkForUpdates(silent = true) {
    try {
        // Actualizar timestamp de última verificación
        updateConfig.lastCheck = Date.now();
        await saveConfig();
        
        // Obtener versión actual
        const currentVersion = app.getVersion();
        
        // Obtener información de actualizaciones
        const response = await axios.get(`${UPDATE_SERVER_URL}/check`, {
            params: {
                version: currentVersion,
                platform: process.platform,
                arch: process.arch,
                channel: updateConfig.channel
            },
            timeout: 10000 // 10 segundos
        });
        
        // Verificar si hay actualización disponible
        if (response.data && response.data.available) {
            const updateInfo = response.data;
            
            // Verificar si la versión está en la lista de ignoradas
            if (updateConfig.ignoreVersions.includes(updateInfo.version)) {
                logger.info(`Actualización ${updateInfo.version} ignorada por configuración`);
                return null;
            }
            
            logger.info(`Actualización disponible: ${updateInfo.version}`);
            
            // Si no es silencioso, mostrar diálogo
            if (!silent) {
                showUpdateDialog(updateInfo);
            } else if (updateConfig.autoDownload) {
                // Si es silencioso y está configurado para descargar automáticamente
                await downloadUpdate(updateInfo);
                
                // Si está configurado para instalar automáticamente
                if (updateConfig.autoInstall) {
                    await installUpdate(updateInfo);
                }
            }
            
            return updateInfo;
        } else {
            logger.info('No hay actualizaciones disponibles');
            
            // Si no es silencioso, mostrar mensaje
            if (!silent) {
                dialog.showMessageBox({
                    type: 'info',
                    title: 'No hay actualizaciones',
                    message: 'Ya tienes la última versión de la aplicación.',
                    buttons: ['Aceptar']
                });
            }
            
            return null;
        }
    } catch (error) {
        logger.error(`Error al verificar actualizaciones: ${error.message}`);
        
        // Si no es silencioso, mostrar error
        if (!silent) {
            dialog.showErrorBox(
                'Error al verificar actualizaciones',
                `No se pudo verificar si hay actualizaciones disponibles: ${error.message}`
            );
        }
        
        return null;
    }
}

/**
 * Muestra un diálogo de actualización
 * @param {Object} updateInfo - Información de la actualización
 */
function showUpdateDialog(updateInfo) {
    const dialogOptions = {
        type: 'info',
        title: 'Actualización disponible',
        message: `Hay una nueva versión disponible: ${updateInfo.version}`,
        detail: `Versión actual: ${app.getVersion()}\n\nNovedades:\n${updateInfo.notes || 'No hay notas disponibles.'}`,
        buttons: ['Descargar', 'Recordar más tarde', 'Ignorar esta versión'],
        cancelId: 1
    };
    
    dialog.showMessageBox(dialogOptions).then(({ response }) => {
        if (response === 0) {
            // Descargar
            downloadUpdate(updateInfo);
        } else if (response === 2) {
            // Ignorar esta versión
            updateConfig.ignoreVersions.push(updateInfo.version);
            saveConfig();
        }
    });
}

/**
 * Descarga una actualización
 * @param {Object} updateInfo - Información de la actualización
 * @returns {Promise<boolean>} - true si la descarga fue exitosa
 */
async function downloadUpdate(updateInfo) {
    try {
        // Mostrar diálogo de progreso
        const progressDialog = dialog.showMessageBox({
            type: 'info',
            title: 'Descargando actualización',
            message: `Descargando versión ${updateInfo.version}...`,
            detail: 'Por favor, espera mientras se descarga la actualización.',
            buttons: ['Cancelar'],
            cancelId: 0
        });
        
        // Descargar actualización
        const downloadPath = path.join(app.getPath('temp'), `update-${updateInfo.version}.exe`);
        
        // Descargar archivo
        const response = await axios({
            method: 'get',
            url: updateInfo.url,
            responseType: 'stream',
            timeout: 300000 // 5 minutos
        });
        
        // Guardar archivo
        const writer = fs.createWriteStream(downloadPath);
        response.data.pipe(writer);
        
        // Esperar a que termine la descarga
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        // Cerrar diálogo de progreso
        progressDialog.then(({ response }) => {
            if (response === 0) {
                // Cancelado
                return false;
            }
        });
        
        logger.info(`Actualización descargada: ${downloadPath}`);
        
        // Mostrar diálogo de instalación
        const installDialog = dialog.showMessageBox({
            type: 'info',
            title: 'Actualización descargada',
            message: `La versión ${updateInfo.version} ha sido descargada.`,
            detail: '¿Quieres instalarla ahora? La aplicación se cerrará durante la instalación.',
            buttons: ['Instalar ahora', 'Instalar al cerrar'],
            cancelId: 1
        });
        
        installDialog.then(({ response }) => {
            if (response === 0) {
                // Instalar ahora
                installUpdate(updateInfo, downloadPath);
            } else {
                // Instalar al cerrar
                app.once('will-quit', () => {
                    installUpdate(updateInfo, downloadPath);
                });
            }
        });
        
        return true;
    } catch (error) {
        logger.error(`Error al descargar actualización: ${error.message}`);
        
        dialog.showErrorBox(
            'Error al descargar actualización',
            `No se pudo descargar la actualización: ${error.message}`
        );
        
        return false;
    }
}

/**
 * Instala una actualización
 * @param {Object} updateInfo - Información de la actualización
 * @param {string} downloadPath - Ruta al archivo descargado
 * @returns {Promise<boolean>} - true si la instalación fue exitosa
 */
async function installUpdate(updateInfo, downloadPath) {
    try {
        // Si no se proporciona ruta, usar ruta por defecto
        if (!downloadPath) {
            downloadPath = path.join(app.getPath('temp'), `update-${updateInfo.version}.exe`);
        }
        
        // Verificar si existe el archivo
        try {
            await fs.access(downloadPath);
        } catch (error) {
            throw new Error('No se encontró el archivo de actualización');
        }
        
        // Ejecutar instalador
        const installer = spawn(downloadPath, ['/SILENT'], {
            detached: true,
            stdio: 'ignore'
        });
        
        // Desconectar del proceso padre
        installer.unref();
        
        // Cerrar la aplicación
        app.quit();
        
        return true;
    } catch (error) {
        logger.error(`Error al instalar actualización: ${error.message}`);
        
        dialog.showErrorBox(
            'Error al instalar actualización',
            `No se pudo instalar la actualización: ${error.message}`
        );
        
        return false;
    }
}

/**
 * Actualiza la configuración de actualizaciones
 * @param {Object} config - Nueva configuración
 * @returns {Promise<boolean>} - true si la configuración se actualizó correctamente
 */
async function updateSettings(config) {
    try {
        // Actualizar configuración
        const oldAutoCheck = updateConfig.autoCheck;
        
        updateConfig = {
            ...updateConfig,
            ...config
        };
        
        // Guardar configuración
        await saveConfig();
        
        // Si cambió la configuración de verificación automática
        if (oldAutoCheck !== updateConfig.autoCheck) {
            if (updateConfig.autoCheck) {
                setupAutoCheck();
            } else if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
            }
        }
        
        return true;
    } catch (error) {
        logger.error(`Error al actualizar configuración de actualizaciones: ${error.message}`);
        return false;
    }
}

/**
 * Obtiene la configuración actual de actualizaciones
 * @returns {Object} - Configuración actual
 */
function getSettings() {
    return { ...updateConfig };
}

module.exports = {
    initialize,
    checkForUpdates,
    updateSettings,
    getSettings
};
