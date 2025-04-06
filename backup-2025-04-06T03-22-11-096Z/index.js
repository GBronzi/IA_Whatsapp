/**
 * index.js - Asistente de WhatsApp conversacional con IA (Ollama),
 * recolección de datos dirigida por IA y almacenamiento en Google Sheets.
 * Versión mejorada con modularización, persistencia, manejo de medios,
 * análisis de sentimiento, reconocimiento de intenciones e integración con Bitrix24.
 */

// --- Dependencias ---
const { Client, LocalAuth } = require('whatsapp-web.js');
const { google } = require('googleapis');
const path = require('path');
const qrcode = require('qrcode-terminal');
const si = require('systeminformation');

// --- Módulos propios ---
const config = require('./config');
const logger = require('./logger');
const db = require('./database');
const mediaHandler = require('./media-handler');
const messageQueue = require('./message-queue');
const aiService = require('./ai-service');
const sentimentAnalyzer = require('./sentiment-analyzer');
const intentRecognizer = require('./intent-recognizer');
const productsService = require('./products-service');
const bitrix24Integration = require('./bitrix24-integration');

// --- Variables globales ---
let systemResources = {
    ram: 8, // GB, valor por defecto
    cpu: {
        cores: 4,
        speed: 2.5
    }
};

// --- Inicialización ---
// Inicializar base de datos
db.initializeDatabase();

// Inicializar integración con Bitrix24
let bitrix24;
try {
    bitrix24 = bitrix24Integration.initialize({
        webhook: process.env.BITRIX24_WEBHOOK || ''
    });
    logger.info('Integración con Bitrix24 inicializada correctamente');
} catch (error) {
    logger.error(`Error al inicializar integración con Bitrix24: ${error.message}`);
}

// --- Cliente de Google Sheets ---
let sheetsClient;
async function initializeGoogleSheetsClient() {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: config.CREDENTIALS_PATH,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        sheetsClient = google.sheets({ version: 'v4', auth });
        logger.info('Cliente de Google Sheets inicializado correctamente.');
    } catch (error) {
        logger.error(`Error al inicializar Google Sheets: ${error.message}`, { error });
        logger.error(`Asegúrate de que el archivo "${config.CREDENTIALS_PATH}" existe y es válido.`);
    }
}

// --- Inicialización del Cliente de WhatsApp ---
logger.info('Inicializando cliente de WhatsApp...');
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: config.SESSIONS_PATH,
        clientId: config.CLIENT_ID
    }),
    puppeteer: {
        headless: config.PUPPETEER_HEADLESS,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
        ]
    },
});

// --- Funciones de sistema ---
/**
 * Obtiene información de recursos del sistema
 */
async function getSystemResources() {
    try {
        // Obtener información de memoria
        const memInfo = await si.mem();
        systemResources.ram = Math.round(memInfo.total / 1024 / 1024 / 1024); // Convertir a GB

        // Obtener información de CPU
        const cpuInfo = await si.cpu();
        systemResources.cpu = {
            cores: cpuInfo.cores,
            speed: cpuInfo.speed
        };

        logger.info(`Recursos del sistema: RAM ${systemResources.ram}GB, CPU ${systemResources.cpu.cores} cores @ ${systemResources.cpu.speed}GHz`);

        // Obtener modelos de IA recomendados según recursos
        const recommendedModels = aiService.getRecommendedModels(systemResources);
        if (recommendedModels.length > 0) {
            logger.info(`Modelo de IA recomendado: ${recommendedModels[0].name}`);
            // Actualizar configuración si es necesario
            if (recommendedModels[0].id !== config.OLLAMA_MODEL) {
                logger.info(`Usando modelo recomendado: ${recommendedModels[0].id} en lugar de ${config.OLLAMA_MODEL}`);
                process.env.OLLAMA_MODEL = recommendedModels[0].id;
            }
        }
    } catch (error) {
        logger.error(`Error al obtener información del sistema: ${error.message}`);
    }
}

// --- Funciones de limpieza ---
/**
 * Limpia chats inactivos para liberar memoria
 */
