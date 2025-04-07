/**
 * auth-manager.js - Módulo para gestionar la autenticación con Google Authenticator
 *
 * Este módulo proporciona funciones para generar y verificar códigos OTP (One-Time Password)
 * compatibles con Google Authenticator, así como para gestionar licencias persistentes.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { authenticator } = require('otplib');
const speakeasy = require('speakeasy');
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
    recoveryKey: '',
    backupCodes: [],
    licenseCheckUrl: process.env.LICENSE_CHECK_URL || 'https://example.com/api/license-check',
    recoveryUrl: process.env.RECOVERY_URL || 'https://example.com/api/recover-license',
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
 * Verifica un código OTP usando speakeasy (más flexible)
 * @param {string} token - Código OTP a verificar
 * @returns {boolean} - true si el código es válido
 */
function verifyTokenWithSpeakeasy(token) {
    try {
        if (!authConfig.secretKey) {
            logger.error('Auth Manager: No hay clave secreta configurada');
            return false;
        }

        // Verificar el token con una ventana de tiempo más amplia
        return speakeasy.totp.verify({
            secret: authConfig.secretKey,
            encoding: 'base32',
            token,
            window: 2 // Permite una ventana de 2 períodos (±1 minuto)
        });
    } catch (error) {
        logger.error(`Auth Manager: Error al verificar token con speakeasy: ${error.message}`);
        return false;
    }
}

/**
 * Genera un nuevo secreto para Google Authenticator usando speakeasy
 * @returns {Object} - Objeto con el secreto y la URL para el código QR
 */
function generateNewSecret() {
    try {
        // Generar un nuevo secreto
        const secret = speakeasy.generateSecret({
            name: `${authConfig.appName}:${authConfig.userName}`
        });

        // Guardar el secreto en la configuración
        authConfig.secretKey = secret.base32;

        // Generar URL para el código QR
        const otpauthUrl = secret.otpauth_url;

        return {
            secretKey: secret.base32,
            otpauthUrl
        };
    } catch (error) {
        logger.error(`Auth Manager: Error al generar nuevo secreto: ${error.message}`);
        throw error;
    }
}

/**
 * Autentica al usuario con un código OTP
 * @param {string} token - Código OTP
 * @param {boolean} useSpeakeasy - Si es true, usa speakeasy para la verificación
 * @returns {boolean} - true si la autenticación es exitosa
 */
