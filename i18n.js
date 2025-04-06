/**
 * i18n.js - Módulo para internacionalización y soporte de múltiples idiomas
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

// Idiomas soportados
const SUPPORTED_LANGUAGES = ['es', 'en', 'pt', 'fr', 'it', 'de'];

// Idioma por defecto
const DEFAULT_LANGUAGE = 'es';

// Directorio de traducciones
const TRANSLATIONS_DIR = path.join(__dirname, 'translations');

// Caché de traducciones
const translations = {};

/**
 * Inicializa el módulo de internacionalización
 * @returns {Promise<boolean>} - true si la inicialización fue exitosa
 */
async function initialize() {
    try {
        // Crear directorio de traducciones si no existe
        try {
            await fs.access(TRANSLATIONS_DIR);
        } catch (error) {
            await fs.mkdir(TRANSLATIONS_DIR, { recursive: true });
            logger.info(`Directorio de traducciones creado: ${TRANSLATIONS_DIR}`);
        }
        
        // Cargar traducciones
        for (const lang of SUPPORTED_LANGUAGES) {
            await loadTranslation(lang);
        }
        
        // Crear traducciones por defecto si no existen
        await createDefaultTranslations();
        
        logger.info('Módulo de internacionalización inicializado correctamente');
        return true;
    } catch (error) {
        logger.error(`Error al inicializar módulo de internacionalización: ${error.message}`);
        return false;
    }
}

/**
 * Carga un archivo de traducción
 * @param {string} lang - Código de idioma
 * @returns {Promise<boolean>} - true si la carga fue exitosa
 */
async function loadTranslation(lang) {
    try {
        const filePath = path.join(TRANSLATIONS_DIR, `${lang}.json`);
        
        // Verificar si existe el archivo
        try {
            await fs.access(filePath);
        } catch (error) {
            // Si no existe, no hacer nada
            return false;
        }
        
        // Leer archivo
        const data = await fs.readFile(filePath, 'utf8');
        translations[lang] = JSON.parse(data);
        
        logger.info(`Traducción cargada: ${lang}`);
        return true;
    } catch (error) {
        logger.error(`Error al cargar traducción ${lang}: ${error.message}`);
        return false;
    }
}

/**
 * Crea archivos de traducción por defecto si no existen
 * @returns {Promise<void>}
 */
