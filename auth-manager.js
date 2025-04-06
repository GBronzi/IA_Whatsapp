/**
 * auth-manager.js - Módulo para gestionar la autenticación con Google Authenticator
 * 
 * Este módulo proporciona funciones para generar y verificar códigos OTP (One-Time Password)
 * compatibles con Google Authenticator, así como para gestionar licencias persistentes.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const logger = require('./logger');
const axios = require('axios');

// Configuración por defecto
const DEFAULT_CONFIG = {
    secretKey: '',
    appName: 'AsistenteVentasWhatsApp',
    userName: 'admin',
    licenseKey: '',
    licenseExpiry: null,
    licenseStatus: 'inactive',
    licenseCheckUrl: process.env.LICENSE_CHECK_URL || 'https://example.com/api/license-check',
    configFile: path.join(__dirname, 'auth-config.json')
};

// Estado de autenticación
let authConfig = { ...DEFAULT_CONFIG };
let isAuthenticated = false;

/**
 * Inicializa el gestor de autenticación
 * @param {Object} config - Configuración personalizada
 * @returns {Promise<Object>} - Instancia del gestor de autenticación
 */
async function initialize(config = {}) {
    try {
        // Combinar configuración por defecto con la personalizada
        authConfig = { ...DEFAULT_CONFIG, ...config };
        
        // Cargar configuración desde archivo
        await loadConfig();
        
        // Generar clave secreta si no existe
        if (!authConfig.secretKey) {
            authConfig.secretKey = generateSecretKey();
            await saveConfig();
            logger.info('Auth Manager: Clave secreta generada');
        }
        
        // Verificar licencia
        await checkLicense();
        
        return module.exports;
    } catch (error) {
        logger.error(`Auth Manager: Error al inicializar: ${error.message}`);
        return module.exports;
    }
}

/**
 * Carga la configuración desde el archivo
 * @returns {Promise<void>}
 */
async function loadConfig() {
    try {
        const data = await fs.readFile(authConfig.configFile, 'utf8');
        const loadedConfig = JSON.parse(data);
        authConfig = { ...authConfig, ...loadedConfig };
        logger.info('Auth Manager: Configuración cargada correctamente');
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.info('Auth Manager: Archivo de configuración no encontrado, se creará uno nuevo');
            await saveConfig();
        } else {
            logger.error(`Auth Manager: Error al cargar configuración: ${error.message}`);
        }
    }
}

/**
 * Guarda la configuración en el archivo
 * @returns {Promise<void>}
 */
async function saveConfig() {
    try {
        await fs.writeFile(authConfig.configFile, JSON.stringify(authConfig, null, 2), 'utf8');
        logger.info('Auth Manager: Configuración guardada correctamente');
    } catch (error) {
        logger.error(`Auth Manager: Error al guardar configuración: ${error.message}`);
    }
}

/**
 * Genera una clave secreta aleatoria
 * @returns {string} - Clave secreta
 */
function generateSecretKey() {
    return authenticator.generateSecret();
}

/**
 * Genera una URL para el código QR de Google Authenticator
 * @returns {string} - URL para el código QR
 */
function generateOtpAuthUrl() {
    return authenticator.keyuri(authConfig.userName, authConfig.appName, authConfig.secretKey);
}

/**
 * Genera un código QR como una cadena de datos (data URL)
 * @returns {Promise<string>} - Cadena de datos del código QR
 */
async function generateQRCode() {
    try {
        const otpAuthUrl = generateOtpAuthUrl();
        return await QRCode.toDataURL(otpAuthUrl);
    } catch (error) {
        logger.error(`Auth Manager: Error al generar código QR: ${error.message}`);
        throw error;
    }
}

/**
 * Verifica un código OTP
 * @param {string} token - Código OTP a verificar
 * @returns {boolean} - true si el código es válido
 */
function verifyToken(token) {
    try {
        return authenticator.verify({ token, secret: authConfig.secretKey });
    } catch (error) {
        logger.error(`Auth Manager: Error al verificar token: ${error.message}`);
        return false;
    }
}

/**
 * Autentica al usuario con un código OTP
 * @param {string} token - Código OTP
 * @returns {boolean} - true si la autenticación es exitosa
 */
function authenticate(token) {
    const isValid = verifyToken(token);
    if (isValid) {
        isAuthenticated = true;
        logger.info('Auth Manager: Autenticación exitosa');
    } else {
        logger.warn('Auth Manager: Autenticación fallida');
    }
    return isValid;
}

/**
 * Verifica si el usuario está autenticado
 * @returns {boolean} - true si el usuario está autenticado
 */
function isUserAuthenticated() {
    return isAuthenticated;
}

/**
 * Cierra la sesión del usuario
 */
function logout() {
    isAuthenticated = false;
    logger.info('Auth Manager: Sesión cerrada');
}

/**
 * Genera una clave de licencia
 * @param {number} expiryDays - Días hasta la expiración (0 para licencia permanente)
 * @returns {string} - Clave de licencia
 */
function generateLicenseKey(expiryDays = 0) {
    const data = {
        appName: authConfig.appName,
        userName: authConfig.userName,
        secretKey: authConfig.secretKey,
        timestamp: Date.now()
    };
    
    const expiryDate = expiryDays > 0 
        ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
        : 'permanent';
    
    const dataString = JSON.stringify({ ...data, expiryDate });
    const hash = crypto.createHash('sha256').update(dataString).digest('hex');
    
    return `${Buffer.from(dataString).toString('base64')}.${hash.substring(0, 8)}`;
}

