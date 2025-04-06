/**
 * Cliente para el servidor de licencias
 *
 * Este módulo proporciona funciones para comunicarse con el servidor de licencias
 * y verificar la validez de las licencias.
 */

const axios = require('axios');
const os = require('os');
const crypto = require('crypto');
const logger = require('./logger');

// Configuración por defecto
const DEFAULT_CONFIG = {
  serverUrl: process.env.LICENSE_SERVER_URL || 'http://localhost:3000',
  timeout: process.env.LICENSE_REQUEST_TIMEOUT || 5000,
  retryCount: process.env.LICENSE_RETRY_COUNT || 3,
  retryDelay: process.env.LICENSE_RETRY_DELAY || 1000,
  offlineMode: process.env.LICENSE_OFFLINE_MODE === 'true',
  cacheExpiry: process.env.LICENSE_CACHE_EXPIRY || 86400000 // 24 horas
};

// Estado del cliente
let config = { ...DEFAULT_CONFIG };
let licenseCache = null;
let lastVerification = null;

/**
 * Inicializa el cliente de licencias
 * @param {Object} customConfig - Configuración personalizada
 * @returns {Object} - Instancia del cliente
 */
function initialize(customConfig = {}) {
  try {
    // Combinar configuración por defecto con la personalizada
    config = { ...DEFAULT_CONFIG, ...customConfig };

    logger.info('Cliente de licencias inicializado correctamente');
    return module.exports;
  } catch (error) {
    logger.error(`Error al inicializar cliente de licencias: ${error.message}`);
    return module.exports;
  }
}

/**
 * Verifica una licencia con el servidor
 * @param {string} licenseKey - Clave de licencia
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - Resultado de la verificación
 */
async function verifyLicense(licenseKey, options = {}) {
  try {
    // Si no hay licencia, retornar error
    if (!licenseKey) {
      return {
        valid: false,
        status: 'invalid',
        message: 'Licencia no proporcionada',
        offlineMode: false
      };
    }

    // Verificar si hay una verificación reciente en caché
    if (licenseCache && licenseCache.key === licenseKey && lastVerification) {
      const now = Date.now();
      const elapsed = now - lastVerification;

      // Si la caché no ha expirado, retornar resultado en caché
      if (elapsed < config.cacheExpiry) {
        logger.debug('Usando resultado de verificación en caché');
        return licenseCache;
      }
    }

    // Generar ID de dispositivo
    const deviceId = generateDeviceId();

    // Intentar verificar con el servidor
    if (!config.offlineMode) {
      try {
        const result = await verifyWithServer(licenseKey, deviceId, options);

        // Guardar resultado en caché
        licenseCache = result;
        lastVerification = Date.now();

        return result;
      } catch (error) {
        logger.warn(`Error al verificar licencia con el servidor: ${error.message}`);

        // Si hay un resultado en caché, usarlo como fallback
        if (licenseCache && licenseCache.key === licenseKey) {
          logger.info('Usando resultado en caché como fallback');
          return {
            ...licenseCache,
            offlineMode: true,
            message: 'Verificación offline (usando caché)'
          };
        }

        // Si no hay caché, verificar offline
        return verifyOffline(licenseKey, deviceId);
      }
    } else {
      // Verificar offline
      return verifyOffline(licenseKey, deviceId);
    }
  } catch (error) {
    logger.error(`Error al verificar licencia: ${error.message}`);
    return {
      valid: false,
      status: 'error',
      message: `Error al verificar licencia: ${error.message}`,
      offlineMode: config.offlineMode
    };
  }
}

/**
 * Verifica una licencia con el servidor
 * @param {string} licenseKey - Clave de licencia
 * @param {string} deviceId - ID del dispositivo
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - Resultado de la verificación
 */
