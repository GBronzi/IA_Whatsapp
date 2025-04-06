/**
 * notification-manager.js - Módulo para gestionar notificaciones y alertas
 */

const path = require('path');
const fs = require('fs').promises;
const { app, Notification } = require('electron');
const logger = require('./logger');

// Configuración
const NOTIFICATION_SOUNDS_DIR = path.join(__dirname, 'electron', 'assets', 'sounds');
const NOTIFICATION_CONFIG_PATH = path.join(app.getPath('userData'), 'notification-config.json');

// Estado de notificaciones
let notificationConfig = {
  enableSounds: true,
  enableDesktopNotifications: true,
  enableInAppNotifications: true,
  soundVolume: 0.8,
  defaultSound: 'alert.mp3',
  prioritySounds: {
    high: 'urgent.mp3',
    medium: 'notification.mp3',
    low: 'info.mp3'
  },
  notificationHistory: [],
  maxHistoryItems: 100
};

// Cargar configuración
async function loadConfig() {
  try {
    // Verificar si existe el archivo de configuración
    try {
      await fs.access(NOTIFICATION_CONFIG_PATH);
    } catch (error) {
      // Si no existe, crear uno con valores por defecto
      await saveConfig();
      return;
    }
    
    // Leer archivo de configuración
    const data = await fs.readFile(NOTIFICATION_CONFIG_PATH, 'utf8');
    const config = JSON.parse(data);
    
    // Actualizar configuración
    notificationConfig = {
      ...notificationConfig,
      ...config
    };
    
    logger.info('Configuración de notificaciones cargada correctamente');
  } catch (error) {
    logger.error(`Error al cargar configuración de notificaciones: ${error.message}`);
  }
}

// Guardar configuración
async function saveConfig() {
  try {
    await fs.writeFile(NOTIFICATION_CONFIG_PATH, JSON.stringify(notificationConfig, null, 2));
    logger.info('Configuración de notificaciones guardada correctamente');
  } catch (error) {
    logger.error(`Error al guardar configuración de notificaciones: ${error.message}`);
  }
}

// Inicializar módulo
async function initialize() {
  try {
    // Cargar configuración
    await loadConfig();
    
    // Crear directorio de sonidos si no existe
    try {
      await fs.access(NOTIFICATION_SOUNDS_DIR);
    } catch (error) {
      await fs.mkdir(NOTIFICATION_SOUNDS_DIR, { recursive: true });
    }
    
    // Verificar sonidos predeterminados
    await ensureDefaultSounds();
    
    logger.info('Módulo de notificaciones inicializado correctamente');
    return true;
  } catch (error) {
    logger.error(`Error al inicializar módulo de notificaciones: ${error.message}`);
    return false;
  }
}

// Asegurar que existan los sonidos predeterminados
async function ensureDefaultSounds() {
  const defaultSounds = [
    { name: 'alert.mp3', url: 'https://github.com/tuempresa/whatsapp-assistant/raw/main/sounds/alert.mp3' },
    { name: 'urgent.mp3', url: 'https://github.com/tuempresa/whatsapp-assistant/raw/main/sounds/urgent.mp3' },
    { name: 'notification.mp3', url: 'https://github.com/tuempresa/whatsapp-assistant/raw/main/sounds/notification.mp3' },
    { name: 'info.mp3', url: 'https://github.com/tuempresa/whatsapp-assistant/raw/main/sounds/info.mp3' }
  ];
  
  for (const sound of defaultSounds) {
    const soundPath = path.join(NOTIFICATION_SOUNDS_DIR, sound.name);
    
    try {
      await fs.access(soundPath);
    } catch (error) {
      // Si no existe, crear un archivo vacío (en una aplicación real, descargarías el sonido)
      await fs.writeFile(soundPath, '');
      logger.info(`Archivo de sonido creado: ${sound.name}`);
    }
  }
}

/**
 * Envía una notificación
 * @param {Object} options - Opciones de la notificación
 * @returns {Promise<boolean>} - true si la notificación se envió correctamente
 */
