/**
 * logger.js - Sistema de logging para el asistente de ventas de WhatsApp
 */

const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

// Niveles de log
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

// Nivel configurado
const CURRENT_LEVEL = LOG_LEVELS[config.LOG_LEVEL.toLowerCase()] || LOG_LEVELS.info;

// Directorio para logs
const LOG_DIR = path.join(__dirname, 'logs');

// Asegurar que el directorio de logs existe
async function ensureLogDir() {
    try {
        await fs.mkdir(LOG_DIR, { recursive: true });
    } catch (error) {
        console.error('Error al crear directorio de logs:', error);
    }
}

// Obtener nombre de archivo de log para hoy
function getLogFilename() {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(LOG_DIR, `${date}.log`);
}

// Formatear mensaje de log
function formatLogMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}\n`;
}

// Escribir a archivo de log
async function writeToLogFile(message) {
    try {
        await ensureLogDir();
        const filename = getLogFilename();
        await fs.appendFile(filename, message);
    } catch (error) {
        console.error('Error al escribir en archivo de log:', error);
    }
}

// Funciones de log por nivel
async function debug(message, meta = {}) {
    if (CURRENT_LEVEL <= LOG_LEVELS.debug) {
        const logMessage = formatLogMessage('debug', message, meta);
        console.debug(logMessage.trim());
        await writeToLogFile(logMessage);
    }
}

async function info(message, meta = {}) {
    if (CURRENT_LEVEL <= LOG_LEVELS.info) {
        const logMessage = formatLogMessage('info', message, meta);
        console.info(logMessage.trim());
        await writeToLogFile(logMessage);
    }
}

async function warn(message, meta = {}) {
    if (CURRENT_LEVEL <= LOG_LEVELS.warn) {
        const logMessage = formatLogMessage('warn', message, meta);
        console.warn(logMessage.trim());
        await writeToLogFile(logMessage);
    }
}

async function error(message, meta = {}) {
    if (CURRENT_LEVEL <= LOG_LEVELS.error) {
        const logMessage = formatLogMessage('error', message, meta);
        console.error(logMessage.trim());
        await writeToLogFile(logMessage);
    }
}

// Sanitizar datos sensibles para logging
function sanitize(obj) {
    if (!obj) return obj;
    
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'credential', 'private'];
    const result = { ...obj };
    
    Object.keys(result).forEach(key => {
        if (typeof result[key] === 'object' && result[key] !== null) {
            result[key] = sanitize(result[key]);
        } else if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
            result[key] = '[REDACTED]';
        }
    });
    
    return result;
}

module.exports = {
    debug,
    info,
    warn,
    error,
    sanitize
};
