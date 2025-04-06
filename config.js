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
    return value.toLowerCase() === 'true';
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
    
    // Base de datos
    DB_PATH: path.join(__dirname, getEnv('DB_PATH', './database.sqlite')),
    
    // Logging
    LOG_LEVEL: getEnv('LOG_LEVEL', 'info'),
    
    // Puppeteer (para WhatsApp Web)
    PUPPETEER_HEADLESS: getEnvAsBool('PUPPETEER_HEADLESS', false),
    
    // Nombre del negocio (para personalizar mensajes)
    BUSINESS_NAME: getEnv('BUSINESS_NAME', 'Karla Moreno Educadora'),
};
