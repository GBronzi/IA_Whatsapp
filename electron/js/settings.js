/**
 * Script para la página de configuración
 * 
 * Este script maneja la funcionalidad de la página de configuración,
 * incluyendo la gestión de licencias y actualizaciones.
 */

const { ipcRenderer } = require('electron');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Estado de la aplicación
let appSettings = {
    sheetsId: '',
    notificationSound: 'default',
    startWithWindows: false,
    minimizeToTray: true,
    autoCheckUpdates: true,
    autoDownloadUpdates: false
};

let licenseInfo = {
    status: 'inactive',
    key: '',
    expiryDate: null,
    offlineMode: false
};

let updateInfo = {
    currentVersion: '1.0.0',
    lastCheck: null,
    available: false,
    version: null,
    notes: null,
    downloaded: false,
    downloading: false,
    progress: 0
};

// Elementos DOM
const licenseStatusEl = document.getElementById('license-status');
const licenseOfflineEl = document.getElementById('license-offline');
const licenseKeyEl = document.getElementById('license-key');
const licenseExpiryEl = document.getElementById('license-expiry');
const activateLicenseBtn = document.getElementById('activate-license-btn');
const revokeLicenseBtn = document.getElementById('revoke-license-btn');

const currentVersionEl = document.getElementById('current-version');
const lastCheckEl = document.getElementById('last-check');
const updateStatusContainerEl = document.getElementById('update-status-container');
const updateStatusEl = document.getElementById('update-status');
const updateVersionContainerEl = document.getElementById('update-version-container');
const updateVersionEl = document.getElementById('update-version');
const updateNotesContainerEl = document.getElementById('update-notes-container');
const updateNotesEl = document.getElementById('update-notes');
const downloadProgressContainerEl = document.getElementById('download-progress-container');
const downloadProgressBarEl = document.getElementById('download-progress-bar');
const downloadProgressTextEl = document.getElementById('download-progress-text');
const autoCheckUpdatesEl = document.getElementById('auto-check-updates');
const autoDownloadUpdatesEl = document.getElementById('auto-download-updates');
const checkUpdatesBtn = document.getElementById('check-updates-btn');
const downloadUpdateBtn = document.getElementById('download-update-btn');
const installUpdateBtn = document.getElementById('install-update-btn');

const sheetsIdEl = document.getElementById('sheets-id');
const notificationSoundEl = document.getElementById('notification-sound');
const startWithWindowsEl = document.getElementById('start-with-windows');
const minimizeToTrayEl = document.getElementById('minimize-to-tray');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const resetSettingsBtn = document.getElementById('reset-settings-btn');

const whatsappStatusEl = document.getElementById('whatsapp-status');
const sheetsStatusEl = document.getElementById('sheets-status');
const memoryUsageEl = document.getElementById('memory-usage');
const viewLogsBtn = document.getElementById('view-logs-btn');
const runDiagnosticsBtn = document.getElementById('run-diagnostics-btn');

const userNameEl = document.getElementById('user-name');
const userStatusEl = document.getElementById('user-status');
const logoutBtn = document.getElementById('logout-btn');

// Modales
const licenseModal = document.getElementById('license-modal');
const licenseKeyInput = document.getElementById('license-key-input');
const licenseModalError = document.getElementById('license-modal-error');
const licenseModalSuccess = document.getElementById('license-modal-success');
const confirmLicenseBtn = document.getElementById('confirm-license-btn');
const cancelLicenseBtn = document.getElementById('cancel-license-btn');

const recoveryModal = document.getElementById('recovery-modal');
const recoveryUsernameInput = document.getElementById('recovery-username');
const recoveryModalError = document.getElementById('recovery-modal-error');
const recoveryModalSuccess = document.getElementById('recovery-modal-success');
const confirmRecoveryBtn = document.getElementById('confirm-recovery-btn');
const cancelRecoveryBtn = document.getElementById('cancel-recovery-btn');

