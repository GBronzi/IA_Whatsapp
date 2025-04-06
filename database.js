/**
 * database.js - Módulo para manejar la persistencia de datos con SQLite
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Asegurar que el directorio de la base de datos existe
const dbDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Inicializar la base de datos
let db = null;

// Función para crear la conexión a la base de datos
function createConnection() {
    try {
        // Si ya hay una conexión abierta, cerrarla
        if (db) {
            try {
                db.close();
            } catch (closeError) {
                console.warn(`Advertencia al cerrar la conexión existente: ${closeError.message}`);
            }
        }

        // Crear nueva conexión
        db = new Database(config.DB_PATH, { verbose: config.LOG_LEVEL === 'debug' ? console.log : null });
        return true;
    } catch (error) {
        console.error(`Error al inicializar la base de datos: ${error.message}`);

        // Intentar crear una nueva base de datos
        try {
            // Si el archivo existe pero está corrupto, eliminarlo
            if (fs.existsSync(config.DB_PATH)) {
                fs.unlinkSync(config.DB_PATH);
                console.log('Base de datos corrupta eliminada. Creando una nueva...');
            }
            db = new Database(config.DB_PATH, { verbose: config.LOG_LEVEL === 'debug' ? console.log : null });
            return true;
        } catch (err) {
            console.error(`Error fatal al crear la base de datos: ${err.message}`);
            db = null;
            return false;
        }
    }
}

// Crear tablas si no existen
function initializeDatabase() {
    // Crear conexión a la base de datos
    if (!createConnection()) {
        throw new Error('No se pudo crear la conexión a la base de datos');
    }

    // Verificar si necesitamos actualizar la estructura de la base de datos
    try {
        // Verificar si la columna processed existe en la tabla messages
        const tableInfo = db.prepare("PRAGMA table_info(messages)").all();
        const processedColumnExists = tableInfo.some(column => column.name === 'processed');

        if (!processedColumnExists) {
            console.log('Actualizando estructura de la tabla messages...');
            db.prepare("ALTER TABLE messages ADD COLUMN processed INTEGER DEFAULT 0").run();
            console.log('Tabla messages actualizada correctamente.');
        }

        // Verificar si la columna message_id existe en la tabla messages
        const messageIdColumnExists = tableInfo.some(column => column.name === 'message_id');

        if (!messageIdColumnExists) {
            console.log('Actualizando estructura de la tabla messages para añadir message_id...');
            db.prepare("ALTER TABLE messages ADD COLUMN message_id TEXT").run();
            console.log('Tabla messages actualizada correctamente.');
        }
    } catch (error) {
        console.error('Error al actualizar estructura de la base de datos:', error);
    }
    // Tabla para mensajes
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            name TEXT,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            UNIQUE(chat_id, timestamp, role)
        )
    `);

    // Tabla para datos estructurados de clientes
    db.exec(`
        CREATE TABLE IF NOT EXISTS client_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            nombre TEXT,
            correo TEXT,
            telefono TEXT,
            curso TEXT,
            pago TEXT,
            UNIQUE(chat_id)
        )
    `);

    // Índices para mejorar rendimiento
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
        CREATE INDEX IF NOT EXISTS idx_client_data_chat_id ON client_data(chat_id);
    `);

    console.log('Base de datos inicializada correctamente.');
}

// Guardar un mensaje en la base de datos
function saveMessage(chatId, name, role, content, messageId = null, processed = 0) {
    const timestamp = new Date().toISOString();
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO messages (chat_id, timestamp, name, role, content, message_id, processed)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
        const result = stmt.run(chatId, timestamp, name || null, role, content, messageId, processed);
        return result.lastInsertRowid;
    } catch (error) {
        console.error('Error al guardar mensaje en la base de datos:', error);
        return null;
    }
}

// Obtener historial de mensajes para un chat
function getChatHistory(chatId, limit = 50) {
    const stmt = db.prepare(`
        SELECT * FROM messages
        WHERE chat_id = ?
        ORDER BY timestamp ASC
        LIMIT ?
    `);

    try {
        return stmt.all(chatId, limit);
    } catch (error) {
        console.error('Error al obtener historial de chat:', error);
        return [];
    }
}

// Guardar datos estructurados del cliente
function saveClientData(chatId, data) {
    const timestamp = new Date().toISOString();
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO client_data
        (chat_id, timestamp, nombre, correo, telefono, curso, pago)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    try {
        const result = stmt.run(
            chatId,
            timestamp,
            data.nombre || null,
            data.correo || null,
            data.telefono || null,
            data.curso || null,
            data.pago || null
        );
        return result.lastInsertRowid;
    } catch (error) {
        console.error('Error al guardar datos del cliente:', error);
        return null;
    }
}

// Obtener datos del cliente
function getClientData(chatId) {
    const stmt = db.prepare('SELECT * FROM client_data WHERE chat_id = ?');

    try {
        return stmt.get(chatId) || null;
    } catch (error) {
        console.error('Error al obtener datos del cliente:', error);
        return null;
    }
}

// Eliminar historial de chat
function deleteChatHistory(chatId) {
    const stmtMessages = db.prepare('DELETE FROM messages WHERE chat_id = ?');

    try {
        const result = stmtMessages.run(chatId);
        return result.changes;
    } catch (error) {
        console.error('Error al eliminar historial de chat:', error);
        return 0;
    }
}

// Obtener chats inactivos (para limpieza)
function getInactiveChats(thresholdMs) {
    const thresholdDate = new Date(Date.now() - thresholdMs).toISOString();
    const stmt = db.prepare(`
        SELECT DISTINCT chat_id FROM messages
        GROUP BY chat_id
        HAVING MAX(timestamp) < ?
    `);

    try {
        return stmt.all(thresholdDate).map(row => row.chat_id);
    } catch (error) {
        console.error('Error al obtener chats inactivos:', error);
        return [];
    }
}

// Convertir historial de la base de datos al formato usado por la aplicación
function formatHistoryForApp(dbHistory) {
    return dbHistory.map(msg => ({
        role: msg.role,
        content: msg.content
    }));
}

// Verificar si un mensaje ya ha sido procesado
function isMessageProcessed(messageId) {
    if (!messageId) return false;

    const stmt = db.prepare(`
        SELECT processed FROM messages
        WHERE message_id = ?
        LIMIT 1
    `);

    try {
        const result = stmt.get(messageId);
        return result && result.processed === 1;
    } catch (error) {
        console.error('Error al verificar si el mensaje ha sido procesado:', error);
        return false;
    }
}

// Marcar un mensaje como procesado
function markMessageAsProcessed(messageId) {
    if (!messageId) return false;

    const stmt = db.prepare(`
        UPDATE messages
        SET processed = 1
        WHERE message_id = ?
    `);

    try {
        const result = stmt.run(messageId);
        return result.changes > 0;
    } catch (error) {
        console.error('Error al marcar mensaje como procesado:', error);
        return false;
    }
}

// Cerrar la conexión a la base de datos (para limpieza)
function closeDatabase() {
    try {
        if (db) {
            db.close();
            db = null;
        }
    } catch (error) {
        console.error(`Error al cerrar la base de datos: ${error.message}`);
    }
}

module.exports = {
    initializeDatabase,
    saveMessage,
    getChatHistory,
    saveClientData,
    getClientData,
    deleteChatHistory,
    getInactiveChats,
    formatHistoryForApp,
    isMessageProcessed,
    markMessageAsProcessed,
    closeDatabase
};
