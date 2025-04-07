/**
 * security-manager.js
 * 
 * Módulo para gestionar la seguridad de la aplicación.
 * Proporciona funciones para encriptar y desencriptar datos sensibles,
 * gestionar claves de encriptación y validar datos.
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const config = require('./config');

// Algoritmo de encriptación
const ALGORITHM = 'aes-256-gcm';
// Tamaño de la clave en bytes
const KEY_LENGTH = 32;
// Tamaño del vector de inicialización en bytes
const IV_LENGTH = 16;
// Tamaño del tag de autenticación en bytes
const AUTH_TAG_LENGTH = 16;

/**
 * Clase para gestionar la seguridad de la aplicación
 */
class SecurityManager {
  constructor(options = {}) {
    this.options = {
      // Directorio para almacenar claves
      keysDir: options.keysDir || path.join(__dirname, 'data', 'keys'),
      // Nombre del archivo de clave maestra
      masterKeyFile: options.masterKeyFile || 'master.key',
      // Contraseña para derivar clave maestra (debe ser proporcionada en tiempo de ejecución)
      masterPassword: options.masterPassword || process.env.MASTER_PASSWORD || '',
      // Sal para derivar clave maestra
      masterSalt: options.masterSalt || process.env.MASTER_SALT || 'asistente-ventas-whatsapp',
      // Iteraciones para derivar clave maestra
      masterIterations: options.masterIterations || 100000,
      // Algoritmo de hash para derivar clave maestra
      masterDigest: options.masterDigest || 'sha512'
    };
    
    // Clave maestra
    this.masterKey = null;
    
    // Estado de inicialización
    this.initialized = false;
  }
  