const logsModal = document.getElementById('logs-modal');
const logsContentEl = document.getElementById('logs-content');
const refreshLogsBtn = document.getElementById('refresh-logs-btn');
const exportLogsBtn = document.getElementById('export-logs-btn');
const closeLogsBtn = document.getElementById('close-logs-btn');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Cargar configuración
    loadSettings();
    
    // Verificar estado de licencia
    checkLicenseStatus();
    
    // Verificar actualizaciones
    checkUpdateStatus();
    
    // Verificar estado de diagnóstico
    checkDiagnosticStatus();
    
    // Configurar eventos
    setupEvents();
});

/**
 * Carga la configuración de la aplicación
 */
function loadSettings() {
    // Solicitar configuración al proceso principal
    ipcRenderer.send('get-settings');
    
    // Recibir configuración
    ipcRenderer.once('settings', (event, settings) => {
        appSettings = { ...appSettings, ...settings };
        
        // Actualizar interfaz
        updateSettingsUI();
    });
    
    // Solicitar información de usuario
    ipcRenderer.send('get-user-info');
    
    // Recibir información de usuario
    ipcRenderer.once('user-info', (event, userInfo) => {
        userNameEl.textContent = userInfo.name || 'Usuario';
        userStatusEl.textContent = userInfo.status || 'Conectado';
    });
    
    // Solicitar versión de la aplicación
    ipcRenderer.send('get-app-version');
    
    // Recibir versión de la aplicación
    ipcRenderer.once('app-version', (event, version) => {
        updateInfo.currentVersion = version;
        currentVersionEl.textContent = version;
    });
}

/**
 * Actualiza la interfaz con la configuración cargada
 */
function updateSettingsUI() {
    sheetsIdEl.value = appSettings.sheetsId || '';
    notificationSoundEl.value = appSettings.notificationSound || 'default';
    startWithWindowsEl.checked = appSettings.startWithWindows || false;
    minimizeToTrayEl.checked = appSettings.minimizeToTray || true;
    autoCheckUpdatesEl.checked = appSettings.autoCheckUpdates || true;
    autoDownloadUpdatesEl.checked = appSettings.autoDownloadUpdates || false;
}

/**
 * Verifica el estado de la licencia
 */
function checkLicenseStatus() {
    // Solicitar estado de licencia al proceso principal
    ipcRenderer.send('check-auth-status');
    
    // Recibir estado de licencia
    ipcRenderer.once('auth-status', (event, status) => {
        licenseInfo = {
            status: status.license.status || 'inactive',
            key: status.license.key || '',
            expiryDate: status.license.expiry || null,
            offlineMode: status.offlineMode || false
        };
        
        // Actualizar interfaz
        updateLicenseUI();
    });
}

/**
 * Actualiza la interfaz con la información de licencia
 */
function updateLicenseUI() {
    // Actualizar estado de licencia
    let statusClass = 'status-danger';
    let statusText = 'Inactiva';
    
    switch (licenseInfo.status) {
        case 'active':
            statusClass = 'status-success';
            statusText = 'Activa';
            break;
        case 'expired':
            statusClass = 'status-warning';
            statusText = 'Expirada';
            break;
        case 'revoked':
            statusClass = 'status-danger';
            statusText = 'Revocada';
            break;
    }
    
    licenseStatusEl.className = `status-badge ${statusClass}`;
    licenseStatusEl.textContent = statusText;
    
    // Mostrar/ocultar indicador de modo offline
    if (licenseInfo.offlineMode) {
        licenseOfflineEl.classList.remove('hidden');
    } else {
        licenseOfflineEl.classList.add('hidden');
    }
    
    // Actualizar clave de licencia
    if (licenseInfo.key) {
        licenseKeyEl.textContent = `${licenseInfo.key.substring(0, 10)}...`;
    } else {
        licenseKeyEl.textContent = 'No disponible';
    }
    
    // Actualizar fecha de expiración
    if (licenseInfo.expiryDate) {
        if (licenseInfo.expiryDate === 'permanent') {
            licenseExpiryEl.textContent = 'Licencia permanente';
        } else {
            const expiryDate = new Date(licenseInfo.expiryDate);
            licenseExpiryEl.textContent = expiryDate.toLocaleDateString();
        }
    } else {
        licenseExpiryEl.textContent = 'No disponible';
    }
    
    // Habilitar/deshabilitar botones
    revokeLicenseBtn.disabled = licenseInfo.status !== 'active';
}