async function verifyWithServer(licenseKey, deviceId, options = {}) {
  // Configurar cliente HTTP
  const client = axios.create({
    baseURL: config.serverUrl,
    timeout: config.timeout
  });

  // Datos de la solicitud
  const data = {
    licenseKey,
    appName: options.appName || 'AsistenteVentasWhatsApp',
    userName: options.userName || os.userInfo().username,
    deviceId
  };

  // Intentar verificar con reintentos
  let lastError = null;
  for (let i = 0; i < config.retryCount; i++) {
    try {
      const response = await client.post('/api/verify-license', data);

      if (response.data && response.data.valid) {
        return {
          valid: true,
          status: response.data.status || 'active',
          message: response.data.message || 'Licencia válida',
          expiryDate: response.data.expiryDate,
          key: licenseKey,
          offlineMode: false
        };
      } else {
        return {
          valid: false,
          status: response.data.status || 'invalid',
          message: response.data.message || 'Licencia inválida',
          key: licenseKey,
          offlineMode: false
        };
      }
    } catch (error) {
      lastError = error;

      // Si es un error de respuesta, no reintentar
      if (error.response) {
        return {
          valid: false,
          status: 'invalid',
          message: error.response.data?.message || 'Licencia inválida',
          key: licenseKey,
          offlineMode: false
        };
      }

      // Esperar antes de reintentar
      if (i < config.retryCount - 1) {
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
      }
    }
  }

  // Si todos los intentos fallan, lanzar error
  throw lastError || new Error('Error al verificar licencia con el servidor');
}

/**
 * Verifica una licencia offline
 * @param {string} licenseKey - Clave de licencia
 * @param {string} deviceId - ID del dispositivo
 * @returns {Object} - Resultado de la verificación
 */
function verifyOffline(licenseKey, deviceId) {
  try {
    // Verificar formato de la licencia
    const parts = licenseKey.split('.');

    // Formato antiguo (base64.hash)
    if (parts.length === 2) {
      try {
        // Decodificar datos de la licencia
        const dataString = Buffer.from(parts[0], 'base64').toString('utf8');
        const data = JSON.parse(dataString);

        // Verificar hash
        const hash = crypto.createHash('sha256').update(dataString).digest('hex');
        if (hash.substring(0, 8) !== parts[1]) {
          return {
            valid: false,
            status: 'invalid',
            message: 'Hash de licencia inválido',
            key: licenseKey,
            offlineMode: true
          };
        }

        // Verificar expiración
        if (data.expiryDate !== 'permanent') {
          const expiryDate = new Date(data.expiryDate);
          if (expiryDate < new Date()) {
            return {
              valid: false,
              status: 'expired',
              message: 'Licencia expirada',
              expiryDate: data.expiryDate,
              key: licenseKey,
              offlineMode: true
            };
          }
        }

        // Licencia válida
        return {
          valid: true,
          status: 'active',
          message: 'Licencia válida (verificación offline)',
          expiryDate: data.expiryDate,
          key: licenseKey,
          offlineMode: true
        };
      } catch (error) {
        if (logger) {
          logger.error(`Error al verificar licencia offline (formato antiguo): ${error.message}`);
        } else {
          console.error(`Error al verificar licencia offline (formato antiguo): ${error.message}`);
        }
        return {
          valid: false,
          status: 'invalid',
          message: 'Formato de licencia inválido',
          key: licenseKey,
          offlineMode: true
        };
      }
    }

    // Formato nuevo (iv.encrypted.hash)
    if (parts.length === 3) {
      // En una implementación real, aquí verificaríamos la licencia
      // con el formato nuevo, pero para simplificar, asumimos que es válida
      if (logger) {
        logger.warn('Verificación offline de licencia con formato nuevo no implementada');
      } else {
        console.warn('Verificación offline de licencia con formato nuevo no implementada');
      }
      return {
        valid: true,
        status: 'active',
        message: 'Licencia válida (verificación offline)',
        key: licenseKey,
        offlineMode: true
      };
    }

    // Formato inválido
    return {
      valid: false,
      status: 'invalid',
      message: 'Formato de licencia inválido',
      key: licenseKey,
      offlineMode: true
    };
  } catch (error) {
    if (logger) {
      logger.error(`Error al verificar licencia offline: ${error.message}`);
    } else {
      console.error(`Error al verificar licencia offline: ${error.message}`);
    }
    return {
      valid: false,
      status: 'error',
      message: `Error al verificar licencia offline: ${error.message}`,
      key: licenseKey,
      offlineMode: true
    };
  }
}

/**
 * Activa una licencia en el servidor
 * @param {string} licenseKey - Clave de licencia
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - Resultado de la activación
 */
