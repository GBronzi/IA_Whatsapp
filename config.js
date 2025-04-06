/**
 * config.js - Configuración centralizada para el asistente de ventas de WhatsApp
 * Carga variables de entorno desde .env y proporciona valores por defecto
 */

require('dotenv').config();
const path = require('path');

// Función auxiliar para obtener variables de entorno con valores por defecto
const getEnv = (key, defaultValue) => {
    const value = process.env[key];
    return value !== undefined ? value : defaultValue;
};

// Función para convertir string a número con valor por defecto
const getEnvAsInt = (key, defaultValue) => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};

// Función para convertir string a booleano
const getEnvAsBool = (key, defaultValue) => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
};

// Función para convertir string a número de punto flotante
const getEnvAsFloat = (key, defaultValue) => {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
};

// Exportar configuración
module.exports = {
    // WhatsApp
    CLIENT_ID: getEnv('CLIENT_ID', 'ventas-bot-ia'),
    SESSIONS_PATH: path.join(__dirname, getEnv('SESSIONS_PATH', './sessions')),

    // Google Sheets
    SPREADSHEET_ID: getEnv('SPREADSHEET_ID', '1PmLLazjuvBdHcMGqKY94ZH5IkkF6w5Axxt2cr2b_LXI'),
    CREDENTIALS_PATH: path.join(__dirname, getEnv('CREDENTIALS_PATH', './credentials.json')),

    // Ollama
    OLLAMA_URL: getEnv('OLLAMA_URL', 'http://localhost:11434/api/generate'),
    OLLAMA_MODEL: getEnv('OLLAMA_MODEL', 'llama3.2'),
    OLLAMA_TIMEOUT: getEnvAsInt('OLLAMA_TIMEOUT', 60000),

    // Aplicación
    INACTIVITY_THRESHOLD_MS: getEnvAsInt('INACTIVITY_THRESHOLD_MS', 86400000), // 1 día
    TRAINING_DATA_PATH: path.join(__dirname, getEnv('TRAINING_DATA_PATH', './training-data.json')),

    // Cola de mensajes
    MESSAGE_QUEUE_CONCURRENCY: getEnvAsInt('MESSAGE_QUEUE_CONCURRENCY', 5),
    MESSAGE_QUEUE_TIMEOUT: getEnvAsInt('MESSAGE_QUEUE_TIMEOUT', 60000), // 1 minuto
    MESSAGE_WAIT_TIME: getEnvAsInt('MESSAGE_WAIT_TIME', 3000), // 3 segundos

    // Detector de asistencia humana
    HUMAN_ASSISTANCE_TRAINING_DATA_PATH: path.join(__dirname, getEnv('HUMAN_ASSISTANCE_TRAINING_DATA_PATH', './data/human-assistance-training.json')),
    HUMAN_ASSISTANCE_SCORE_THRESHOLD: getEnvAsFloat('HUMAN_ASSISTANCE_SCORE_THRESHOLD', 0.6),
    HUMAN_ASSISTANCE_ENABLE_LEARNING: getEnvAsBool('HUMAN_ASSISTANCE_ENABLE_LEARNING', true),

    // Caché
    CACHE_DEFAULT_STRATEGY: getEnv('CACHE_DEFAULT_STRATEGY', 'memory'),
    CACHE_MEMORY_ENABLED: getEnv('CACHE_MEMORY_ENABLED', 'true'),
    CACHE_MEMORY_MAX_SIZE: getEnvAsInt('CACHE_MEMORY_MAX_SIZE', 1000),
    CACHE_MEMORY_TTL: getEnvAsInt('CACHE_MEMORY_TTL', 3600000), // 1 hora
    CACHE_DISK_ENABLED: getEnv('CACHE_DISK_ENABLED', 'false'),
    CACHE_DISK_DIRECTORY: path.join(__dirname, getEnv('CACHE_DISK_DIRECTORY', './cache')),
    CACHE_DISK_TTL: getEnvAsInt('CACHE_DISK_TTL', 86400000), // 24 horas
    CACHE_KEY_PREFIX: getEnv('CACHE_KEY_PREFIX', 'cache:'),

    // Base de datos
    DB_PATH: path.join(__dirname, getEnv('DB_PATH', './database.sqlite')),

    // Logging
    LOG_LEVEL: getEnv('LOG_LEVEL', 'info'),

    // Puppeteer (para WhatsApp Web)
    PUPPETEER_HEADLESS: getEnvAsBool('PUPPETEER_HEADLESS', false),

    // Nombre del negocio (para personalizar mensajes)
    BUSINESS_NAME: getEnv('BUSINESS_NAME', 'Karla Moreno Educadora'),
};