/**
 * Verifica el estado de las actualizaciones
 */
function checkUpdateStatus() {
    // Solicitar estado de actualizaciones al proceso principal
    ipcRenderer.send('check-for-updates');
    
    // Mostrar estado de carga
    checkUpdatesBtn.disabled = true;
    checkUpdatesBtn.innerHTML = '<span class="loading"></span> Verificando...';
    
    // Recibir estado de actualizaciones
    ipcRenderer.once('update-status', (event, status) => {
        // Restaurar botón
        checkUpdatesBtn.disabled = false;
        checkUpdatesBtn.textContent = 'Verificar actualizaciones';
        
        if (status.success) {
            updateInfo = {
                ...updateInfo,
                lastCheck: new Date(),
                available: status.updateAvailable,
                version: status.status?.updateInfo?.version,
                notes: status.status?.updateInfo?.releaseNotes,
                downloaded: status.status?.updateDownloaded
            };
            
            // Actualizar interfaz
            updateUpdatesUI();
        } else {
            console.error('Error al verificar actualizaciones:', status.message);
        }
    });
}

/**
 * Actualiza la interfaz con la información de actualizaciones
 */
function updateUpdatesUI() {
    // Actualizar última verificación
    if (updateInfo.lastCheck) {
        lastCheckEl.textContent = updateInfo.lastCheck.toLocaleString();
    } else {
        lastCheckEl.textContent = 'Nunca';
    }
    
    // Mostrar/ocultar información de actualización
    if (updateInfo.available) {
        updateStatusContainerEl.classList.remove('hidden');
        updateVersionContainerEl.classList.remove('hidden');
        
        // Actualizar estado
        updateStatusEl.textContent = 'Actualización disponible';
        updateStatusEl.className = 'status-badge status-info';
        
        // Actualizar versión
        updateVersionEl.textContent = updateInfo.version || 'Desconocida';
        
        // Mostrar notas si están disponibles
        if (updateInfo.notes) {
            updateNotesContainerEl.classList.remove('hidden');
            updateNotesEl.textContent = updateInfo.notes;
        } else {
            updateNotesContainerEl.classList.add('hidden');
        }
        
        // Mostrar/ocultar botones según el estado
        if (updateInfo.downloaded) {
            downloadUpdateBtn.classList.add('hidden');
            installUpdateBtn.classList.remove('hidden');
            downloadProgressContainerEl.classList.add('hidden');
        } else {
            downloadUpdateBtn.classList.remove('hidden');
            installUpdateBtn.classList.add('hidden');
            
            // Mostrar progreso si está descargando
            if (updateInfo.downloading) {
                downloadProgressContainerEl.classList.remove('hidden');
                downloadProgressBarEl.style.width = `${updateInfo.progress}%`;
                downloadProgressTextEl.textContent = `${Math.round(updateInfo.progress)}%`;
            } else {
                downloadProgressContainerEl.classList.add('hidden');
            }
        }
    } else {
        updateStatusContainerEl.classList.add('hidden');
        updateVersionContainerEl.classList.add('hidden');
        updateNotesContainerEl.classList.add('hidden');
        downloadProgressContainerEl.classList.add('hidden');
        downloadUpdateBtn.classList.add('hidden');
        installUpdateBtn.classList.add('hidden');
    }
}

/**
 * Verifica el estado de diagnóstico
 */