/**
 * Activa una licencia
 * @param {string} licenseKey - Clave de licencia
 * @returns {Promise<boolean>} - true si la activación es exitosa
 */
async function activateLicense(licenseKey) {
    try {
        // Verificar formato de la licencia
        const parts = licenseKey.split('.');
        if (parts.length !== 2) {
            logger.error('Auth Manager: Formato de licencia inválido');
            return false;
        }
        
        // Decodificar datos de la licencia
        const dataString = Buffer.from(parts[0], 'base64').toString('utf8');
        const data = JSON.parse(dataString);
        
        // Verificar hash
        const hash = crypto.createHash('sha256').update(dataString).digest('hex');
        if (hash.substring(0, 8) !== parts[1]) {
            logger.error('Auth Manager: Hash de licencia inválido');
            return false;
        }
        
        // Verificar expiración
        if (data.expiryDate !== 'permanent') {
            const expiryDate = new Date(data.expiryDate);
            if (expiryDate < new Date()) {
                logger.error('Auth Manager: Licencia expirada');
                return false;
            }
            authConfig.licenseExpiry = data.expiryDate;
        } else {
            authConfig.licenseExpiry = null; // Licencia permanente
        }
        
        // Guardar licencia
        authConfig.licenseKey = licenseKey;
        authConfig.licenseStatus = 'active';
        await saveConfig();
        
        logger.info('Auth Manager: Licencia activada correctamente');
        return true;
    } catch (error) {
        logger.error(`Auth Manager: Error al activar licencia: ${error.message}`);
        return false;
    }
}

/**
 * Verifica el estado de la licencia
 * @returns {Promise<boolean>} - true si la licencia es válida
 */
async function checkLicense() {
    try {
        // Si no hay licencia, retornar false
        if (!authConfig.licenseKey) {
            logger.warn('Auth Manager: No hay licencia activa');
            return false;
        }
        
        // Verificar expiración local
        if (authConfig.licenseExpiry) {
            const expiryDate = new Date(authConfig.licenseExpiry);
            if (expiryDate < new Date()) {
                logger.error('Auth Manager: Licencia expirada');
                authConfig.licenseStatus = 'expired';
                await saveConfig();
                return false;
            }
        }
        
        // Verificar licencia con el servidor remoto
        try {
            const response = await axios.post(authConfig.licenseCheckUrl, {
                licenseKey: authConfig.licenseKey,
                appName: authConfig.appName,
                userName: authConfig.userName
            });
            
            if (response.data && response.data.valid) {
                // Actualizar estado de la licencia
                authConfig.licenseStatus = response.data.status || 'active';
                
                // Si el servidor envía una nueva fecha de expiración, actualizarla
                if (response.data.expiryDate) {
                    authConfig.licenseExpiry = response.data.expiryDate;
                }
                
                // Si el servidor envía una nueva clave de licencia, actualizarla
                if (response.data.newLicenseKey) {
                    authConfig.licenseKey = response.data.newLicenseKey;
                }
                
                await saveConfig();
                
                logger.info(`Auth Manager: Licencia verificada con el servidor: ${authConfig.licenseStatus}`);
                return authConfig.licenseStatus === 'active';
            } else {
                logger.error('Auth Manager: Licencia inválida según el servidor');
                authConfig.licenseStatus = 'invalid';
                await saveConfig();
                return false;
            }
        } catch (error) {
            // Si no se puede conectar con el servidor, usar la verificación local
            logger.warn(`Auth Manager: No se pudo verificar la licencia con el servidor: ${error.message}`);
            logger.info('Auth Manager: Usando verificación local de licencia');
            return authConfig.licenseStatus === 'active';
        }
    } catch (error) {
        logger.error(`Auth Manager: Error al verificar licencia: ${error.message}`);
        return false;
    }
}

/**
 * Revoca la licencia actual
 * @returns {Promise<boolean>} - true si la revocación es exitosa
 */
async function revokeLicense() {
    try {
        authConfig.licenseKey = '';
        authConfig.licenseExpiry = null;
        authConfig.licenseStatus = 'inactive';
        await saveConfig();
        
        logger.info('Auth Manager: Licencia revocada correctamente');
        return true;
    } catch (error) {
        logger.error(`Auth Manager: Error al revocar licencia: ${error.message}`);
        return false;
    }
}

/**
 * Obtiene el estado actual de la autenticación y la licencia
 * @returns {Object} - Estado de autenticación y licencia
 */
function getStatus() {
    return {
        authenticated: isAuthenticated,
        license: {
            key: authConfig.licenseKey ? `${authConfig.licenseKey.substring(0, 10)}...` : '',
            status: authConfig.licenseStatus,
            expiry: authConfig.licenseExpiry
        }
    };
}

/**
 * Actualiza la configuración de autenticación
 * @param {Object} config - Nueva configuración
 * @returns {Promise<boolean>} - true si la actualización es exitosa
 */
async function updateConfig(config) {
    try {
        // Actualizar solo los campos permitidos
        if (config.appName) authConfig.appName = config.appName;
        if (config.userName) authConfig.userName = config.userName;
        if (config.licenseCheckUrl) authConfig.licenseCheckUrl = config.licenseCheckUrl;
        
        await saveConfig();
        
        logger.info('Auth Manager: Configuración actualizada correctamente');
        return true;
    } catch (error) {
        logger.error(`Auth Manager: Error al actualizar configuración: ${error.message}`);
        return false;
    }
}

module.exports = {
    initialize,
    generateQRCode,
    authenticate,
    isUserAuthenticated,
    logout,
    generateLicenseKey,
    activateLicense,
    checkLicense,
    revokeLicense,
    getStatus,
    updateConfig
};