function authenticate(token, useSpeakeasy = false) {
    // Intentar verificar con el método principal
    let isValid = useSpeakeasy ? verifyTokenWithSpeakeasy(token) : verifyToken(token);

    // Si falla y no estamos usando speakeasy, intentar con speakeasy como respaldo
    if (!isValid && !useSpeakeasy) {
        isValid = verifyTokenWithSpeakeasy(token);
    }

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
 * Genera una clave de licencia con cifrado adicional
 * @param {number} expiryDays - Días hasta la expiración (0 para licencia permanente)
 * @returns {string} - Clave de licencia
 */
function generateLicenseKey(expiryDays = 0) {
    // Generar un IV (Vector de Inicialización) aleatorio
    const iv = crypto.randomBytes(16);

    // Datos de la licencia
    const data = {
        appName: authConfig.appName,
        userName: authConfig.userName,
        secretKey: authConfig.secretKey,
        deviceId: crypto.createHash('sha256').update(os.hostname() + os.userInfo().username).digest('hex'),
        timestamp: Date.now()
    };

    // Establecer fecha de expiración
    const expiryDate = expiryDays > 0
        ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
        : 'permanent';

    // Crear cadena de datos con fecha de expiración
    const dataString = JSON.stringify({ ...data, expiryDate });

    // Crear clave de cifrado a partir de la clave secreta
    const key = crypto.createHash('sha256').update(authConfig.secretKey).digest();

    // Cifrar los datos
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(dataString, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Crear hash de verificación
    const hash = crypto.createHmac('sha256', authConfig.secretKey)
        .update(encrypted + iv.toString('base64'))
        .digest('hex');

    // Combinar IV, datos cifrados y hash en la clave de licencia
    return `${iv.toString('base64')}.${encrypted}.${hash.substring(0, 16)}`;
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

        // Manejar formato antiguo (base64.hash)
        if (parts.length === 2) {
            try {
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

                logger.info('Auth Manager: Licencia activada correctamente (formato antiguo)');
                return true;
            } catch (error) {
                logger.error(`Auth Manager: Error al procesar licencia en formato antiguo: ${error.message}`);
                return false;
            }
        }

        // Manejar formato nuevo (iv.encrypted.hash)
        if (parts.length === 3) {
            try {
                // Extraer partes de la licencia
                const iv = Buffer.from(parts[0], 'base64');
                const encrypted = parts[1];
                const hash = parts[2];

                // Verificar hash
                const calculatedHash = crypto.createHmac('sha256', authConfig.secretKey)
                    .update(encrypted + parts[0])
                    .digest('hex');

                if (calculatedHash.substring(0, 16) !== hash) {
                    logger.error('Auth Manager: Hash de licencia inválido');
                    return false;
                }

                // Crear clave de cifrado a partir de la clave secreta
                const key = crypto.createHash('sha256').update(authConfig.secretKey).digest();

                // Descifrar los datos
                const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
                let decrypted = decipher.update(encrypted, 'base64', 'utf8');
                decrypted += decipher.final('utf8');

                // Parsear datos descifrados
                const data = JSON.parse(decrypted);

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

                // Verificar con el servidor remoto
                try {
                    const response = await axios.post(authConfig.licenseCheckUrl, {
                        licenseKey,
                        appName: authConfig.appName,
                        userName: authConfig.userName,
                        deviceId: crypto.createHash('sha256').update(os.hostname() + os.userInfo().username).digest('hex')
                    });

                    if (response.data && response.data.success) {
                        logger.info('Auth Manager: Licencia verificada con el servidor');

                        // Si el servidor envía una clave de recuperación, guardarla
                        if (response.data.recoveryKey) {
                            authConfig.recoveryKey = response.data.recoveryKey;
                            logger.info('Auth Manager: Clave de recuperación guardada');
                        }
                    }
                } catch (error) {
                    logger.warn(`Auth Manager: No se pudo verificar la licencia con el servidor: ${error.message}`);
                    logger.info('Auth Manager: Continuando con activación local');
                }

                // Guardar licencia
                authConfig.licenseKey = licenseKey;
                authConfig.licenseStatus = 'active';
                await saveConfig();

                logger.info('Auth Manager: Licencia activada correctamente');
                return true;
            } catch (error) {
                logger.error(`Auth Manager: Error al procesar licencia: ${error.message}`);
                return false;
            }
        }

        logger.error('Auth Manager: Formato de licencia inválido');
        return false;
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
    // Contar códigos de recuperación no utilizados
    const unusedBackupCodes = authConfig.backupCodes ? authConfig.backupCodes.filter(code => !code.used).length : 0;

    return {
        authenticated: isAuthenticated,
        license: {
            key: authConfig.licenseKey ? `${authConfig.licenseKey.substring(0, 10)}...` : '',
            status: authConfig.licenseStatus,
            expiry: authConfig.licenseExpiry
        },
        backupCodes: authConfig.backupCodes,
        unusedBackupCodes,
        recoveryKey: authConfig.recoveryKey ? true : false
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

/**
 * Genera códigos de recuperación
 * @param {number} count - Número de códigos a generar
 * @returns {Promise<string[]>} - Array de códigos de recuperación
 */
async function generateRecoveryCodes(count = 8) {
    try {
        const codes = [];

        // Generar códigos aleatorios
        for (let i = 0; i < count; i++) {
            const code = crypto.randomBytes(4).toString('hex').toUpperCase();
            codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}`);
        }

        // Guardar códigos en la configuración
        authConfig.backupCodes = codes.map(code => ({
            code,
            used: false
        }));

        await saveConfig();

        logger.info(`Auth Manager: ${count} códigos de recuperación generados`);
        return codes;
    } catch (error) {
        logger.error(`Auth Manager: Error al generar códigos de recuperación: ${error.message}`);
        return [];
    }
}

/**
 * Verifica un código de recuperación
 * @param {string} code - Código de recuperación
 * @returns {Promise<boolean>} - true si el código es válido
 */
async function verifyRecoveryCode(code) {
    try {
        // Normalizar código
        const normalizedCode = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const formattedCode = `${normalizedCode.substring(0, 4)}-${normalizedCode.substring(4, 8)}`;

        // Buscar código en la lista
        const codeIndex = authConfig.backupCodes.findIndex(c => c.code === formattedCode && !c.used);

        if (codeIndex === -1) {
            logger.warn('Auth Manager: Código de recuperación inválido o ya utilizado');
            return false;
        }

        // Marcar código como utilizado
        authConfig.backupCodes[codeIndex].used = true;
        authConfig.backupCodes[codeIndex].usedAt = new Date().toISOString();

        // Autenticar al usuario
        isAuthenticated = true;

        await saveConfig();

        logger.info('Auth Manager: Código de recuperación verificado correctamente');
        return true;
    } catch (error) {
        logger.error(`Auth Manager: Error al verificar código de recuperación: ${error.message}`);
        return false;
    }
}

/**
 * Recupera una licencia usando la clave de recuperación
 * @param {string} userName - Nombre de usuario
 * @returns {Promise<boolean>} - true si la recuperación es exitosa
 */
async function recoverLicense(userName) {
    try {
        // Verificar si hay clave de recuperación
        if (!authConfig.recoveryKey) {
            logger.error('Auth Manager: No hay clave de recuperación disponible');
            return false;
        }

        // Verificar con el servidor
        try {
            const response = await axios.post(authConfig.recoveryUrl, {
                recoveryKey: authConfig.recoveryKey,
                userName,
                deviceId: crypto.createHash('sha256').update(os.hostname() + os.userInfo().username).digest('hex')
            });

            if (response.data && response.data.success) {
                // Actualizar licencia
                if (response.data.license) {
                    authConfig.licenseKey = response.data.license.key;
                    authConfig.licenseStatus = response.data.license.status;
                    authConfig.licenseExpiry = response.data.license.expiryDate;

                    await saveConfig();

                    logger.info('Auth Manager: Licencia recuperada correctamente');
                    return true;
                }
            } else {
                logger.error(`Auth Manager: Error al recuperar licencia: ${response.data.message}`);
                return false;
            }
        } catch (error) {
            logger.error(`Auth Manager: Error al conectar con el servidor de recuperación: ${error.message}`);
            return false;
        }
    } catch (error) {
        logger.error(`Auth Manager: Error al recuperar licencia: ${error.message}`);
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
    updateConfig,
    generateRecoveryCodes,
    verifyRecoveryCode,
    recoverLicense,
    // Nuevos métodos para Google Authenticator
    verifyTokenWithSpeakeasy,
    generateNewSecret
};