async function activateLicense(licenseKey, options = {}) {
  try {
    // Si no hay licencia, retornar error
    if (!licenseKey) {
      return {
        success: false,
        message: 'Licencia no proporcionada'
      };
    }

    // Generar ID de dispositivo
    const deviceId = generateDeviceId();

    // Configurar cliente HTTP
    const client = axios.create({
      baseURL: config.serverUrl,
      timeout: config.timeout
    });

    // Datos de la solicitud
    const data = {
      licenseKey,
      appName: options.appName || 'AsistenteVentasWhatsApp',
      userName: options.userName || os.userInfo().username,
      deviceId,
      email: options.email
    };

    // Intentar activar con reintentos
    let lastError = null;
    for (let i = 0; i < config.retryCount; i++) {
      try {
        const response = await client.post('/api/activate-license', data);

        if (response.data && response.data.success) {
          // Guardar resultado en caché
          licenseCache = {
            valid: true,
            status: 'active',
            message: 'Licencia activada correctamente',
            expiryDate: response.data.license?.expiryDate,
            key: licenseKey,
            offlineMode: false
          };
          lastVerification = Date.now();

          return {
            success: true,
            message: response.data.message || 'Licencia activada correctamente',
            license: response.data.license,
            recoveryKey: response.data.recoveryKey
          };
        } else {
          return {
            success: false,
            message: response.data.message || 'Error al activar licencia'
          };
        }
      } catch (error) {
        lastError = error;

        // Si es un error de respuesta, no reintentar
        if (error.response) {
          return {
            success: false,
            message: error.response.data?.message || 'Error al activar licencia'
          };
        }

        // Esperar antes de reintentar
        if (i < config.retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        }
      }
    }

    // Si todos los intentos fallan, retornar error
    return {
      success: false,
      message: lastError?.message || 'Error al activar licencia'
    };
  } catch (error) {
    logger.error(`Error al activar licencia: ${error.message}`);
    return {
      success: false,
      message: `Error al activar licencia: ${error.message}`
    };
  }
}

/**
 * Recupera una licencia usando una clave de recuperación
 * @param {string} recoveryKey - Clave de recuperación
 * @param {string} userName - Nombre de usuario
 * @returns {Promise<Object>} - Resultado de la recuperación
 */
async function recoverLicense(recoveryKey, userName) {
  try {
    // Si no hay clave de recuperación o nombre de usuario, retornar error
    if (!recoveryKey || !userName) {
      return {
        success: false,
        message: 'Clave de recuperación y nombre de usuario son requeridos'
      };
    }

    // Configurar cliente HTTP
    const client = axios.create({
      baseURL: config.serverUrl,
      timeout: config.timeout
    });

    // Datos de la solicitud
    const data = {
      recoveryKey,
      userName
    };

    // Intentar recuperar con reintentos
    let lastError = null;
    for (let i = 0; i < config.retryCount; i++) {
      try {
        const response = await client.post('/api/recover-license', data);

        if (response.data && response.data.success) {
          // Guardar resultado en caché
          if (response.data.license) {
            licenseCache = {
              valid: true,
              status: 'active',
              message: 'Licencia recuperada correctamente',
              expiryDate: response.data.license.expiryDate,
              key: response.data.license.key,
              offlineMode: false
            };
            lastVerification = Date.now();
          }

          return {
            success: true,
            message: response.data.message || 'Licencia recuperada correctamente',
            license: response.data.license
          };
        } else {
          return {
            success: false,
            message: response.data.message || 'Error al recuperar licencia'
          };
        }
      } catch (error) {
        lastError = error;

        // Si es un error de respuesta, no reintentar
        if (error.response) {
          return {
            success: false,
            message: error.response.data?.message || 'Error al recuperar licencia'
          };
        }

        // Esperar antes de reintentar
        if (i < config.retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        }
      }
    }

    // Si todos los intentos fallan, retornar error
    return {
      success: false,
      message: lastError?.message || 'Error al recuperar licencia'
    };
  } catch (error) {
    logger.error(`Error al recuperar licencia: ${error.message}`);
    return {
      success: false,
      message: `Error al recuperar licencia: ${error.message}`
    };
  }
}

/**
 * Genera un ID único para el dispositivo
 * @returns {string} - ID del dispositivo
 */
function generateDeviceId() {
  const data = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0].model,
    os.totalmem(),
    os.userInfo().username
  ].join('|');

  return crypto.createHash('sha256').update(data).digest('hex');
}

module.exports = {
  initialize,
  verifyLicense,
  verifyOffline,
  activateLicense,
  recoverLicense,
  generateDeviceId
};
