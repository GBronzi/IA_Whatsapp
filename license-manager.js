/**
 * license-manager.js - Módulo para gestionar licencias y autenticación
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const logger = require('./logger');

// Configuración
const LICENSE_FILE = path.join(__dirname, 'license.json');
const LICENSE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'https://api.tuempresa.com/license';
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'your-secret-key';

// Estado de la licencia
let licenseStatus = {
    isValid: false,
    expiresAt: null,
    licenseKey: null,
    clientId: null,
    clientName: null,
    features: [],
    lastChecked: null,
    checkInterval: LICENSE_CHECK_INTERVAL,
    offlineMode: false
};

/**
 * Inicializa el gestor de licencias
 * @returns {Promise<Object>} - Estado de la licencia
 */
async function initialize() {
    try {
        // Cargar licencia desde archivo
        await loadLicense();
        
        // Verificar licencia
        await verifyLicense();
        
        // Configurar verificación periódica
        setInterval(verifyLicense, licenseStatus.checkInterval);
        
        return licenseStatus;
    } catch (error) {
        logger.error(`Error al inicializar gestor de licencias: ${error.message}`);
        return licenseStatus;
    }
}

/**
 * Carga la licencia desde el archivo
 * @returns {Promise<void>}
 */
async function loadLicense() {
    try {
        // Verificar si existe el archivo de licencia
        try {
            await fs.access(LICENSE_FILE);
        } catch (error) {
            // Si no existe, crear uno con valores por defecto
            await saveLicense();
            return;
        }
        
        // Leer archivo de licencia
        const data = await fs.readFile(LICENSE_FILE, 'utf8');
        const license = JSON.parse(data);
        
        // Actualizar estado de licencia
        licenseStatus = {
            ...licenseStatus,
            ...license
        };
        
        logger.info('Licencia cargada correctamente');
    } catch (error) {
        logger.error(`Error al cargar licencia: ${error.message}`);
        throw error;
    }
}

/**
 * Guarda la licencia en el archivo
 * @returns {Promise<void>}
 */
async function saveLicense() {
    try {
        await fs.writeFile(LICENSE_FILE, JSON.stringify(licenseStatus, null, 2));
        logger.info('Licencia guardada correctamente');
    } catch (error) {
        logger.error(`Error al guardar licencia: ${error.message}`);
        throw error;
    }
}

/**
 * Verifica la validez de la licencia
 * @param {boolean} forceOnline - Forzar verificación online
 * @returns {Promise<boolean>} - true si la licencia es válida
 */
async function verifyLicense(forceOnline = false) {
    try {
        // Actualizar timestamp de última verificación
        licenseStatus.lastChecked = Date.now();
        
        // Si no hay licencia, no es válida
        if (!licenseStatus.licenseKey) {
            licenseStatus.isValid = false;
            await saveLicense();
            return false;
        }
        
        // Verificar fecha de expiración
        if (licenseStatus.expiresAt) {
            const expiresAt = new Date(licenseStatus.expiresAt).getTime();
            if (expiresAt < Date.now()) {
                logger.warn('Licencia expirada');
                licenseStatus.isValid = false;
                await saveLicense();
                return false;
            }
        }
        
        // Si estamos en modo offline y no se fuerza verificación online, usar estado actual
        if (licenseStatus.offlineMode && !forceOnline) {
            return licenseStatus.isValid;
        }
        
        // Verificar online
        try {
            const response = await axios.post(LICENSE_SERVER_URL + '/verify', {
                licenseKey: licenseStatus.licenseKey,
                clientId: licenseStatus.clientId,
                timestamp: Date.now(),
                signature: generateSignature(licenseStatus.licenseKey, licenseStatus.clientId)
            }, {
                timeout: 10000 // 10 segundos
            });
            
            // Actualizar estado de licencia
            if (response.data && response.data.success) {
                licenseStatus.isValid = response.data.isValid;
                licenseStatus.expiresAt = response.data.expiresAt || licenseStatus.expiresAt;
                licenseStatus.features = response.data.features || licenseStatus.features;
                licenseStatus.checkInterval = response.data.checkInterval || LICENSE_CHECK_INTERVAL;
                licenseStatus.offlineMode = false;
                
                logger.info(`Licencia verificada online: ${licenseStatus.isValid ? 'Válida' : 'Inválida'}`);
            } else {
                logger.warn('Respuesta inválida del servidor de licencias');
                // Si la respuesta es inválida, mantener el estado actual
            }
        } catch (error) {
            logger.warn(`Error al verificar licencia online: ${error.message}`);
            // Si hay error de conexión, usar modo offline
            licenseStatus.offlineMode = true;
        }
        
        // Guardar estado actualizado
        await saveLicense();
        
        return licenseStatus.isValid;
    } catch (error) {
        logger.error(`Error al verificar licencia: ${error.message}`);
        return false;
    }
}

