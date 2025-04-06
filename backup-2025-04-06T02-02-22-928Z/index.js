/**
 * index.js - Asistente de WhatsApp conversacional con IA (Ollama),
 * recolección de datos dirigida por IA y almacenamiento en Google Sheets.
 * Versión mejorada con modularización, persistencia y manejo de medios.
 */

// --- Dependencias ---
const { Client, LocalAuth } = require('whatsapp-web.js');
const { google } = require('googleapis');
const path = require('path');
const qrcode = require('qrcode-terminal');

// --- Módulos propios ---
const config = require('./config');
const logger = require('./logger');
const db = require('./database');
const mediaHandler = require('./media-handler');
const messageQueue = require('./message-queue');
const aiService = require('./ai-service');

// --- Inicialización ---
// Inicializar base de datos
db.initializeDatabase();

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
async function saveMessageToGoogleSheets({ chatId, nombre, mensaje, tipo, mediaInfo = null }) {
    if (!sheetsClient) {
        logger.warn('Cliente de Google Sheets no inicializado. No se guardará el mensaje.');
        return false;
    }
    
    try {
        // Si hay información de media, añadirla al mensaje
        const mensajeCompleto = mediaInfo 
            ? `${mensaje} ${mediaHandler.getMediaDescription(mediaInfo)}`
            : mensaje;
            
        await sheetsClient.spreadsheets.values.append({
            spreadsheetId: config.SPREADSHEET_ID,
            range: 'Mensajes!A:E',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[
                    new Date().toISOString(),
                    chatId,
                    nombre || 'Desconocido',
                    tipo,
                    mensajeCompleto
                ]]
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
            range: 'Datos!A:G',
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[
                    chatId,
                    data.nombre || '',
                    data.correo || '',
                    data.telefono || '',
                    data.curso || '',
                    data.pago || '',
                    new Date().toISOString()
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
        mediaInfo 
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

    // --- Procesamiento principal ---
    try {
        // Mostrar indicador de "escribiendo..."
        const chat = await msg.getChat();
        await chat.sendStateTyping();

        // Obtener historial de chat
        const dbHistory = await db.getChatHistory(chatId);
        const history = db.formatHistoryForApp(dbHistory);

        // Llamar a la IA
        const { response: aiResponse, extractedData } = await aiService.callOllamaAndProcess(
            chatId, 
            history,
            clientData || {}
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

logger.info(`Asistente de WhatsApp (${config.BUSINESS_NAME}) iniciado. Esperando conexión y eventos...`);
