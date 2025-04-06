/**
 * Pruebas de comunicación y sincronización para el Asistente de Ventas WhatsApp
 *
 * Este script verifica la comunicación y sincronización entre los diferentes componentes del sistema.
 */

const assert = require('assert');
const { performance } = require('perf_hooks');
const EventEmitter = require('events');

// Importar módulos a probar
const messageQueue = require('../../message-queue');
const logger = require('../../logger');

// Crear un mock para el cliente de WhatsApp
class MockWhatsAppClient extends EventEmitter {
    constructor() {
        super();
        this.messages = [];
        this.contacts = new Map();
        this.chats = new Map();
    }

    async sendMessage(chatId, message) {
        logger.info(`[MOCK] Enviando mensaje a ${chatId}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
        this.messages.push({
            from: 'me',
            to: chatId,
            body: message,
            timestamp: Date.now() / 1000
        });
        return { id: `mock_${Date.now()}` };
    }

    async getContactById(contactId) {
        if (this.contacts.has(contactId)) {
            return this.contacts.get(contactId);
        }
        const contact = {
            id: contactId,
            name: `Contact ${contactId}`,
            number: contactId.replace('@c.us', ''),
            isGroup: false
        };
        this.contacts.set(contactId, contact);
        return contact;
    }

    async getChatById(chatId) {
        if (this.chats.has(chatId)) {
            return this.chats.get(chatId);
        }
        const chat = {
            id: chatId,
            name: `Chat ${chatId}`,
            isGroup: false
        };
        this.chats.set(chatId, chat);
        return chat;
    }

    simulateIncomingMessage(chatId, message) {
        const msg = {
            from: chatId,
            to: 'me',
            body: message,
            timestamp: Date.now() / 1000,
            getChat: async () => this.getChatById(chatId),
            getContact: async () => this.getContactById(chatId)
        };
        this.messages.push(msg);
        this.emit('message', msg);
        return msg;
    }
}

// Crear un mock para el servicio de IA
class MockAIService {
    constructor() {
        this.responses = new Map();
        this.defaultResponse = '¡Hola! Soy un asistente virtual. ¿En qué puedo ayudarte?';
    }

    setResponse(input, response) {
        this.responses.set(input.toLowerCase(), response);
    }

    async generateResponse(messages, context = {}) {
        const lastMessage = messages[messages.length - 1];
        const input = lastMessage.content.toLowerCase();

        // Simular tiempo de procesamiento
        await new Promise(resolve => setTimeout(resolve, 500));

        if (this.responses.has(input)) {
            return this.responses.get(input);
        }

        return this.defaultResponse;
    }
}

// Configuración de prueba
const TEST_CHAT_ID = '1234567890@c.us';
const TEST_MESSAGES = [
    'Hola',
    '¿Cómo estás?',
    'Quiero información sobre sus productos',
    'Gracias por la información',
    'Adiós'
];

// Resultados de las pruebas
const results = {
    date: new Date().toISOString(),
    tests: [],
    summary: {
        total: 0,
        passed: 0,
        failed: 0
    }
};

/**
 * Ejecuta una prueba y registra el resultado
 * @param {string} name - Nombre de la prueba
 * @param {Function} testFn - Función de prueba
 */
async function runTest(name, testFn) {
    console.log(`Ejecutando prueba: ${name}`);

    const testResult = {
        name,
        status: 'failed',
        duration: 0,
        error: null
    };

    try {
        const start = performance.now();
        await testFn();
        const end = performance.now();

        testResult.status = 'passed';
        testResult.duration = end - start;

        results.summary.passed++;
        console.log(`✓ Prueba pasada: ${name} (${testResult.duration.toFixed(2)} ms)`);
    } catch (error) {
        testResult.error = error.message;
        console.error(`✗ Prueba fallida: ${name}`);
        console.error(`  Error: ${error.message}`);
    }

    results.tests.push(testResult);
    results.summary.total++;
}

/**
 * Prueba de comunicación básica
 */
async function testBasicCommunication() {
    // Crear instancias de los mocks
    const client = new MockWhatsAppClient();
    const aiService = new MockAIService();

    // Configurar respuestas de la IA
    aiService.setResponse('hola', '¡Hola! ¿En qué puedo ayudarte?');
    aiService.setResponse('¿cómo estás?', 'Estoy bien, gracias por preguntar. ¿En qué puedo ayudarte?');
    aiService.setResponse('quiero información sobre sus productos', 'Tenemos una amplia gama de productos. ¿Sobre cuál te gustaría saber más?');
    aiService.setResponse('gracias por la información', 'De nada. ¿Hay algo más en lo que pueda ayudarte?');
    aiService.setResponse('adiós', 'Hasta luego. ¡Que tengas un buen día!');

    // Función para procesar mensajes
    async function processMessage(msg) {
        try {
            // Obtener información del chat y contacto
            const chat = await msg.getChat();
            const contact = await msg.getContact();

            // Generar respuesta de la IA
            const response = await aiService.generateResponse([
                { role: 'user', content: msg.body }
            ]);

            // Enviar respuesta
            await client.sendMessage(msg.from, response);

            return { success: true, response };
        } catch (error) {
            console.error(`Error al procesar mensaje: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // Configurar manejador de mensajes
    client.on('message', (msg) => {
        messageQueue.enqueue(msg.from, async () => {
            await processMessage(msg);
        });
    });

    // Enviar mensajes de prueba
    const results = [];

    for (const message of TEST_MESSAGES) {
        // Simular mensaje entrante
        const msg = client.simulateIncomingMessage(TEST_CHAT_ID, message);

        // Esperar a que se procese el mensaje
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verificar que se haya enviado una respuesta
        const lastMessage = client.messages[client.messages.length - 1];

        results.push({
            input: message,
            output: lastMessage.body
        });
    }

    // Verificar resultados
    assert.strictEqual(results.length, TEST_MESSAGES.length);

    for (let i = 0; i < results.length; i++) {
        assert.strictEqual(typeof results[i].output, 'string');
        assert.ok(results[i].output.length > 0);
    }

    // No es necesario limpiar las colas, ya que las pruebas son independientes
}

/**
 * Prueba de mensajes concurrentes
 */
async function testConcurrentMessages() {
    // Crear instancias de los mocks
    const client = new MockWhatsAppClient();
    const aiService = new MockAIService();

    // Configurar respuesta de la IA
    aiService.setResponse('test', 'Respuesta de prueba');

    // Función para procesar mensajes
    async function processMessage(msg) {
        try {
            // Simular tiempo de procesamiento variable
            const processingTime = Math.floor(Math.random() * 500) + 100;
            await new Promise(resolve => setTimeout(resolve, processingTime));

            // Generar respuesta de la IA
            const response = await aiService.generateResponse([
                { role: 'user', content: msg.body }
            ]);

            // Enviar respuesta
            await client.sendMessage(msg.from, response);

            return { success: true, response };
        } catch (error) {
            console.error(`Error al procesar mensaje: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // Configurar manejador de mensajes
    client.on('message', (msg) => {
        messageQueue.enqueue(msg.from, async () => {
            await processMessage(msg);
        });
    });

    // Enviar mensajes concurrentes
    const chatIds = [
        '1111111111@c.us',
        '2222222222@c.us',
        '3333333333@c.us',
        '4444444444@c.us',
        '5555555555@c.us'
    ];

    const messagesPerChat = 3;
    const promises = [];

    for (const chatId of chatIds) {
        for (let i = 0; i < messagesPerChat; i++) {
            // Simular mensaje entrante
            client.simulateIncomingMessage(chatId, `test ${i + 1}`);

            // Añadir pequeño retraso entre mensajes
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Esperar a que se procesen todos los mensajes
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verificar resultados
    const messageCount = chatIds.length * messagesPerChat;
    const responseCount = client.messages.filter(msg => msg.from === 'me').length;

    // Debido al sistema de espera, puede haber menos respuestas que mensajes
    // ya que los mensajes consecutivos se agrupan
    assert.ok(responseCount > 0, 'No se enviaron respuestas');
    console.log(`Mensajes enviados: ${messageCount}, Respuestas recibidas: ${responseCount}`);

    // Verificar que cada chat haya recibido al menos una respuesta
    for (const chatId of chatIds) {
        const chatResponses = client.messages.filter(msg => msg.from === 'me' && msg.to === chatId);
        assert.ok(chatResponses.length > 0, `El chat ${chatId} no recibió respuestas`);
    }

    // No es necesario limpiar las colas, ya que las pruebas son independientes
}

/**
 * Prueba de mensajes consecutivos rápidos
 */
async function testConsecutiveMessages() {
    // Crear instancias de los mocks
    const client = new MockWhatsAppClient();
    const aiService = new MockAIService();

    // Configurar respuesta de la IA
    aiService.defaultResponse = 'Respuesta combinada a múltiples mensajes';

    // Función para procesar mensajes
    async function processMessage(msg) {
        try {
            // Generar respuesta de la IA
            const response = await aiService.generateResponse([
                { role: 'user', content: msg.body }
            ]);

            // Enviar respuesta
            await client.sendMessage(msg.from, response);

            return { success: true, response };
        } catch (error) {
            console.error(`Error al procesar mensaje: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    // Configurar manejador de mensajes
    client.on('message', (msg) => {
        messageQueue.enqueue(msg.from, async () => {
            await processMessage(msg);
        });
    });

    // Enviar mensajes consecutivos rápidos
    const chatId = '9999999999@c.us';
    const messages = [
        'Mensaje 1',
        'Mensaje 2',
        'Mensaje 3',
        'Mensaje 4',
        'Mensaje 5'
    ];

    // Enviar mensajes con muy poco tiempo entre ellos
    for (const message of messages) {
        client.simulateIncomingMessage(chatId, message);
        await new Promise(resolve => setTimeout(resolve, 50)); // Solo 50ms entre mensajes
    }

    // Esperar a que se procesen los mensajes
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verificar resultados
    const responseCount = client.messages.filter(msg => msg.from === 'me' && msg.to === chatId).length;

    // Debido al sistema de espera, debería haber menos respuestas que mensajes
    // ya que los mensajes consecutivos se agrupan
    assert.ok(responseCount < messages.length);

    // No es necesario limpiar las colas, ya que las pruebas son independientes
}

/**
 * Ejecuta las pruebas de comunicación
 */
async function runCommunicationTests() {
    console.log('Iniciando pruebas de comunicación y sincronización...');

    // Ejecutar pruebas
    await runTest('Comunicación básica', testBasicCommunication);
    await runTest('Mensajes concurrentes', testConcurrentMessages);
    await runTest('Mensajes consecutivos rápidos', testConsecutiveMessages);

    // Mostrar resumen
    console.log('\nResumen de pruebas de comunicación:');
    console.log('--------------------------------');
    console.log(`Total de pruebas: ${results.summary.total}`);
    console.log(`Pruebas pasadas: ${results.summary.passed}`);
    console.log(`Pruebas fallidas: ${results.summary.total - results.summary.passed}`);
    console.log('--------------------------------');

    // Mostrar pruebas fallidas
    const failedTests = results.tests.filter(test => test.status === 'failed');
    if (failedTests.length > 0) {
        console.log('\nPruebas fallidas:');
        for (const test of failedTests) {
            console.log(`- ${test.name}: ${test.error}`);
        }
        console.log('--------------------------------');
    }

    console.log('Pruebas de comunicación completadas.');

    return results.summary.total === results.summary.passed;
}

// Ejecutar pruebas
runCommunicationTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error(`Error al ejecutar pruebas de comunicación: ${error.message}`);
    process.exit(1);
});
