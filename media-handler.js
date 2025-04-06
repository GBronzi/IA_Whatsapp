/**
 * media-handler.js - Módulo para manejar diferentes tipos de medios en WhatsApp
 */

const fs = require('fs').promises;
const path = require('path');
const { MessageMedia } = require('whatsapp-web.js');
const config = require('./config');

// Directorio para guardar medios recibidos
const MEDIA_DIR = path.join(__dirname, 'media');

// Asegurar que el directorio de medios existe
async function ensureMediaDir() {
    try {
        await fs.mkdir(MEDIA_DIR, { recursive: true });
    } catch (error) {
        console.error('Error al crear directorio de medios:', error);
    }
}

// Guardar un archivo de media recibido
async function saveMedia(media, chatId, type) {
    await ensureMediaDir();
    
    // Generar nombre de archivo único
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${chatId.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}_${type}`;
    const extension = getExtensionFromMimeType(media.mimetype);
    const filepath = path.join(MEDIA_DIR, `${filename}.${extension}`);
    
    try {
        // Decodificar y guardar el archivo
        const buffer = Buffer.from(media.data, 'base64');
        await fs.writeFile(filepath, buffer);
        
        return {
            filename: `${filename}.${extension}`,
            filepath,
            mimetype: media.mimetype
        };
    } catch (error) {
        console.error('Error al guardar archivo de media:', error);
        return null;
    }
}

// Obtener extensión de archivo basada en el tipo MIME
function getExtensionFromMimeType(mimetype) {
    const mimeMap = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'audio/ogg': 'ogg',
        'audio/mpeg': 'mp3',
        'audio/mp4': 'mp4',
        'video/mp4': 'mp4',
        'application/pdf': 'pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'text/plain': 'txt',
        'application/json': 'json'
    };
    
    return mimeMap[mimetype] || 'bin';
}

// Crear un objeto MessageMedia para enviar
async function createMedia(filepath, filename, mimetype) {
    try {
        const data = await fs.readFile(filepath, { encoding: 'base64' });
        return new MessageMedia(mimetype, data, filename);
    } catch (error) {
        console.error('Error al crear objeto MessageMedia:', error);
        return null;
    }
}

// Procesar un mensaje con media
async function processMediaMessage(msg, chatId) {
    try {
        if (!msg.hasMedia) return null;
        
        const media = await msg.downloadMedia();
        if (!media || !media.data) {
            console.warn('No se pudo descargar el media del mensaje');
            return null;
        }
        
        // Determinar tipo de media
        let mediaType = 'unknown';
        if (media.mimetype.startsWith('image/')) mediaType = 'image';
        else if (media.mimetype.startsWith('audio/')) mediaType = 'audio';
        else if (media.mimetype.startsWith('video/')) mediaType = 'video';
        else if (media.mimetype === 'application/pdf') mediaType = 'pdf';
        else if (media.mimetype.includes('document')) mediaType = 'document';
        
        // Guardar el archivo
        const savedMedia = await saveMedia(media, chatId, mediaType);
        if (!savedMedia) return null;
        
        return {
            type: mediaType,
            ...savedMedia
        };
    } catch (error) {
        console.error('Error al procesar mensaje con media:', error);
        return null;
    }
}

// Generar descripción textual del media para el historial
function getMediaDescription(mediaInfo) {
    if (!mediaInfo) return '';
    
    const typeMap = {
        'image': '📷 [Imagen]',
        'audio': '🔊 [Audio]',
        'video': '🎬 [Video]',
        'pdf': '📄 [PDF]',
        'document': '📎 [Documento]',
        'unknown': '📁 [Archivo]'
    };
    
    return `${typeMap[mediaInfo.type] || typeMap.unknown} ${mediaInfo.filename}`;
}

module.exports = {
    processMediaMessage,
    getMediaDescription,
    createMedia,
    saveMedia
};