/**
 * Activa una licencia con un código de activación
 * @param {string} activationCode - Código de activación
 * @returns {Promise<Object>} - Resultado de la activación
 */
async function activateLicense(activationCode) {
    try {
        // Validar código de activación
        if (!activationCode || typeof activationCode !== 'string' || activationCode.length < 8) {
            return {
                success: false,
                message: 'Código de activación inválido'
            };
        }
        
        // Intentar activar online
        try {
            const response = await axios.post(LICENSE_SERVER_URL + '/activate', {
                activationCode,
                machineId: getMachineId(),
                timestamp: Date.now()
            }, {
                timeout: 15000 // 15 segundos
            });
            
            if (response.data && response.data.success) {
                // Actualizar estado de licencia
                licenseStatus.isValid = true;
                licenseStatus.licenseKey = response.data.licenseKey;
                licenseStatus.clientId = response.data.clientId;
                licenseStatus.clientName = response.data.clientName;
                licenseStatus.expiresAt = response.data.expiresAt;
                licenseStatus.features = response.data.features || [];
                licenseStatus.offlineMode = false;
                
                // Guardar licencia
                await saveLicense();
                
                logger.info(`Licencia activada correctamente para ${licenseStatus.clientName}`);
                
                return {
                    success: true,
                    message: 'Licencia activada correctamente',
                    licenseInfo: {
                        clientName: licenseStatus.clientName,
                        expiresAt: licenseStatus.expiresAt,
                        features: licenseStatus.features
                    }
                };
            } else {
                logger.warn(`Error al activar licencia: ${response.data.message || 'Respuesta inválida'}`);
                
                return {
                    success: false,
                    message: response.data.message || 'Error al activar licencia'
                };
            }
        } catch (error) {
            logger.error(`Error al activar licencia online: ${error.message}`);
            
            // Intentar activación offline
            if (isValidOfflineActivationCode(activationCode)) {
                // Extraer información del código offline
                const decodedInfo = decodeOfflineActivationCode(activationCode);
                
                // Actualizar estado de licencia
                licenseStatus.isValid = true;
                licenseStatus.licenseKey = decodedInfo.licenseKey;
                licenseStatus.clientId = decodedInfo.clientId;
                licenseStatus.clientName = decodedInfo.clientName || 'Usuario Offline';
                licenseStatus.expiresAt = decodedInfo.expiresAt;
                licenseStatus.features = decodedInfo.features || [];
                licenseStatus.offlineMode = true;
                
                // Guardar licencia
                await saveLicense();
                
                logger.info(`Licencia activada en modo offline para ${licenseStatus.clientName}`);
                
                return {
                    success: true,
                    message: 'Licencia activada en modo offline',
                    licenseInfo: {
                        clientName: licenseStatus.clientName,
                        expiresAt: licenseStatus.expiresAt,
                        features: licenseStatus.features,
                        offlineMode: true
                    }
                };
            }
            
            return {
                success: false,
                message: 'Error de conexión al servidor de licencias'
            };
        }
    } catch (error) {
        logger.error(`Error al activar licencia: ${error.message}`);
        
        return {
            success: false,
            message: `Error al activar licencia: ${error.message}`
        };
    }
}

/**
 * Desactiva la licencia actual
 * @returns {Promise<Object>} - Resultado de la desactivación
 */
async function deactivateLicense() {
    try {
        // Si no hay licencia, no hay nada que desactivar
        if (!licenseStatus.licenseKey) {
            return {
                success: false,
                message: 'No hay licencia activa'
            };
        }
        
        // Intentar desactivar online
        if (!licenseStatus.offlineMode) {
            try {
                const response = await axios.post(LICENSE_SERVER_URL + '/deactivate', {
                    licenseKey: licenseStatus.licenseKey,
                    clientId: licenseStatus.clientId,
                    timestamp: Date.now(),
                    signature: generateSignature(licenseStatus.licenseKey, licenseStatus.clientId)
                }, {
                    timeout: 10000 // 10 segundos
                });
                
                if (!response.data || !response.data.success) {
                    logger.warn(`Error al desactivar licencia online: ${response.data.message || 'Respuesta inválida'}`);
                }
            } catch (error) {
                logger.warn(`Error al desactivar licencia online: ${error.message}`);
            }
        }
        
        // Resetear estado de licencia
        licenseStatus = {
            isValid: false,
            expiresAt: null,
            licenseKey: null,
            clientId: null,
            clientName: null,
            features: [],
            lastChecked: Date.now(),
            checkInterval: LICENSE_CHECK_INTERVAL,
            offlineMode: false
        };
        
        // Guardar licencia
        await saveLicense();
        
        logger.info('Licencia desactivada correctamente');
        
        return {
            success: true,
            message: 'Licencia desactivada correctamente'
        };
    } catch (error) {
        logger.error(`Error al desactivar licencia: ${error.message}`);
        
        return {
            success: false,
            message: `Error al desactivar licencia: ${error.message}`
        };
    }
}

