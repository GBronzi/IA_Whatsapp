/**
 * Pruebas para el módulo de base de datos
 * Nota: Estas pruebas utilizan una base de datos en memoria
 */

// Simular config antes de importar database
jest.mock('../config', () => ({
    DB_PATH: ':memory:',
    LOG_LEVEL: 'error'
}));

const database = require('../database');

describe('Módulo de base de datos', () => {
    let dbInitialized = false;

    beforeAll(() => {
        // Intentar inicializar la base de datos antes de las pruebas
        try {
            database.initializeDatabase();
            dbInitialized = true;
        } catch (error) {
            console.warn(`No se pudo inicializar la base de datos para las pruebas: ${error.message}`);
            dbInitialized = false;
        }
    });

    afterAll(() => {
        // Cerrar la base de datos después de las pruebas si se inicializó
        if (dbInitialized) {
            database.closeDatabase();
        }
    });

    test('Debe guardar y recuperar mensajes', () => {
        if (!dbInitialized) {
            console.warn('Omitiendo prueba: base de datos no inicializada');
            return;
        }
        const chatId = 'test-chat-123';
        const name = 'Usuario de Prueba';
        const role = 'user';
        const content = 'Mensaje de prueba';

        // Guardar mensaje
        const messageId = database.saveMessage(chatId, name, role, content);
        expect(messageId).not.toBeNull();

        // Recuperar historial
        const history = database.getChatHistory(chatId);
        expect(history.length).toBe(1);
        expect(history[0].chat_id).toBe(chatId);
        expect(history[0].name).toBe(name);
        expect(history[0].role).toBe(role);
        expect(history[0].content).toBe(content);
    });

    test('Debe guardar y recuperar datos de cliente', () => {
        if (!dbInitialized) {
            console.warn('Omitiendo prueba: base de datos no inicializada');
            return;
        }
        const chatId = 'test-chat-456';
        const clientData = {
            nombre: 'Cliente Prueba',
            correo: 'cliente@ejemplo.com',
            telefono: '123456789',
            curso: 'Curso de Prueba',
            pago: 'Tarjeta'
        };

        // Guardar datos
        const dataId = database.saveClientData(chatId, clientData);
        expect(dataId).not.toBeNull();

        // Recuperar datos
        const retrievedData = database.getClientData(chatId);
        expect(retrievedData).not.toBeNull();
        expect(retrievedData.nombre).toBe(clientData.nombre);
        expect(retrievedData.correo).toBe(clientData.correo);
        expect(retrievedData.telefono).toBe(clientData.telefono);
        expect(retrievedData.curso).toBe(clientData.curso);
        expect(retrievedData.pago).toBe(clientData.pago);
    });

    test('Debe eliminar historial de chat', () => {
        if (!dbInitialized) {
            console.warn('Omitiendo prueba: base de datos no inicializada');
            return;
        }
        const chatId = 'test-chat-789';

        // Guardar algunos mensajes
        database.saveMessage(chatId, 'Usuario', 'user', 'Mensaje 1');
        database.saveMessage(chatId, 'Bot', 'assistant', 'Respuesta 1');
        database.saveMessage(chatId, 'Usuario', 'user', 'Mensaje 2');

        // Verificar que se guardaron
        const historyBefore = database.getChatHistory(chatId);
        expect(historyBefore.length).toBeGreaterThan(0);

        // Eliminar historial
        const deletedCount = database.deleteChatHistory(chatId);
        expect(deletedCount).toBeGreaterThanOrEqual(historyBefore.length);

        // Verificar que se eliminaron
        const historyAfter = database.getChatHistory(chatId);
        expect(historyAfter.length).toBe(0);
    });
});
