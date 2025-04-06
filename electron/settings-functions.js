/**
 * Funciones para gestionar la configuración de la aplicación
 */

const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const log = require('electron-log');

/**
 * Carga la configuración de la aplicación
 * @returns {Object} - Configuración cargada
 */
function loadSettings() {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    
    // Verificar si existe el archivo de configuración
    if (fs.existsSync(settingsPath)) {
      // Leer y parsear el archivo
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      log.info('Configuración de la aplicación cargada correctamente');
      return settings;
    } else {
      log.warn('Archivo de configuración de la aplicación no encontrado, usando valores predeterminados');
      const defaultSettings = getDefaultSettings();
      saveSettings(defaultSettings);
      return defaultSettings;
    }
  } catch (error) {
    log.error(`Error al cargar configuración de la aplicación: ${error.message}`);
    return getDefaultSettings();
  }
}

/**
 * Guarda la configuración de la aplicación
 * @param {Object} settings - Configuración a guardar
 * @returns {boolean} - true si se guardó correctamente
 */
function saveSettings(settings) {
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    
    // Guardar configuración en formato JSON
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    
    log.info('Configuración de la aplicación guardada correctamente');
    return true;
  } catch (error) {
    log.error(`Error al guardar configuración de la aplicación: ${error.message}`);
    return false;
  }
}

/**
 * Obtiene la configuración predeterminada
 * @returns {Object} - Configuración predeterminada
 */
function getDefaultSettings() {
  return {
    sheetsId: '',
    notificationSound: 'default',
    startWithWindows: false,
    minimizeToTray: true,
    autoCheckUpdates: true,
    autoDownloadUpdates: false
  };
}

/**
 * Aplica la configuración
 * @param {Object} settings - Configuración a aplicar
 * @param {Object} autoUpdater - Gestor de actualizaciones
 * @param {BrowserWindow} mainWindow - Ventana principal
 * @returns {boolean} - true si se aplicó correctamente
 */
function applySettings(settings, autoUpdater, mainWindow) {
  try {
    // Aplicar configuración de inicio con Windows
    if (process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin: settings.startWithWindows
      });
    }
    
    // Aplicar configuración de actualizaciones automáticas
    if (autoUpdater) {
      autoUpdater.initialize({
        autoDownload: settings.autoDownloadUpdates,
        autoInstall: false,
        channel: 'stable',
        mainWindow
      }).catch(error => {
        log.error(`Error al aplicar configuración de actualizaciones: ${error.message}`);
      });
    }
    
    log.info('Configuración aplicada correctamente');
    return true;
  } catch (error) {
    log.error(`Error al aplicar configuración: ${error.message}`);
    return false;
  }
}

module.exports = {
  loadSettings,
  saveSettings,
  getDefaultSettings,
  applySettings
};