/**
 * Verifica si un código de activación offline es válido
 * @param {string} code - Código de activación
 * @returns {boolean} - true si el código es válido
 */
function isValidOfflineActivationCode(code) {
    try {
        // Verificar formato básico
        if (!code || typeof code !== 'string' || code.length < 20) {
            return false;
        }
        
        // Verificar si comienza con el prefijo correcto
        if (!code.startsWith('OFFLINE-')) {
            return false;
        }
        
        // Intentar decodificar
        const decodedInfo = decodeOfflineActivationCode(code);
        
        // Verificar campos requeridos
        if (!decodedInfo.licenseKey || !decodedInfo.expiresAt) {
            return false;
        }
        
        // Verificar fecha de expiración
        const expiresAt = new Date(decodedInfo.expiresAt).getTime();
        if (expiresAt < Date.now()) {
            return false;
        }
        
        return true;
    } catch (error) {
        logger.error(`Error al validar código offline: ${error.message}`);
        return false;
    }
}

/**
 * Decodifica un código de activación offline
 * @param {string} code - Código de activación
 * @returns {Object} - Información decodificada
 */
function decodeOfflineActivationCode(code) {
    try {
        // Eliminar prefijo
        const encodedData = code.replace('OFFLINE-', '');
        
        // Decodificar base64
        const decodedData = Buffer.from(encodedData, 'base64').toString('utf8');
        
        // Parsear JSON
        const data = JSON.parse(decodedData);
        
        // Verificar firma
        const { signature, ...payload } = data;
        const expectedSignature = crypto
            .createHmac('sha256', LICENSE_SECRET)
            .update(JSON.stringify(payload))
            .digest('hex');
        
        if (signature !== expectedSignature) {
            throw new Error('Firma inválida');
        }
        
        return payload;
    } catch (error) {
        logger.error(`Error al decodificar código offline: ${error.message}`);
        throw error;
    }
}

/**
 * Genera un código de activación offline
 * @param {Object} licenseInfo - Información de la licencia
 * @returns {string} - Código de activación
 */
function generateOfflineActivationCode(licenseInfo) {
    try {
        // Crear payload
        const payload = {
            licenseKey: licenseInfo.licenseKey,
            clientId: licenseInfo.clientId,
            clientName: licenseInfo.clientName,
            expiresAt: licenseInfo.expiresAt,
            features: licenseInfo.features,
            generatedAt: Date.now()
        };
        
        // Generar firma
        const signature = crypto
            .createHmac('sha256', LICENSE_SECRET)
            .update(JSON.stringify(payload))
            .digest('hex');
        
        // Añadir firma al payload
        const signedPayload = {
            ...payload,
            signature
        };
        
        // Codificar a base64
        const encodedData = Buffer.from(JSON.stringify(signedPayload)).toString('base64');
        
        // Añadir prefijo
        return `OFFLINE-${encodedData}`;
    } catch (error) {
        logger.error(`Error al generar código offline: ${error.message}`);
        throw error;
    }
}

/**
 * Genera una firma para verificación
 * @param {string} licenseKey - Clave de licencia
 * @param {string} clientId - ID del cliente
 * @returns {string} - Firma generada
 */
function generateSignature(licenseKey, clientId) {
    return crypto
        .createHmac('sha256', LICENSE_SECRET)
        .update(`${licenseKey}:${clientId}:${Date.now()}`)
        .digest('hex');
}

/**
 * Obtiene un identificador único de la máquina
 * @returns {string} - ID de la máquina
 */
function getMachineId() {
    const os = require('os');
    
    // Combinar información del sistema
    const systemInfo = [
        os.hostname(),
        os.platform(),
        os.arch(),
        os.cpus()[0].model,
        os.totalmem()
    ].join(':');
    
    // Generar hash
    return crypto
        .createHash('sha256')
        .update(systemInfo)
        .digest('hex');
}

/**
 * Verifica si una característica está disponible en la licencia
 * @param {string} feature - Nombre de la característica
 * @returns {boolean} - true si la característica está disponible
 */
function hasFeature(feature) {
    // Si la licencia no es válida, no hay características disponibles
    if (!licenseStatus.isValid) {
        return false;
    }
    
    // Si no hay lista de características, asumir que todas están disponibles
    if (!licenseStatus.features || licenseStatus.features.length === 0) {
        return true;
    }
    
    // Verificar si la característica está en la lista
    return licenseStatus.features.includes(feature);
}

/**
 * Obtiene el estado actual de la licencia
 * @returns {Object} - Estado de la licencia
 */
function getLicenseStatus() {
    return {
        ...licenseStatus,
        // No incluir la clave de licencia por seguridad
        licenseKey: licenseStatus.licenseKey ? '********' : null
    };
}

module.exports = {
    initialize,
    verifyLicense,
    activateLicense,
    deactivateLicense,
    hasFeature,
    getLicenseStatus,
    generateOfflineActivationCode
};