async function createDefaultTranslations() {
    // Traducción en español (idioma por defecto)
    const esTranslation = {
        app: {
            name: 'Asistente de Ventas WhatsApp',
            description: 'Asistente virtual para ventas a través de WhatsApp'
        },
        common: {
            yes: 'Sí',
            no: 'No',
            ok: 'Aceptar',
            cancel: 'Cancelar',
            save: 'Guardar',
            delete: 'Eliminar',
            edit: 'Editar',
            close: 'Cerrar',
            back: 'Volver',
            next: 'Siguiente',
            previous: 'Anterior',
            search: 'Buscar',
            filter: 'Filtrar',
            all: 'Todos',
            none: 'Ninguno',
            loading: 'Cargando...',
            error: 'Error',
            success: 'Éxito',
            warning: 'Advertencia',
            info: 'Información'
        },
        login: {
            title: 'Iniciar sesión',
            username: 'Usuario',
            password: 'Contraseña',
            login: 'Iniciar sesión',
            forgot_password: 'Olvidé mi contraseña',
            activation_code: 'Código de activación',
            activate: 'Activar',
            license_status: 'Estado de licencia',
            license_valid: 'Licencia válida',
            license_invalid: 'Licencia inválida',
            license_expired: 'Licencia expirada',
            continue: 'Continuar',
            deactivate: 'Desactivar licencia'
        },
        dashboard: {
            title: 'Panel de control',
            status: 'Estado',
            connected: 'Conectado',
            disconnected: 'Desconectado',
            start: 'Iniciar',
            stop: 'Detener',
            logs: 'Registros',
            settings: 'Configuración',
            help: 'Ayuda',
            about: 'Acerca de',
            exit: 'Salir'
        },
        notifications: {
            title: 'Notificaciones',
            mark_all_read: 'Marcar todas como leídas',
            no_notifications: 'No hay notificaciones',
            priority: {
                high: 'Alta',
                medium: 'Media',
                low: 'Baja'
            },
            human_assistance: 'Se requiere asistencia humana',
            client_request: 'Solicitud de cliente',
            negative_sentiment: 'Sentimiento negativo detectado',
            high_urgency: 'Alta urgencia detectada'
        },
        reports: {
            title: 'Reportes',
            date_range: 'Rango de fechas',
            from: 'Desde',
            to: 'Hasta',
            generate: 'Generar',
            export: 'Exportar',
            summary: 'Resumen',
            details: 'Detalles',
            charts: 'Gráficos',
            conversations: 'Conversaciones',
            messages: 'Mensajes',
            clients: 'Clientes',
            sentiment: 'Sentimiento'
        },
        settings: {
            title: 'Configuración',
            general: 'General',
            language: 'Idioma',
            theme: 'Tema',
            notifications: 'Notificaciones',
            sounds: 'Sonidos',
            volume: 'Volumen',
            desktop_notifications: 'Notificaciones de escritorio',
            save_settings: 'Guardar configuración',
            reset_defaults: 'Restablecer valores predeterminados'
        },
        messages: {
            greeting: '¡Hola! Soy el asistente virtual de ventas. ¿En qué puedo ayudarte hoy?',
            farewell: 'Gracias por contactarnos. ¡Que tengas un buen día!',
            help_request: 'Entiendo que prefieras hablar con una persona. Voy a notificar a uno de nuestros agentes para que te contacte lo antes posible. Mientras tanto, ¿hay algo más en lo que pueda ayudarte?',
            restart: '¡Claro! Hemos reiniciado nuestra conversación. ¿En qué puedo ayudarte?',
            error: '¡Ups! Ocurrió un error inesperado. Por favor, intenta de nuevo o escribe "reiniciar".',
            support: 'Noto que podrías estar experimentando alguna dificultad. Quiero asegurarte que estamos aquí para ayudarte. Un agente humano revisará tu caso lo antes posible para brindarte la mejor asistencia.'
        }
    };
    
    // Traducción en inglés
    const enTranslation = {
        app: {
            name: 'WhatsApp Sales Assistant',
            description: 'Virtual assistant for sales through WhatsApp'
        },
        common: {
            yes: 'Yes',
            no: 'No',
            ok: 'OK',
            cancel: 'Cancel',
            save: 'Save',
            delete: 'Delete',
            edit: 'Edit',
            close: 'Close',
            back: 'Back',
            next: 'Next',
            previous: 'Previous',
            search: 'Search',
            filter: 'Filter',
            all: 'All',
            none: 'None',
            loading: 'Loading...',
            error: 'Error',
            success: 'Success',
            warning: 'Warning',
            info: 'Information'
        },
        login: {
            title: 'Login',
            username: 'Username',
            password: 'Password',
            login: 'Login',
            forgot_password: 'Forgot password',
            activation_code: 'Activation code',
            activate: 'Activate',
            license_status: 'License status',
            license_valid: 'Valid license',
            license_invalid: 'Invalid license',
            license_expired: 'Expired license',
            continue: 'Continue',
            deactivate: 'Deactivate license'
        },
        dashboard: {
            title: 'Dashboard',
            status: 'Status',
            connected: 'Connected',
            disconnected: 'Disconnected',
            start: 'Start',
            stop: 'Stop',
            logs: 'Logs',
            settings: 'Settings',
            help: 'Help',
            about: 'About',
            exit: 'Exit'
        },
        notifications: {
            title: 'Notifications',
            mark_all_read: 'Mark all as read',
            no_notifications: 'No notifications',
            priority: {
                high: 'High',
                medium: 'Medium',
                low: 'Low'
            },
            human_assistance: 'Human assistance required',
            client_request: 'Client request',
            negative_sentiment: 'Negative sentiment detected',
            high_urgency: 'High urgency detected'
        },
        reports: {
            title: 'Reports',
            date_range: 'Date range',
            from: 'From',
            to: 'To',
            generate: 'Generate',
            export: 'Export',
            summary: 'Summary',
            details: 'Details',
            charts: 'Charts',
            conversations: 'Conversations',
            messages: 'Messages',
            clients: 'Clients',
            sentiment: 'Sentiment'
        },
        settings: {
            title: 'Settings',
            general: 'General',
            language: 'Language',
            theme: 'Theme',
            notifications: 'Notifications',
            sounds: 'Sounds',
            volume: 'Volume',
            desktop_notifications: 'Desktop notifications',
            save_settings: 'Save settings',
            reset_defaults: 'Reset to defaults'
        },
        messages: {
            greeting: 'Hello! I am the virtual sales assistant. How can I help you today?',
            farewell: 'Thank you for contacting us. Have a great day!',
            help_request: 'I understand you prefer to speak with a person. I will notify one of our agents to contact you as soon as possible. In the meantime, is there anything else I can help you with?',
            restart: 'Sure! We have restarted our conversation. How can I help you?',
            error: 'Oops! An unexpected error occurred. Please try again or type "restart".',
            support: 'I notice you might be experiencing some difficulty. I want to assure you that we are here to help. A human agent will review your case as soon as possible to provide you with the best assistance.'
        }
    };
    
    // Guardar traducciones por defecto si no existen
    await saveTranslationIfNotExists('es', esTranslation);
    await saveTranslationIfNotExists('en', enTranslation);
}

/**
 * Guarda un archivo de traducción si no existe
 * @param {string} lang - Código de idioma
 * @param {Object} data - Datos de traducción
 * @returns {Promise<boolean>} - true si se guardó correctamente
 */
async function saveTranslationIfNotExists(lang, data) {
    try {
        const filePath = path.join(TRANSLATIONS_DIR, `${lang}.json`);
        
        // Verificar si existe el archivo
        try {
            await fs.access(filePath);
            return false; // Ya existe, no hacer nada
        } catch (error) {
            // Si no existe, crear
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
            translations[lang] = data;
            logger.info(`Traducción creada: ${lang}`);
            return true;
        }
    } catch (error) {
        logger.error(`Error al guardar traducción ${lang}: ${error.message}`);
        return false;
    }
}

