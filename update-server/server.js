/**
 * Servidor de actualizaciones para el Asistente de Ventas WhatsApp
 * 
 * Este servidor proporciona endpoints para:
 * - Verificar actualizaciones disponibles
 * - Descargar actualizaciones
 * - Obtener notas de versión
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const semver = require('semver');
const { createHash } = require('crypto');
const morgan = require('morgan');
const winston = require('winston');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Configuración
const PORT = process.env.PORT || 3001;
const UPDATES_DIR = process.env.UPDATES_DIR || path.join(__dirname, 'updates');
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, 'logs');

// Configurar logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'combined.log') 
    })
  ]
});

// Añadir transporte de consola en desarrollo
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Crear directorios si no existen
if (!fs.existsSync(UPDATES_DIR)) {
  fs.mkdirSync(UPDATES_DIR, { recursive: true });
}

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Crear aplicación Express
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(helmet());
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) }
}));

// Limitar solicitudes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 solicitudes por ventana
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Middleware para verificar clave API
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ 
      success: false, 
      message: 'API key inválida o no proporcionada' 
    });
  }
  
  next();
};

/**
 * Obtiene la lista de actualizaciones disponibles
 * @returns {Array} - Lista de actualizaciones
 */
function getUpdates() {
  try {
    const updatesFile = path.join(UPDATES_DIR, 'updates.json');
    
    if (fs.existsSync(updatesFile)) {
      const updatesData = fs.readFileSync(updatesFile, 'utf8');
      return JSON.parse(updatesData);
    }
    
    return [];
  } catch (error) {
    logger.error(`Error al obtener actualizaciones: ${error.message}`);
    return [];
  }
}

/**
 * Obtiene la última actualización para una plataforma y canal
 * @param {string} platform - Plataforma (win32, darwin, linux)
 * @param {string} arch - Arquitectura (x64, arm64)
 * @param {string} channel - Canal (stable, beta)
 * @param {string} currentVersion - Versión actual
 * @returns {Object|null} - Última actualización o null si no hay
 */
function getLatestUpdate(platform, arch, channel, currentVersion) {
  try {
    const updates = getUpdates();
    
    // Filtrar por plataforma, arquitectura y canal
    const filteredUpdates = updates.filter(update => 
      update.platform === platform && 
      update.arch === arch && 
      update.channel === channel &&
      semver.gt(update.version, currentVersion)
    );
    
    // Ordenar por versión (descendente)
    filteredUpdates.sort((a, b) => semver.compare(b.version, a.version));
    
    return filteredUpdates.length > 0 ? filteredUpdates[0] : null;
  } catch (error) {
    logger.error(`Error al obtener última actualización: ${error.message}`);
    return null;
  }
}

/**
 * Calcula el hash SHA256 de un archivo
 * @param {string} filePath - Ruta del archivo
 * @returns {Promise<string>} - Hash SHA256
 */
function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// Rutas

/**
 * Endpoint para verificar actualizaciones
 * GET /api/updates/check
 */
app.get('/api/updates/check', (req, res) => {
  try {
    const { platform, arch, version, channel = 'stable' } = req.query;
    
    if (!platform || !arch || !version) {
      return res.status(400).json({ 
        success: false, 
        message: 'Faltan parámetros requeridos' 
      });
    }
    
    // Obtener última actualización
    const latestUpdate = getLatestUpdate(platform, arch, channel, version);
    
    if (!latestUpdate) {
      return res.json({ 
        success: true, 
        updateAvailable: false,
        message: 'No hay actualizaciones disponibles' 
      });
    }
    
    // Verificar si el archivo existe
    const filePath = path.join(UPDATES_DIR, latestUpdate.fileName);
    if (!fs.existsSync(filePath)) {
      logger.warn(`Archivo de actualización no encontrado: ${filePath}`);
      return res.json({ 
        success: true, 
        updateAvailable: false,
        message: 'Archivo de actualización no encontrado' 
      });
    }
    
    // Devolver información de la actualización
    return res.json({
      success: true,
      updateAvailable: true,
      version: latestUpdate.version,
      releaseDate: latestUpdate.releaseDate,
      releaseNotes: latestUpdate.releaseNotes,
      downloadUrl: `/api/updates/download/${latestUpdate.version}/${platform}/${arch}`,
      fileName: latestUpdate.fileName,
      sha256: latestUpdate.sha256,
      size: latestUpdate.size
    });
  } catch (error) {
    logger.error(`Error al verificar actualizaciones: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al verificar actualizaciones' 
    });
  }
});

/**
 * Endpoint para descargar actualización
 * GET /api/updates/download/:version/:platform/:arch
 */
app.get('/api/updates/download/:version/:platform/:arch', (req, res) => {
  try {
    const { version, platform, arch } = req.params;
    const { channel = 'stable' } = req.query;
    
    // Obtener actualizaciones
    const updates = getUpdates();
    
    // Buscar actualización
    const update = updates.find(u => 
      u.version === version && 
      u.platform === platform && 
      u.arch === arch && 
      u.channel === channel
    );
    
    if (!update) {
      return res.status(404).json({ 
        success: false, 
        message: 'Actualización no encontrada' 
      });
    }
    
    // Verificar si el archivo existe
    const filePath = path.join(UPDATES_DIR, update.fileName);
    if (!fs.existsSync(filePath)) {
      logger.warn(`Archivo de actualización no encontrado: ${filePath}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Archivo de actualización no encontrado' 
      });
    }
    
    // Registrar descarga
    logger.info(`Descarga de actualización: ${update.version} (${platform}/${arch})`);
    
    // Enviar archivo
    res.download(filePath);
  } catch (error) {
    logger.error(`Error al descargar actualización: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al descargar actualización' 
    });
  }
});

/**
 * Endpoint para obtener notas de versión
 * GET /api/updates/notes/:version
 */
app.get('/api/updates/notes/:version', (req, res) => {
  try {
    const { version } = req.params;
    
    // Obtener actualizaciones
    const updates = getUpdates();
    
    // Buscar actualización
    const update = updates.find(u => u.version === version);
    
    if (!update) {
      return res.status(404).json({ 
        success: false, 
        message: 'Versión no encontrada' 
      });
    }
    
    // Devolver notas de versión
    return res.json({
      success: true,
      version: update.version,
      releaseDate: update.releaseDate,
      releaseNotes: update.releaseNotes
    });
  } catch (error) {
    logger.error(`Error al obtener notas de versión: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener notas de versión' 
    });
  }
});