  /**
   * Inicializa el gestor de seguridad
   * @param {string} masterPassword - Contraseña maestra (opcional, se puede proporcionar en el constructor)
   * @returns {Promise<boolean>} - true si se inicializó correctamente
   */
  async initialize(masterPassword = '') {
    try {
      // Usar contraseña proporcionada o la del constructor
      const password = masterPassword || this.options.masterPassword;
      
      if (!password) {
        throw new Error('Se requiere una contraseña maestra para inicializar el gestor de seguridad');
      }
      
      // Crear directorio de claves si no existe
      await this.ensureKeysDirectory();
      
      // Verificar si existe la clave maestra
      const masterKeyPath = path.join(this.options.keysDir, this.options.masterKeyFile);
      let masterKeyExists = false;
      
      try {
        await fs.access(masterKeyPath);
        masterKeyExists = true;
      } catch (error) {
        // La clave no existe, se creará una nueva
        masterKeyExists = false;
      }
      
      if (masterKeyExists) {
        // Cargar clave maestra existente
        await this.loadMasterKey(password);
      } else {
        // Crear nueva clave maestra
        await this.createMasterKey(password);
      }
      
      this.initialized = true;
      logger.info('Gestor de seguridad inicializado correctamente');
      
      return true;
    } catch (error) {
      logger.error(`Error al inicializar gestor de seguridad: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Asegura que el directorio de claves exista
   */
  async ensureKeysDirectory() {
    try {
      await fs.mkdir(this.options.keysDir, { recursive: true });
    } catch (error) {
      logger.error(`Error al crear directorio de claves: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Crea una nueva clave maestra
   * @param {string} password - Contraseña para derivar la clave
   */
  async createMasterKey(password) {
    try {
      // Generar clave aleatoria
      const masterKey = crypto.randomBytes(KEY_LENGTH);
      
      // Derivar clave de encriptación a partir de la contraseña
      const { key, salt } = await this.deriveKey(password);
      
      // Encriptar clave maestra
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
      
      let encryptedKey = cipher.update(masterKey);
      encryptedKey = Buffer.concat([encryptedKey, cipher.final()]);
      
      const authTag = cipher.getAuthTag();
      
      // Guardar clave encriptada
      const keyData = {
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encryptedKey: encryptedKey.toString('hex')
      };
      
      const masterKeyPath = path.join(this.options.keysDir, this.options.masterKeyFile);
      await fs.writeFile(masterKeyPath, JSON.stringify(keyData), 'utf8');
      
      // Guardar clave en memoria
      this.masterKey = masterKey;
      
      logger.info('Clave maestra creada correctamente');
    } catch (error) {
      logger.error(`Error al crear clave maestra: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Carga la clave maestra existente
   * @param {string} password - Contraseña para derivar la clave
   */
  async loadMasterKey(password) {
    try {
      // Leer datos de clave encriptada
      const masterKeyPath = path.join(this.options.keysDir, this.options.masterKeyFile);
      const keyDataJson = await fs.readFile(masterKeyPath, 'utf8');
      const keyData = JSON.parse(keyDataJson);
      
      // Derivar clave de encriptación a partir de la contraseña y la sal almacenada
      const salt = Buffer.from(keyData.salt, 'hex');
      const { key } = await this.deriveKey(password, salt);
      
      // Desencriptar clave maestra
      const iv = Buffer.from(keyData.iv, 'hex');
      const authTag = Buffer.from(keyData.authTag, 'hex');
      const encryptedKey = Buffer.from(keyData.encryptedKey, 'hex');
      
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      
      let masterKey = decipher.update(encryptedKey);
      masterKey = Buffer.concat([masterKey, decipher.final()]);
      
      // Guardar clave en memoria
      this.masterKey = masterKey;
      
      logger.info('Clave maestra cargada correctamente');
    } catch (error) {
      logger.error(`Error al cargar clave maestra: ${error.message}`);
      throw new Error('Contraseña incorrecta o archivo de clave corrupto');
    }
  }
  
  /**
   * Deriva una clave a partir de una contraseña
   * @param {string} password - Contraseña
   * @param {Buffer} salt - Sal (opcional, se genera si no se proporciona)
   * @returns {Promise<Object>} - Clave derivada y sal
   */
  async deriveKey(password, salt = null) {
    return new Promise((resolve, reject) => {
      // Generar sal si no se proporciona
      const useSalt = salt || crypto.randomBytes(16);
      
      // Derivar clave
      crypto.pbkdf2(
        password,
        useSalt,
        this.options.masterIterations,
        KEY_LENGTH,
        this.options.masterDigest,
        (err, derivedKey) => {
          if (err) {
            reject(err);
          } else {
            resolve({ key: derivedKey, salt: useSalt });
          }
        }
      );
    });
  }
  
  /**
   * Encripta datos
   * @param {string|Object|Buffer} data - Datos a encriptar
   * @returns {string} - Datos encriptados en formato hexadecimal
   */
  encrypt(data) {
    if (!this.initialized || !this.masterKey) {
      throw new Error('El gestor de seguridad no está inicializado');
    }
    
    try {
      // Convertir datos a buffer
      let dataBuffer;
      
      if (Buffer.isBuffer(data)) {
        dataBuffer = data;
      } else if (typeof data === 'string') {
        dataBuffer = Buffer.from(data, 'utf8');
      } else {
        dataBuffer = Buffer.from(JSON.stringify(data), 'utf8');
      }
      
      // Generar vector de inicialización
      const iv = crypto.randomBytes(IV_LENGTH);
      
      // Crear cipher
      const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
      
      // Encriptar datos
      let encryptedData = cipher.update(dataBuffer);
      encryptedData = Buffer.concat([encryptedData, cipher.final()]);
      
      // Obtener tag de autenticación
      const authTag = cipher.getAuthTag();
      
      // Combinar IV, datos encriptados y tag de autenticación
      const result = Buffer.concat([
        iv,
        authTag,
        encryptedData
      ]);
      
      // Devolver como string hexadecimal
      return result.toString('hex');
    } catch (error) {
      logger.error(`Error al encriptar datos: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Desencripta datos
   * @param {string} encryptedData - Datos encriptados en formato hexadecimal
   * @param {string} outputFormat - Formato de salida ('string', 'json', 'buffer')
   * @returns {string|Object|Buffer} - Datos desencriptados
   */
  decrypt(encryptedData, outputFormat = 'string') {
    if (!this.initialized || !this.masterKey) {
      throw new Error('El gestor de seguridad no está inicializado');
    }
    
    try {
      // Convertir datos encriptados a buffer
      const dataBuffer = Buffer.from(encryptedData, 'hex');
      
      // Extraer IV, tag de autenticación y datos encriptados
      const iv = dataBuffer.slice(0, IV_LENGTH);
      const authTag = dataBuffer.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
      const encryptedContent = dataBuffer.slice(IV_LENGTH + AUTH_TAG_LENGTH);
      
      // Crear decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
      decipher.setAuthTag(authTag);
      
      // Desencriptar datos
      let decryptedData = decipher.update(encryptedContent);
      decryptedData = Buffer.concat([decryptedData, decipher.final()]);
      
      // Devolver en el formato solicitado
      if (outputFormat === 'buffer') {
        return decryptedData;
      } else if (outputFormat === 'json') {
        return JSON.parse(decryptedData.toString('utf8'));
      } else {
        return decryptedData.toString('utf8');
      }
    } catch (error) {
      logger.error(`Error al desencriptar datos: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Encripta un archivo
   * @param {string} inputPath - Ruta del archivo a encriptar
   * @param {string} outputPath - Ruta donde guardar el archivo encriptado
   * @returns {Promise<boolean>} - true si se encriptó correctamente
   */
  async encryptFile(inputPath, outputPath) {
    if (!this.initialized || !this.masterKey) {
      throw new Error('El gestor de seguridad no está inicializado');
    }
    
    try {
      // Leer archivo
      const data = await fs.readFile(inputPath);
      
      // Encriptar datos
      const encryptedData = this.encrypt(data);
      
      // Guardar archivo encriptado
      await fs.writeFile(outputPath, encryptedData, 'utf8');
      
      return true;
    } catch (error) {
      logger.error(`Error al encriptar archivo: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Desencripta un archivo
   * @param {string} inputPath - Ruta del archivo encriptado
   * @param {string} outputPath - Ruta donde guardar el archivo desencriptado
   * @returns {Promise<boolean>} - true si se desencriptó correctamente
   */
  async decryptFile(inputPath, outputPath) {
    if (!this.initialized || !this.masterKey) {
      throw new Error('El gestor de seguridad no está inicializado');
    }
    
    try {
      // Leer archivo encriptado
      const encryptedData = await fs.readFile(inputPath, 'utf8');
      
      // Desencriptar datos
      const decryptedData = this.decrypt(encryptedData, 'buffer');
      
      // Guardar archivo desencriptado
      await fs.writeFile(outputPath, decryptedData);
      
      return true;
    } catch (error) {
      logger.error(`Error al desencriptar archivo: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Genera un hash de una contraseña
   * @param {string} password - Contraseña
   * @returns {Promise<string>} - Hash de la contraseña
   */
  async hashPassword(password) {
    return new Promise((resolve, reject) => {
      // Generar sal
      crypto.randomBytes(16, (err, salt) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Derivar clave
        crypto.pbkdf2(
          password,
          salt,
          10000,
          64,
          'sha512',
          (err, derivedKey) => {
            if (err) {
              reject(err);
              return;
            }
            
            // Formato: iteraciones:sal:hash
            resolve(`10000:${salt.toString('hex')}:${derivedKey.toString('hex')}`);
          }
        );
      });
    });
  }
  
  /**
   * Verifica una contraseña contra un hash
   * @param {string} password - Contraseña
   * @param {string} hash - Hash de la contraseña
   * @returns {Promise<boolean>} - true si la contraseña es correcta
   */
  async verifyPassword(password, hash) {
    return new Promise((resolve, reject) => {
      // Extraer partes del hash
      const parts = hash.split(':');
      const iterations = parseInt(parts[0], 10);
      const salt = Buffer.from(parts[1], 'hex');
      const storedHash = Buffer.from(parts[2], 'hex');
      
      // Derivar clave con los mismos parámetros
      crypto.pbkdf2(
        password,
        salt,
        iterations,
        storedHash.length,
        'sha512',
        (err, derivedKey) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Comparar hashes
          resolve(crypto.timingSafeEqual(storedHash, derivedKey));
        }
      );
    });
  }
  
  /**
   * Genera un token JWT
   * @param {Object} payload - Datos a incluir en el token
   * @param {Object} options - Opciones del token
   * @returns {string} - Token JWT
   */
  generateToken(payload, options = {}) {
    if (!this.initialized || !this.masterKey) {
      throw new Error('El gestor de seguridad no está inicializado');
    }
    
    try {
      // Opciones por defecto
      const tokenOptions = {
        expiresIn: options.expiresIn || '1h',
        issuer: options.issuer || 'asistente-ventas-whatsapp',
        audience: options.audience || 'app'
      };
      
      // Crear cabecera
      const header = {
        alg: 'HS256',
        typ: 'JWT'
      };
      
      // Añadir tiempo de expiración al payload
      const now = Math.floor(Date.now() / 1000);
      const exp = now + (typeof tokenOptions.expiresIn === 'string'
        ? this.parseExpiresIn(tokenOptions.expiresIn)
        : tokenOptions.expiresIn);
      
      const tokenPayload = {
        ...payload,
        iat: now,
        exp,
        iss: tokenOptions.issuer,
        aud: tokenOptions.audience
      };
      
      // Codificar cabecera y payload
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
      const encodedPayload = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
      
      // Crear firma
      const data = `${encodedHeader}.${encodedPayload}`;
      const signature = crypto
        .createHmac('sha256', this.masterKey)
        .update(data)
        .digest('base64url');
      
      // Crear token
      return `${data}.${signature}`;
    } catch (error) {
      logger.error(`Error al generar token: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Verifica un token JWT
   * @param {string} token - Token JWT
   * @param {Object} options - Opciones de verificación
   * @returns {Object} - Payload del token
   */
  verifyToken(token, options = {}) {
    if (!this.initialized || !this.masterKey) {
      throw new Error('El gestor de seguridad no está inicializado');
    }
    
    try {
      // Opciones por defecto
      const verifyOptions = {
        issuer: options.issuer || 'asistente-ventas-whatsapp',
        audience: options.audience || 'app'
      };
      
      // Dividir token
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Token inválido');
      }
      
      const [encodedHeader, encodedPayload, signature] = parts;
      
      // Verificar firma
      const data = `${encodedHeader}.${encodedPayload}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.masterKey)
        .update(data)
        .digest('base64url');
      
      if (signature !== expectedSignature) {
        throw new Error('Firma inválida');
      }
      
      // Decodificar payload
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      
      // Verificar tiempo de expiración
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new Error('Token expirado');
      }
      
      // Verificar emisor
      if (verifyOptions.issuer && payload.iss !== verifyOptions.issuer) {
        throw new Error('Emisor inválido');
      }
      
      // Verificar audiencia
      if (verifyOptions.audience && payload.aud !== verifyOptions.audience) {
        throw new Error('Audiencia inválida');
      }
      
      return payload;
    } catch (error) {
      logger.error(`Error al verificar token: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Convierte una cadena de tiempo de expiración a segundos
   * @param {string} expiresIn - Tiempo de expiración (ej: '1h', '7d')
   * @returns {number} - Tiempo en segundos
   */
  parseExpiresIn(expiresIn) {
    const match = expiresIn.match(/^(\d+)([smhdw])$/);
    if (!match) {
      throw new Error(`Formato de tiempo de expiración inválido: ${expiresIn}`);
    }
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      case 'w': return value * 7 * 24 * 60 * 60;
      default: throw new Error(`Unidad de tiempo desconocida: ${unit}`);
    }
  }
  
  /**
   * Genera un ID único
   * @param {string} prefix - Prefijo para el ID
   * @returns {string} - ID único
   */
  generateId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const randomPart = crypto.randomBytes(4).toString('hex');
    return `${prefix}${timestamp}${randomPart}`;
  }
  
  /**
   * Valida datos contra un esquema
   * @param {Object} data - Datos a validar
   * @param {Object} schema - Esquema de validación
   * @returns {Object} - Resultado de la validación
   */
  validateData(data, schema) {
    const result = {
      valid: true,
      errors: []
    };
    
    // Validar campos requeridos
    if (schema.required) {
      for (const field of schema.required) {
        if (data[field] === undefined) {
          result.valid = false;
          result.errors.push(`Campo requerido: ${field}`);
        }
      }
    }
    
    // Validar tipos y restricciones
    if (schema.properties) {
      for (const [field, props] of Object.entries(schema.properties)) {
        if (data[field] !== undefined) {
          // Validar tipo
          if (props.type) {
            const type = typeof data[field];
            let valid = false;
            
            if (props.type === 'array') {
              valid = Array.isArray(data[field]);
            } else if (props.type === 'integer') {
              valid = Number.isInteger(data[field]);
            } else {
              valid = type === props.type;
            }
            
            if (!valid) {
              result.valid = false;
              result.errors.push(`Tipo inválido para ${field}: esperado ${props.type}, recibido ${type}`);
            }
          }
          
          // Validar mínimo
          if (props.minimum !== undefined && data[field] < props.minimum) {
            result.valid = false;
            result.errors.push(`Valor mínimo para ${field}: ${props.minimum}`);
          }
          
          // Validar máximo
          if (props.maximum !== undefined && data[field] > props.maximum) {
            result.valid = false;
            result.errors.push(`Valor máximo para ${field}: ${props.maximum}`);
          }
          
          // Validar longitud mínima
          if (props.minLength !== undefined && data[field].length < props.minLength) {
            result.valid = false;
            result.errors.push(`Longitud mínima para ${field}: ${props.minLength}`);
          }
          
          // Validar longitud máxima
          if (props.maxLength !== undefined && data[field].length > props.maxLength) {
            result.valid = false;
            result.errors.push(`Longitud máxima para ${field}: ${props.maxLength}`);
          }
          
          // Validar patrón
          if (props.pattern && !new RegExp(props.pattern).test(data[field])) {
            result.valid = false;
            result.errors.push(`Patrón inválido para ${field}`);
          }
          
          // Validar enum
          if (props.enum && !props.enum.includes(data[field])) {
            result.valid = false;
            result.errors.push(`Valor inválido para ${field}: debe ser uno de [${props.enum.join(', ')}]`);
          }
        }
      }
    }
    
    return result;
  }
}

// Exportar una instancia única
module.exports = new SecurityManager({
  keysDir: path.join(__dirname, config.SECURITY_KEYS_DIR || 'data/keys'),
  masterKeyFile: config.SECURITY_MASTER_KEY_FILE || 'master.key',
  masterPassword: config.SECURITY_MASTER_PASSWORD,
  masterSalt: config.SECURITY_MASTER_SALT || 'asistente-ventas-whatsapp',
  masterIterations: config.SECURITY_MASTER_ITERATIONS || 100000,
  masterDigest: config.SECURITY_MASTER_DIGEST || 'sha512'
});