async function cleanInactiveChats() {
    try {
        const inactiveChats = await db.getInactiveChats(config.INACTIVITY_THRESHOLD_MS);
        if (inactiveChats.length > 0) {
            logger.info(`Limpiando ${inactiveChats.length} chats inactivos...`);
            for (const chatId of inactiveChats) {
                // Limpiar cola de mensajes
                messageQueue.clearQueue(chatId);
                // No eliminamos datos de cliente, solo historial de chat
                await db.deleteChatHistory(chatId);
            }
            logger.info(`${inactiveChats.length} chats inactivos limpiados.`);
        }
    } catch (error) {
        logger.error(`Error al limpiar chats inactivos: ${error.message}`, { error });
    }
}

// Ejecuta la limpieza cada 6 horas
setInterval(cleanInactiveChats, 6 * 60 * 60 * 1000);

// --- Funciones de Google Sheets ---
/** Guarda un mensaje individual en la hoja "Mensajes" de Google Sheets. */
async function saveMessageToGoogleSheets({ chatId, nombre, mensaje, tipo, mediaInfo = null, sentimentInfo = null }) {
    if (!sheetsClient) {
        logger.warn('Cliente de Google Sheets no inicializado. No se guardará el mensaje.');
        return false;
    }

    try {
        // Si hay información de media, añadirla al mensaje
        const mensajeCompleto = mediaInfo
            ? `${mensaje} ${mediaHandler.getMediaDescription(mediaInfo)}`
            : mensaje;

        // Preparar datos para guardar
        const rowData = [
            new Date().toISOString(),
            chatId,
            nombre || 'Desconocido',
            tipo,
            mensajeCompleto
        ];

        // Añadir información de sentimiento si está disponible
        if (sentimentInfo) {
            rowData.push(sentimentInfo.sentiment);
            rowData.push(sentimentInfo.score.toString());
            rowData.push(sentimentInfo.urgency.toString());
        }

        await sheetsClient.spreadsheets.values.append({
            spreadsheetId: config.SPREADSHEET_ID,
            range: 'Mensajes!A:H',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [rowData]
            }
        });
        return true;
    } catch (error) {
        logger.error(`Error al guardar mensaje en Google Sheets: ${error.message}`, { chatId, tipo });
        return false;
    }
}

/** Guarda los datos estructurados del cliente en la hoja "Datos" de Google Sheets. */
async function saveStructuredDataToGoogleSheets(chatId, data) {
    if (!sheetsClient) {
        logger.warn('Cliente de Google Sheets no inicializado. No se guardarán los datos estructurados.');
        return false;
    }

    // Validar que tenemos algún dato útil antes de guardar
    if (!data || Object.values(data).every(val => !val)) {
        logger.debug(`No se encontraron datos estructurados válidos para guardar para ${chatId}.`);
        return false;
    }

    logger.info(`Guardando datos estructurados para ${chatId}`);
    logger.debug('Datos a guardar:', { data });

    try {
        await sheetsClient.spreadsheets.values.append({
            spreadsheetId: config.SPREADSHEET_ID,
            range: 'Datos!A:H',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[
                    chatId,
                    data.nombre || '',
                    data.correo || '',
                    data.telefono || '',
                    data.curso || '',
                    data.pago || '',
                    new Date().toISOString(),
                    data.fuente || 'WhatsApp'
                ]]
            }
        });
        logger.info(`Datos estructurados guardados correctamente para ${chatId}`);
        return true;
    } catch (error) {
        logger.error(`Error al guardar datos estructurados en Google Sheets: ${error.message}`, { chatId });
        return false;
    }
}

// --- Procesamiento de mensajes ---
/**
 * Procesa un mensaje de WhatsApp
 * @param {Object} msg - Objeto de mensaje de WhatsApp
 * @returns {Promise<void>}
 */