/**
 * Endpoint para subir una nueva actualización
 * POST /api/updates/upload
 * Requiere autenticación con clave API
 */
app.post('/api/updates/upload', apiKeyAuth, (req, res) => {
  try {
    // Este endpoint requeriría una implementación más compleja con multer
    // para manejar la carga de archivos. Por ahora, devolvemos un mensaje
    // indicando que no está implementado.
    return res.status(501).json({ 
      success: false, 
      message: 'Endpoint no implementado' 
    });
  } catch (error) {
    logger.error(`Error al subir actualización: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al subir actualización' 
    });
  }
});

/**
 * Endpoint para añadir una nueva actualización
 * POST /api/updates/add
 * Requiere autenticación con clave API
 */
app.post('/api/updates/add', apiKeyAuth, async (req, res) => {
  try {
    const { 
      version, 
      platform, 
      arch, 
      channel = 'stable',
      releaseDate = new Date().toISOString(),
      releaseNotes = '',
      fileName
    } = req.body;
    
    if (!version || !platform || !arch || !fileName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Faltan parámetros requeridos' 
      });
    }
    
    // Verificar si el archivo existe
    const filePath = path.join(UPDATES_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        success: false, 
        message: 'Archivo no encontrado' 
      });
    }
    
    // Obtener tamaño del archivo
    const stats = fs.statSync(filePath);
    const size = stats.size;
    
    // Calcular hash SHA256
    const sha256 = await calculateFileHash(filePath);
    
    // Obtener actualizaciones existentes
    const updates = getUpdates();
    
    // Verificar si la actualización ya existe
    const existingUpdate = updates.find(u => 
      u.version === version && 
      u.platform === platform && 
      u.arch === arch && 
      u.channel === channel
    );
    
    if (existingUpdate) {
      return res.status(409).json({ 
        success: false, 
        message: 'La actualización ya existe' 
      });
    }
    
    // Añadir nueva actualización
    updates.push({
      version,
      platform,
      arch,
      channel,
      releaseDate,
      releaseNotes,
      fileName,
      sha256,
      size
    });
    
    // Guardar actualizaciones
    const updatesFile = path.join(UPDATES_DIR, 'updates.json');
    fs.writeFileSync(updatesFile, JSON.stringify(updates, null, 2), 'utf8');
    
    logger.info(`Nueva actualización añadida: ${version} (${platform}/${arch})`);
    
    return res.json({
      success: true,
      message: 'Actualización añadida correctamente'
    });
  } catch (error) {
    logger.error(`Error al añadir actualización: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al añadir actualización' 
    });
  }
});

/**
 * Endpoint para eliminar una actualización
 * DELETE /api/updates/:version/:platform/:arch
 * Requiere autenticación con clave API
 */
app.delete('/api/updates/:version/:platform/:arch', apiKeyAuth, (req, res) => {
  try {
    const { version, platform, arch } = req.params;
    const { channel = 'stable' } = req.query;
    
    // Obtener actualizaciones
    const updates = getUpdates();
    
    // Buscar índice de la actualización
    const updateIndex = updates.findIndex(u => 
      u.version === version && 
      u.platform === platform && 
      u.arch === arch && 
      u.channel === channel
    );
    
    if (updateIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Actualización no encontrada' 
      });
    }
    
    // Obtener información de la actualización
    const update = updates[updateIndex];
    
    // Eliminar archivo
    const filePath = path.join(UPDATES_DIR, update.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Eliminar actualización de la lista
    updates.splice(updateIndex, 1);
    
    // Guardar actualizaciones
    const updatesFile = path.join(UPDATES_DIR, 'updates.json');
    fs.writeFileSync(updatesFile, JSON.stringify(updates, null, 2), 'utf8');
    
    logger.info(`Actualización eliminada: ${version} (${platform}/${arch})`);
    
    return res.json({
      success: true,
      message: 'Actualización eliminada correctamente'
    });
  } catch (error) {
    logger.error(`Error al eliminar actualización: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar actualización' 
    });
  }
});

/**
 * Endpoint para listar todas las actualizaciones
 * GET /api/updates
 * Requiere autenticación con clave API
 */
app.get('/api/updates', apiKeyAuth, (req, res) => {
  try {
    const updates = getUpdates();
    
    return res.json({
      success: true,
      updates
    });
  } catch (error) {
    logger.error(`Error al listar actualizaciones: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al listar actualizaciones' 
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  logger.info(`Servidor de actualizaciones ejecutándose en http://localhost:${PORT}`);
});