function checkDiagnosticStatus() {
    // Solicitar estado de WhatsApp al proceso principal
    ipcRenderer.send('get-whatsapp-status');
    
    // Recibir estado de WhatsApp
    ipcRenderer.once('whatsapp-status', (event, status) => {
        // Actualizar estado de WhatsApp
        let statusClass = 'status-danger';
        let statusText = 'Desconectado';
        
        if (status.connected) {
            statusClass = 'status-success';
            statusText = 'Conectado';
        } else if (status.connecting) {
            statusClass = 'status-warning';
            statusText = 'Conectando...';
        }
        
        whatsappStatusEl.className = `status-badge ${statusClass}`;
        whatsappStatusEl.textContent = statusText;
    });
    
    // Solicitar estado de Google Sheets al proceso principal
    ipcRenderer.send('get-sheets-status');
    
    // Recibir estado de Google Sheets
    ipcRenderer.once('sheets-status', (event, status) => {
        // Actualizar estado de Google Sheets
        let statusClass = 'status-danger';
        let statusText = 'Desconectado';
        
        if (status.connected) {
            statusClass = 'status-success';
            statusText = 'Conectado';
        } else if (status.configured) {
            statusClass = 'status-warning';
            statusText = 'Configurado (sin conexión)';
        } else {
            statusClass = 'status-warning';
            statusText = 'No configurado';
        }
        
        sheetsStatusEl.className = `status-badge ${statusClass}`;
        sheetsStatusEl.textContent = statusText;
    });
    
    // Actualizar uso de memoria
    updateMemoryUsage();
    
    // Actualizar uso de memoria cada 10 segundos
    setInterval(updateMemoryUsage, 10000);
}

/**
 * Actualiza la información de uso de memoria
 */
function updateMemoryUsage() {
    const memoryInfo = process.memoryUsage();
    const mbUsed = Math.round(memoryInfo.rss / 1024 / 1024 * 100) / 100;
    memoryUsageEl.textContent = `${mbUsed} MB`;
}

/**
 * Configura los eventos de la interfaz
 */