async function sendNotification(options = {}) {
  try {
    const {
      title = 'Asistente de Ventas WhatsApp',
      body,
      priority = 'medium',
      requiresHumanAttention = false,
      chatId,
      clientName,
      timestamp = new Date().toISOString(),
      actions = [],
      data = {}
    } = options;
    
    // Validar datos requeridos
    if (!body) {
      throw new Error('El cuerpo de la notificación es obligatorio');
    }
    
    // Crear objeto de notificación
    const notification = {
      id: Date.now().toString(),
      title,
      body,
      priority,
      requiresHumanAttention,
      chatId,
      clientName,
      timestamp,
      actions,
      data,
      read: false
    };
    
    // Guardar en historial
    addToHistory(notification);
    
    // Enviar notificación según configuración
    if (notificationConfig.enableDesktopNotifications) {
      sendDesktopNotification(notification);
    }
    
    if (notificationConfig.enableInAppNotifications) {
      sendInAppNotification(notification);
    }
    
    if (notificationConfig.enableSounds) {
      playNotificationSound(notification.priority);
    }
    
    // Registrar en log
    logger.info(`Notificación enviada: ${notification.title} - ${notification.body}`);
    
    return true;
  } catch (error) {
    logger.error(`Error al enviar notificación: ${error.message}`);
    return false;
  }
}

/**
 * Envía una notificación de escritorio
 * @param {Object} notification - Objeto de notificación
 */
function sendDesktopNotification(notification) {
  try {
    // Verificar si las notificaciones son soportadas
    if (!Notification.isSupported()) {
      logger.warn('Las notificaciones de escritorio no son soportadas en este sistema');
      return;
    }
    
    // Crear notificación
    const desktopNotification = new Notification({
      title: notification.title,
      body: notification.body,
      icon: path.join(__dirname, 'electron', 'assets', 'icon.png'),
      silent: true // Silenciar sonido nativo, usaremos nuestro propio sistema de sonido
    });
    
    // Mostrar notificación
    desktopNotification.show();
    
    // Manejar clic en la notificación
    desktopNotification.on('click', () => {
      // Emitir evento para que la aplicación principal lo maneje
      global.notificationClick && global.notificationClick(notification);
    });
  } catch (error) {
    logger.error(`Error al enviar notificación de escritorio: ${error.message}`);
  }
}

/**
 * Envía una notificación dentro de la aplicación
 * @param {Object} notification - Objeto de notificación
 */
function sendInAppNotification(notification) {
  try {
    // Emitir evento para que la aplicación principal lo maneje
    global.inAppNotification && global.inAppNotification(notification);
  } catch (error) {
    logger.error(`Error al enviar notificación in-app: ${error.message}`);
  }
}

/**
 * Reproduce un sonido de notificación
 * @param {string} priority - Prioridad de la notificación
 */
function playNotificationSound(priority = 'medium') {
  try {
    // Determinar qué sonido reproducir
    let soundFile;
    
    if (priority === 'high') {
      soundFile = notificationConfig.prioritySounds.high;
    } else if (priority === 'medium') {
      soundFile = notificationConfig.prioritySounds.medium;
    } else if (priority === 'low') {
      soundFile = notificationConfig.prioritySounds.low;
    } else {
      soundFile = notificationConfig.defaultSound;
    }
    
    // Ruta completa al archivo de sonido
    const soundPath = path.join(NOTIFICATION_SOUNDS_DIR, soundFile);
    
    // Emitir evento para que la aplicación principal reproduzca el sonido
    global.playSound && global.playSound(soundPath, notificationConfig.soundVolume);
  } catch (error) {
    logger.error(`Error al reproducir sonido de notificación: ${error.message}`);
  }
}

/**
 * Añade una notificación al historial
 * @param {Object} notification - Objeto de notificación
 */
function addToHistory(notification) {
  // Añadir al inicio del array
  notificationConfig.notificationHistory.unshift(notification);
  
  // Limitar tamaño del historial
  if (notificationConfig.notificationHistory.length > notificationConfig.maxHistoryItems) {
    notificationConfig.notificationHistory = notificationConfig.notificationHistory.slice(0, notificationConfig.maxHistoryItems);
  }
  
  // Guardar configuración
  saveConfig().catch(error => {
    logger.error(`Error al guardar historial de notificaciones: ${error.message}`);
  });
}