async function processMessage(msg) {
    // Ignorar mensajes de grupos, estados, y propios
    if (msg.from.endsWith('@g.us') || msg.from === 'status@broadcast' || msg.fromMe) {
        return;
    }

    const chatId = msg.from;
    const userMessage = msg.body.trim();
    const lowerCaseMessage = userMessage.toLowerCase();

    // Obtener datos del cliente si existen
    let clientData = await db.getClientData(chatId);

    // Procesar media si existe
    let mediaInfo = null;
    if (msg.hasMedia) {
        mediaInfo = await mediaHandler.processMediaMessage(msg, chatId);
        logger.info(`Media procesado para ${chatId}: ${mediaInfo?.type || 'desconocido'}`);
    }

    // Analizar sentimiento del mensaje
    const sentimentInfo = sentimentAnalyzer.analyzeSentiment(userMessage);
    logger.info(`Análisis de sentimiento para ${chatId}: ${sentimentInfo.sentiment} (score: ${sentimentInfo.score}, urgencia: ${sentimentInfo.urgency})`);

    // Reconocer intenciones del mensaje
    const intentInfo = intentRecognizer.recognizeIntents(userMessage);
    if (intentInfo.primaryIntent) {
        logger.info(`Intención reconocida para ${chatId}: ${intentInfo.primaryIntent} (confianza: ${intentInfo.confidence.toFixed(2)})`);
    }

    // Guardar mensaje del usuario en la base de datos
    await db.saveMessage(
        chatId,
        clientData?.nombre || 'Usuario',
        'user',
        mediaInfo ? `${userMessage} [Media: ${mediaInfo.type}]` : userMessage
    );

    // Guardar mensaje en Google Sheets
    await saveMessageToGoogleSheets({
        chatId,
        nombre: clientData?.nombre,
        mensaje: userMessage,
        tipo: 'Usuario',
        mediaInfo,
        sentimentInfo
    });

    // --- Comando de Reinicio ---
    if (lowerCaseMessage === 'reiniciar') {
        // Eliminar historial de chat
        await db.deleteChatHistory(chatId);

        const replyMsg = '¡Claro! Hemos reiniciado nuestra conversación. ¿En qué puedo ayudarte?';

        // Guardar mensaje de reinicio
        await db.saveMessage(chatId, 'Bot', 'assistant', replyMsg);
        await saveMessageToGoogleSheets({ chatId, nombre: 'Bot', mensaje: replyMsg, tipo: 'Bot' });

        // Enviar mensaje
        await client.sendMessage(chatId, replyMsg);
        return;
    }

    // --- Comando para hablar con humano ---
    if (lowerCaseMessage.includes('hablar con humano') ||
        lowerCaseMessage.includes('hablar con persona') ||
        lowerCaseMessage.includes('agente humano') ||
        intentInfo.primaryIntent === 'SPEAK_AGENT') {

        const replyMsg = 'Entiendo que prefieras hablar con una persona. Voy a notificar a uno de nuestros agentes para que te contacte lo antes posible. Mientras tanto, ¿hay algo más en lo que pueda ayudarte?';

        // Guardar mensaje
        await db.saveMessage(chatId, 'Bot', 'assistant', replyMsg);
        await saveMessageToGoogleSheets({ chatId, nombre: 'Bot', mensaje: replyMsg, tipo: 'Bot' });

        // Enviar mensaje
        await client.sendMessage(chatId, replyMsg);

        // Enviar notificación de asistencia humana requerida
        try {
            // Verificar si el gestor de notificaciones está disponible
            if (global.notificationManager) {
                await global.notificationManager.sendHumanAssistanceNotification({
                    chatId,
                    clientName: clientData?.nombre || 'Cliente',
                    reason: 'El cliente ha solicitado hablar con un agente humano',
                    priority: 'high',
                    data: {
                        message: userMessage,
                        timestamp: new Date().toISOString()
                    }
                });

                logger.info(`Notificación de asistencia humana enviada para ${chatId}`);
            }
        } catch (error) {
            logger.error(`Error al enviar notificación de asistencia humana: ${error.message}`);
        }

        // Notificar a través de Bitrix24 si está configurado
        if (bitrix24) {
            try {
                const contactData = {
                    nombre: clientData?.nombre || 'Cliente de WhatsApp',
                    telefono: chatId.split('@')[0],
                    correo: clientData?.correo || '',
                    comentarios: 'Solicitud de contacto con agente humano'
                };

                await bitrix24.syncClientData(contactData);
                logger.info(`Solicitud de agente humano registrada en Bitrix24 para ${chatId}`);
            } catch (error) {
                logger.error(`Error al registrar solicitud en Bitrix24: ${error.message}`);
            }
        }

        return;
    }

    // --- Procesamiento principal ---
    try {
        // Mostrar indicador de "escribiendo..."
        const chat = await msg.getChat();
        await chat.sendStateTyping();

        // Obtener historial de chat
        const dbHistory = await db.getChatHistory(chatId);
        const history = db.formatHistoryForApp(dbHistory);

        // Llamar a la IA con contexto adicional
        const { response: aiResponse, extractedData, context } = await aiService.callOllamaAndProcess(
            chatId,
            history,
            clientData || {},
            {
                // Pasar información adicional
                sentimentInfo,
                intentInfo
            }
        );

        // Detener indicador de "escribiendo..."
        await chat.clearState();

        if (aiResponse) {
            // Enviar respuesta
            await client.sendMessage(chatId, aiResponse);

            // Guardar respuesta en la base de datos
            await db.saveMessage(chatId, 'Bot', 'assistant', aiResponse);

            // Guardar respuesta en Google Sheets
            await saveMessageToGoogleSheets({ chatId, nombre: 'Bot', mensaje: aiResponse, tipo: 'Bot' });

            // Si se extrajeron datos, guardarlos
            if (extractedData && Object.keys(extractedData).length > 0) {
                // Combinar con datos existentes
                const updatedData = { ...(clientData || {}), ...extractedData };

                // Guardar en la base de datos
                await db.saveClientData(chatId, updatedData);

                // Guardar en Google Sheets
                await saveStructuredDataToGoogleSheets(chatId, updatedData);

                // Sincronizar con Bitrix24 si está configurado
                if (bitrix24) {
                    try {
                        await bitrix24.syncClientData(updatedData);
                        logger.info(`Datos sincronizados con Bitrix24 para ${chatId}`);
                    } catch (error) {
                        logger.error(`Error al sincronizar con Bitrix24: ${error.message}`);
                    }
                }
            }

            // Si el sentimiento es muy negativo o hay urgencia alta, notificar
            if ((sentimentInfo.sentiment === 'very_negative' && sentimentInfo.score < -3) || sentimentInfo.urgency >= 8) {
                logger.warn(`Cliente con sentimiento negativo o urgencia alta detectado: ${chatId}`);

                // Enviar notificación de asistencia humana requerida
                try {
                    // Verificar si el gestor de notificaciones está disponible
                    if (global.notificationManager) {
                        await global.notificationManager.sendHumanAssistanceNotification({
                            chatId,
                            clientName: clientData?.nombre || 'Cliente',
                            reason: `Cliente con ${sentimentInfo.sentiment === 'very_negative' ? 'sentimiento muy negativo' : 'urgencia alta'} detectado.`,
                            priority: 'high',
                            data: {
                                message: userMessage,
                                sentiment: sentimentInfo.sentiment,
                                score: sentimentInfo.score,
                                urgency: sentimentInfo.urgency,
                                timestamp: new Date().toISOString()
                            }
                        });

                        logger.info(`Notificación de asistencia humana enviada para ${chatId} por sentimiento negativo o urgencia alta`);
                    }
                } catch (error) {
                    logger.error(`Error al enviar notificación de asistencia humana: ${error.message}`);
                }

                // Notificar a través de Bitrix24 si está configurado
                if (bitrix24) {
                    try {
                        const contactData = {
                            nombre: clientData?.nombre || 'Cliente de WhatsApp',
                            telefono: chatId.split('@')[0],
                            correo: clientData?.correo || '',
                            comentarios: `Cliente con ${sentimentInfo.sentiment === 'very_negative' ? 'sentimiento muy negativo' : 'urgencia alta'} detectado. Requiere atención prioritaria.`
                        };

                        await bitrix24.syncClientData(contactData);
                        logger.info(`Alerta de sentimiento negativo o urgencia alta registrada en Bitrix24 para ${chatId}`);
                    } catch (error) {
                        logger.error(`Error al registrar alerta en Bitrix24: ${error.message}`);
                    }
                }

                // Si el sentimiento es extremadamente negativo, enviar mensaje de apoyo
                if (sentimentInfo.sentiment === 'very_negative' && sentimentInfo.score < -5) {
                    try {
                        const supportMsg = 'Noto que podrías estar experimentando alguna dificultad. Quiero asegurarte que estamos aquí para ayudarte. Un agente humano revisará tu caso lo antes posible para brindarte la mejor asistencia.';
                        await client.sendMessage(chatId, supportMsg);
                        await db.saveMessage(chatId, 'Bot', 'assistant', supportMsg);
                        await saveMessageToGoogleSheets({ chatId, nombre: 'Bot', mensaje: supportMsg, tipo: 'Bot' });
                    } catch (error) {
                        logger.error(`Error al enviar mensaje de apoyo: ${error.message}`);
                    }
                }
            }
        } else {
            logger.warn(`Respuesta vacía de la IA para ${chatId}`);
        }
    } catch (error) {
        logger.error(`Error procesando mensaje de ${chatId}: ${error.message}`, { error });

        // Limpiar estado de escritura
        try {
            const chat = await msg.getChat();
            await chat.clearState();
        } catch (clearStateError) {
            logger.error(`Error limpiando estado de escritura: ${clearStateError.message}`);
        }

        // Enviar mensaje de error
        try {
            const errorMsg = '¡Ups! Ocurrió un error inesperado procesando tu mensaje. Por favor, intenta de nuevo o escribe "reiniciar".';
            await client.sendMessage(chatId, errorMsg);
            await db.saveMessage(chatId, 'Bot', 'assistant', errorMsg + ' (Error interno)');
            await saveMessageToGoogleSheets({ chatId, nombre: 'Bot', mensaje: errorMsg + ' (Error interno)', tipo: 'Bot' });
        } catch (sendError) {
            logger.error(`Error GRAVE: No se pudo enviar mensaje de error a ${chatId}: ${sendError.message}`);
        }
    }
}