function setupEvents() {
    // Evento de clic en botón de activación de licencia
    activateLicenseBtn.addEventListener('click', () => {
        // Mostrar modal de activación
        licenseModal.classList.remove('hidden');
        licenseKeyInput.value = '';
        licenseModalError.classList.add('hidden');
        licenseModalSuccess.classList.add('hidden');
        licenseKeyInput.focus();
    });
    
    // Evento de clic en botón de revocación de licencia
    revokeLicenseBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que deseas revocar esta licencia? Esta acción no se puede deshacer.')) {
            // Enviar solicitud de revocación
            ipcRenderer.send('revoke-license');
            
            // Mostrar estado de carga
            revokeLicenseBtn.disabled = true;
            revokeLicenseBtn.innerHTML = '<span class="loading"></span> Revocando...';
        }
    });
    
    // Evento de clic en botón de verificación de actualizaciones
    checkUpdatesBtn.addEventListener('click', () => {
        checkUpdateStatus();
    });
    
    // Evento de clic en botón de descarga de actualización
    downloadUpdateBtn.addEventListener('click', () => {
        // Enviar solicitud de descarga
        ipcRenderer.send('download-update');
        
        // Mostrar estado de carga
        downloadUpdateBtn.disabled = true;
        downloadUpdateBtn.innerHTML = '<span class="loading"></span> Iniciando descarga...';
        
        // Mostrar barra de progreso
        updateInfo.downloading = true;
        updateInfo.progress = 0;
        updateUpdatesUI();
    });
    
    // Evento de clic en botón de instalación de actualización
    installUpdateBtn.addEventListener('click', () => {
        if (confirm('La aplicación se cerrará para instalar la actualización. ¿Deseas continuar?')) {
            // Enviar solicitud de instalación
            ipcRenderer.send('install-update');
        }
    });
    
    // Evento de clic en botón de guardado de configuración
    saveSettingsBtn.addEventListener('click', () => {
        // Recopilar configuración
        const settings = {
            sheetsId: sheetsIdEl.value,
            notificationSound: notificationSoundEl.value,
            startWithWindows: startWithWindowsEl.checked,
            minimizeToTray: minimizeToTrayEl.checked,
            autoCheckUpdates: autoCheckUpdatesEl.checked,
            autoDownloadUpdates: autoDownloadUpdatesEl.checked
        };
        
        // Enviar configuración al proceso principal
        ipcRenderer.send('save-settings', settings);
        
        // Mostrar estado de carga
        saveSettingsBtn.disabled = true;
        saveSettingsBtn.innerHTML = '<span class="loading"></span> Guardando...';
    });
    
    // Evento de clic en botón de restablecimiento de configuración
    resetSettingsBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que deseas restablecer la configuración a los valores predeterminados?')) {
            // Enviar solicitud de restablecimiento
            ipcRenderer.send('reset-settings');
            
            // Mostrar estado de carga
            resetSettingsBtn.disabled = true;
            resetSettingsBtn.innerHTML = '<span class="loading"></span> Restableciendo...';
        }
    });
    
    // Evento de clic en botón de visualización de registros
    viewLogsBtn.addEventListener('click', () => {
        // Mostrar modal de registros
        logsModal.classList.remove('hidden');
        
        // Cargar registros
        loadLogs();
    });
    
    // Evento de clic en botón de ejecución de diagnóstico
    runDiagnosticsBtn.addEventListener('click', () => {
        // Enviar solicitud de diagnóstico
        ipcRenderer.send('run-diagnostics');
        
        // Mostrar estado de carga
        runDiagnosticsBtn.disabled = true;
        runDiagnosticsBtn.innerHTML = '<span class="loading"></span> Ejecutando...';
    });
    
    // Evento de clic en botón de cierre de sesión
    logoutBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que deseas cerrar sesión?')) {
            // Enviar solicitud de cierre de sesión
            ipcRenderer.send('logout');
        }
    });
    
    // Eventos de modal de activación de licencia
    confirmLicenseBtn.addEventListener('click', activateLicense);
    cancelLicenseBtn.addEventListener('click', () => {
        licenseModal.classList.add('hidden');
    });
    licenseKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            activateLicense();
        }
    });
    
    // Eventos de modal de recuperación de licencia
    confirmRecoveryBtn.addEventListener('click', recoverLicense);
    cancelRecoveryBtn.addEventListener('click', () => {
        recoveryModal.classList.add('hidden');
    });
    recoveryUsernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            recoverLicense();
        }
    });
    
    // Eventos de modal de registros
    refreshLogsBtn.addEventListener('click', loadLogs);
    exportLogsBtn.addEventListener('click', exportLogs);
    closeLogsBtn.addEventListener('click', () => {
        logsModal.classList.add('hidden');
    });
    
    // Cerrar modales al hacer clic en la X
    document.querySelectorAll('.close-modal').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.add('hidden');
            });
        });
    });
    
    // Cerrar modales al hacer clic fuera del contenido
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
    
    // Recibir eventos del proceso principal
    
    // Evento de resultado de activación de licencia
    ipcRenderer.on('activate-license-result', (event, result) => {
        // Restaurar botón de confirmación
        confirmLicenseBtn.disabled = false;
        confirmLicenseBtn.textContent = 'Activar';
        
        if (result.success) {
            // Mostrar mensaje de éxito
            licenseModalError.classList.add('hidden');
            licenseModalSuccess.classList.remove('hidden');
            licenseModalSuccess.textContent = result.message || 'Licencia activada correctamente';
            
            // Cerrar modal después de 2 segundos
            setTimeout(() => {
                licenseModal.classList.add('hidden');
                
                // Actualizar estado de licencia
                checkLicenseStatus();
            }, 2000);
        } else {
            // Mostrar mensaje de error
            licenseModalSuccess.classList.add('hidden');
            licenseModalError.classList.remove('hidden');
            licenseModalError.textContent = result.message || 'Error al activar licencia';
        }
    });
    
    // Evento de resultado de revocación de licencia
    ipcRenderer.on('revoke-license-result', (event, result) => {
        // Restaurar botón
        revokeLicenseBtn.disabled = false;
        revokeLicenseBtn.textContent = 'Revocar licencia';
        
        if (result.success) {
            // Actualizar estado de licencia
            checkLicenseStatus();
        } else {
            alert(result.message || 'Error al revocar licencia');
        }
    });
    
    // Evento de resultado de guardado de configuración
    ipcRenderer.on('save-settings-result', (event, result) => {
        // Restaurar botón
        saveSettingsBtn.disabled = false;
        saveSettingsBtn.textContent = 'Guardar configuración';
        
        if (result.success) {
            // Actualizar configuración
            appSettings = { ...appSettings, ...result.settings };
            updateSettingsUI();
            
            // Mostrar mensaje de éxito
            alert('Configuración guardada correctamente');
        } else {
            alert(result.message || 'Error al guardar configuración');
        }
    });
    
    // Evento de resultado de restablecimiento de configuración
    ipcRenderer.on('reset-settings-result', (event, result) => {
        // Restaurar botón
        resetSettingsBtn.disabled = false;
        resetSettingsBtn.textContent = 'Restablecer';
        
        if (result.success) {
            // Actualizar configuración
            appSettings = { ...appSettings, ...result.settings };
            updateSettingsUI();
            
            // Mostrar mensaje de éxito
            alert('Configuración restablecida correctamente');
        } else {
            alert(result.message || 'Error al restablecer configuración');
        }
    });
    
    // Evento de resultado de diagnóstico
    ipcRenderer.on('diagnostics-result', (event, result) => {
        // Restaurar botón
        runDiagnosticsBtn.disabled = false;
        runDiagnosticsBtn.textContent = 'Ejecutar diagnóstico';
        
        if (result.success) {
            // Actualizar estado de diagnóstico
            checkDiagnosticStatus();
            
            // Mostrar mensaje de éxito
            alert('Diagnóstico completado correctamente');
        } else {
            alert(result.message || 'Error al ejecutar diagnóstico');
        }
    });
    
    // Evento de progreso de descarga
    ipcRenderer.on('download-progress', (event, progress) => {
        // Actualizar progreso
        updateInfo.downloading = true;
        updateInfo.progress = progress.percent;
        
        // Actualizar interfaz
        updateUpdatesUI();
    });
    
    // Evento de actualización descargada
    ipcRenderer.on('update-downloaded', (event, info) => {
        // Restaurar botón
        downloadUpdateBtn.disabled = false;
        downloadUpdateBtn.textContent = 'Descargar actualización';
        
        // Actualizar información
        updateInfo.downloading = false;
        updateInfo.downloaded = true;
        
        // Actualizar interfaz
        updateUpdatesUI();
        
        // Mostrar mensaje
        alert(`La actualización ${info.version} ha sido descargada y está lista para instalar.`);
    });
}