/**
 * Obtiene el historial de notificaciones
 * @param {Object} filters - Filtros para el historial
 * @returns {Array} - Historial de notificaciones
 */
function getNotificationHistory(filters = {}) {
  try {
    const {
      limit = notificationConfig.maxHistoryItems,
      onlyUnread = false,
      priority,
      requiresHumanAttention
    } = filters;
    
    // Filtrar notificaciones
    let filteredHistory = [...notificationConfig.notificationHistory];
    
    if (onlyUnread) {
      filteredHistory = filteredHistory.filter(n => !n.read);
    }
    
    if (priority) {
      filteredHistory = filteredHistory.filter(n => n.priority === priority);
    }
    
    if (requiresHumanAttention !== undefined) {
      filteredHistory = filteredHistory.filter(n => n.requiresHumanAttention === requiresHumanAttention);
    }
    
    // Limitar resultados
    return filteredHistory.slice(0, limit);
  } catch (error) {
    logger.error(`Error al obtener historial de notificaciones: ${error.message}`);
    return [];
  }
}

/**
 * Marca una notificación como leída
 * @param {string} notificationId - ID de la notificación
 * @returns {boolean} - true si la notificación se marcó como leída
 */
function markAsRead(notificationId) {
  try {
    // Buscar notificación
    const notification = notificationConfig.notificationHistory.find(n => n.id === notificationId);
    
    if (!notification) {
      return false;
    }
    
    // Marcar como leída
    notification.read = true;
    
    // Guardar configuración
    saveConfig().catch(error => {
      logger.error(`Error al guardar estado de notificación: ${error.message}`);
    });
    
    return true;
  } catch (error) {
    logger.error(`Error al marcar notificación como leída: ${error.message}`);
    return false;
  }
}

/**
 * Marca todas las notificaciones como leídas
 * @returns {boolean} - true si las notificaciones se marcaron como leídas
 */
function markAllAsRead() {
  try {
    // Marcar todas como leídas
    notificationConfig.notificationHistory.forEach(n => {
      n.read = true;
    });
    
    // Guardar configuración
    saveConfig().catch(error => {
      logger.error(`Error al guardar estado de notificaciones: ${error.message}`);
    });
    
    return true;
  } catch (error) {
    logger.error(`Error al marcar todas las notificaciones como leídas: ${error.message}`);
    return false;
  }
}

/**
 * Actualiza la configuración de notificaciones
 * @param {Object} config - Nueva configuración
 * @returns {boolean} - true si la configuración se actualizó correctamente
 */
async function updateConfig(config = {}) {
  try {
    // Actualizar configuración
    notificationConfig = {
      ...notificationConfig,
      ...config
    };
    
    // Guardar configuración
    await saveConfig();
    
    return true;
  } catch (error) {
    logger.error(`Error al actualizar configuración de notificaciones: ${error.message}`);
    return false;
  }
}

/**
 * Envía una notificación de asistencia humana requerida
 * @param {Object} options - Opciones de la notificación
 * @returns {Promise<boolean>} - true si la notificación se envió correctamente
 */
async function sendHumanAssistanceNotification(options = {}) {
  try {
    const {
      chatId,
      clientName = 'Cliente',
      reason = 'El cliente ha solicitado hablar con un agente humano',
      priority = 'high',
      data = {}
    } = options;
    
    // Validar datos requeridos
    if (!chatId) {
      throw new Error('El ID de chat es obligatorio');
    }
    
    // Crear título y cuerpo de la notificación
    const title = '¡Se requiere asistencia humana!';
    const body = `${clientName} (${chatId}) necesita atención: ${reason}`;
    
    // Enviar notificación
    return await sendNotification({
      title,
      body,
      priority,
      requiresHumanAttention: true,
      chatId,
      clientName,
      actions: [
        {
          id: 'view',
          label: 'Ver conversación'
        },
        {
          id: 'respond',
          label: 'Responder'
        }
      ],
      data: {
        ...data,
        reason
      }
    });
  } catch (error) {
    logger.error(`Error al enviar notificación de asistencia humana: ${error.message}`);
    return false;
  }
}

module.exports = {
  initialize,
  sendNotification,
  sendHumanAssistanceNotification,
  getNotificationHistory,
  markAsRead,
  markAllAsRead,
  updateConfig
};