// --- Eventos del Cliente de WhatsApp ---
client.on('qr', (qr) => {
    logger.info('Código QR generado. Escanea con WhatsApp:');
    qrcode.generate(qr, { small: true });
    logger.info('--------------------------------------------------');
});

client.on('ready', () => {
    logger.info('========================================');
    logger.info('Cliente de WhatsApp CONECTADO Y LISTO!');
    logger.info('========================================');
    initializeGoogleSheetsClient();
    cleanInactiveChats();
    getSystemResources();
});

client.on('authenticated', () => {
    logger.info('Cliente de WhatsApp Autenticado.');
});

client.on('auth_failure', (msg) => {
    logger.error(`¡Fallo en la Autenticación de WhatsApp! ${msg}`);
});

client.on('disconnected', (reason) => {
    logger.warn(`Cliente de WhatsApp Desconectado: ${reason}`);
});

client.on('loading_screen', (percent, message) => {
    logger.info(`Cargando WhatsApp Web: ${percent}% - ${message}`);
});

// Manejar mensajes a través de la cola
client.on('message', (msg) => {
    messageQueue.enqueue(msg.from, async () => {
        await processMessage(msg);
    });
});

// --- Manejo de errores no capturados ---
process.on('uncaughtException', (error) => {
    logger.error(`Error no capturado: ${error.message}`, { error });
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Promesa rechazada no manejada: ${reason}`, { reason });
});

// --- Iniciar el Cliente ---
logger.info('Iniciando conexión con WhatsApp...');
client.initialize().catch(err => {
    logger.error(`Error fatal durante la inicialización del cliente: ${err.message}`, { error: err });
    process.exit(1);
});

// Cargar información de productos
productsService.loadProductsConfig().then(productsConfig => {
    const businessInfo = productsConfig.business || { name: 'Tu Empresa' };
    logger.info(`Asistente de WhatsApp (${businessInfo.name}) iniciado. Esperando conexión y eventos...`);
});