/**
 * Traduce un texto a un idioma específico
 * @param {string} key - Clave de traducción (formato: 'section.key')
 * @param {string} lang - Código de idioma
 * @param {Object} params - Parámetros para reemplazar en la traducción
 * @returns {string} - Texto traducido
 */
function translate(key, lang = DEFAULT_LANGUAGE, params = {}) {
    try {
        // Si el idioma no está soportado, usar el idioma por defecto
        if (!SUPPORTED_LANGUAGES.includes(lang)) {
            lang = DEFAULT_LANGUAGE;
        }
        
        // Si no hay traducciones para el idioma, usar el idioma por defecto
        if (!translations[lang]) {
            lang = DEFAULT_LANGUAGE;
        }
        
        // Dividir la clave en secciones
        const sections = key.split('.');
        
        // Obtener la traducción
        let translation = translations[lang];
        for (const section of sections) {
            if (!translation || !translation[section]) {
                // Si no se encuentra la traducción, intentar con el idioma por defecto
                if (lang !== DEFAULT_LANGUAGE) {
                    return translate(key, DEFAULT_LANGUAGE, params);
                }
                
                // Si tampoco se encuentra en el idioma por defecto, devolver la clave
                return key;
            }
            
            translation = translation[section];
        }
        
        // Si la traducción no es un string, devolver la clave
        if (typeof translation !== 'string') {
            return key;
        }
        
        // Reemplazar parámetros
        let result = translation;
        for (const [paramKey, paramValue] of Object.entries(params)) {
            result = result.replace(new RegExp(`{${paramKey}}`, 'g'), paramValue);
        }
        
        return result;
    } catch (error) {
        logger.error(`Error al traducir ${key} a ${lang}: ${error.message}`);
        return key;
    }
}

/**
 * Detecta el idioma de un texto
 * @param {string} text - Texto a analizar
 * @returns {string} - Código de idioma detectado
 */
function detectLanguage(text) {
    if (!text || typeof text !== 'string') {
        return DEFAULT_LANGUAGE;
    }
    
    // Palabras comunes en diferentes idiomas
    const commonWords = {
        es: ['hola', 'gracias', 'por favor', 'ayuda', 'quiero', 'necesito', 'como', 'qué', 'cuándo', 'dónde', 'bueno', 'malo', 'sí', 'no'],
        en: ['hello', 'thanks', 'please', 'help', 'want', 'need', 'how', 'what', 'when', 'where', 'good', 'bad', 'yes', 'no'],
        pt: ['ola', 'obrigado', 'por favor', 'ajuda', 'quero', 'preciso', 'como', 'que', 'quando', 'onde', 'bom', 'mau', 'sim', 'não'],
        fr: ['bonjour', 'merci', 's\'il vous plaît', 'aide', 'veux', 'besoin', 'comment', 'quoi', 'quand', 'où', 'bon', 'mauvais', 'oui', 'non'],
        it: ['ciao', 'grazie', 'per favore', 'aiuto', 'voglio', 'bisogno', 'come', 'cosa', 'quando', 'dove', 'buono', 'cattivo', 'sì', 'no'],
        de: ['hallo', 'danke', 'bitte', 'hilfe', 'will', 'brauche', 'wie', 'was', 'wann', 'wo', 'gut', 'schlecht', 'ja', 'nein']
    };
    
    // Convertir a minúsculas
    const lowerText = text.toLowerCase();
    
    // Contar coincidencias por idioma
    const matches = {};
    
    for (const [lang, words] of Object.entries(commonWords)) {
        matches[lang] = 0;
        
        for (const word of words) {
            // Buscar palabra completa
            const regex = new RegExp(`\\b${word}\\b`, 'g');
            const count = (lowerText.match(regex) || []).length;
            matches[lang] += count;
        }
    }
    
    // Encontrar el idioma con más coincidencias
    let bestMatch = DEFAULT_LANGUAGE;
    let maxMatches = 0;
    
    for (const [lang, count] of Object.entries(matches)) {
        if (count > maxMatches) {
            maxMatches = count;
            bestMatch = lang;
        }
    }
    
    return bestMatch;
}

/**
 * Obtiene todos los idiomas soportados
 * @returns {Array} - Lista de idiomas soportados
 */
function getSupportedLanguages() {
    return SUPPORTED_LANGUAGES.map(lang => {
        const name = getLanguageName(lang);
        return { code: lang, name };
    });
}

/**
 * Obtiene el nombre de un idioma
 * @param {string} lang - Código de idioma
 * @returns {string} - Nombre del idioma
 */
function getLanguageName(lang) {
    const names = {
        es: 'Español',
        en: 'English',
        pt: 'Português',
        fr: 'Français',
        it: 'Italiano',
        de: 'Deutsch'
    };
    
    return names[lang] || lang;
}

module.exports = {
    initialize,
    translate,
    detectLanguage,
    getSupportedLanguages,
    getLanguageName,
    SUPPORTED_LANGUAGES,
    DEFAULT_LANGUAGE
};