/**
 * Activa una licencia
 */
function activateLicense() {
    const licenseKey = licenseKeyInput.value.trim();
    
    if (!licenseKey) {
        licenseModalError.classList.remove('hidden');
        licenseModalError.textContent = 'Por favor, ingresa una clave de licencia';
        return;
    }
    
    // Ocultar mensajes
    licenseModalError.classList.add('hidden');
    licenseModalSuccess.classList.add('hidden');
    
    // Mostrar estado de carga
    confirmLicenseBtn.disabled = true;
    confirmLicenseBtn.innerHTML = '<span class="loading"></span> Activando...';
    
    // Enviar solicitud de activación
    ipcRenderer.send('activate-license', licenseKey);
}

/**
 * Recupera una licencia
 */
function recoverLicense() {
    const username = recoveryUsernameInput.value.trim();
    
    if (!username) {
        recoveryModalError.classList.remove('hidden');
        recoveryModalError.textContent = 'Por favor, ingresa tu nombre de usuario';
        return;
    }
    
    // Ocultar mensajes
    recoveryModalError.classList.add('hidden');
    recoveryModalSuccess.classList.add('hidden');
    
    // Mostrar estado de carga
    confirmRecoveryBtn.disabled = true;
    confirmRecoveryBtn.innerHTML = '<span class="loading"></span> Recuperando...';
    
    // Enviar solicitud de recuperación
    ipcRenderer.send('recover-license', username);
}

/**
 * Carga los registros de la aplicación
 */
function loadLogs() {
    // Mostrar estado de carga
    logsContentEl.textContent = 'Cargando registros...';
    
    // Solicitar registros al proceso principal
    ipcRenderer.send('get-logs');
    
    // Recibir registros
    ipcRenderer.once('logs', (event, logs) => {
        logsContentEl.textContent = logs || 'No hay registros disponibles';
    });
}

/**
 * Exporta los registros de la aplicación
 */
function exportLogs() {
    // Solicitar exportación de registros al proceso principal
    ipcRenderer.send('export-logs');
    
    // Recibir resultado de exportación
    ipcRenderer.once('export-logs-result', (event, result) => {
        if (result.success) {
            alert(`Registros exportados correctamente a: ${result.path}`);
        } else {
            alert(result.message || 'Error al exportar registros');
        }
    });
}
