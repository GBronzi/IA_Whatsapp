/**
 * ai-service.js - Servicio mejorado para interactuar con Ollama
 * Integra análisis de sentimiento, reconocimiento de intenciones y modelos optimizados
 */

const axios = require('axios');
const fs = require('fs').promises;
const crypto = require('crypto');
const config = require('./config');
const logger = require('./logger');
const sentimentAnalyzer = require('./sentiment-analyzer');
const intentRecognizer = require('./intent-recognizer');
const aiModels = require('./ai-models');
const cacheManager = require('./cache-manager');

// Bitrix24 ya no se utiliza, se ha migrado completamente a Google Sheets

/**
 * Formatea el historial de mensajes para Ollama
 * @param {Array} history - Historial de mensajes
 * @returns {string} - Historial formateado
 */
function formatHistoryForOllama(history) {
    if (!history || history.length === 0) return '';

    return history.map(msg => {
        const role = msg.role === 'user' ? 'Usuario' : 'Asistente';
        return `${role}: ${msg.content}`;
    }).join('\n\n');
}

/**
 * Extrae datos estructurados de la respuesta de la IA
 * @param {string} aiResponse - Respuesta de la IA
 * @returns {Object} - Datos estructurados extraídos
 */
function extractDataFromAIResponse(aiResponse) {
    if (!aiResponse) return {};

    // Intentar extraer datos de un bloque JSON marcado
    const dataMarker = "**DATOS_FINALES:**";
    const startIndex = aiResponse.indexOf(dataMarker);

    if (startIndex !== -1) {
        try {
            const potentialJson = aiResponse.substring(startIndex + dataMarker.length).trim();
            const jsonStart = potentialJson.indexOf('{');
            const jsonEnd = potentialJson.lastIndexOf('}');

            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                const jsonString = potentialJson.substring(jsonStart, jsonEnd + 1);
                const parsedData = JSON.parse(jsonString);

                // Validar y limpiar datos
                if (typeof parsedData === 'object' && parsedData !== null) {
                    const cleanData = {};
                    const allowedKeys = ['nombre', 'correo', 'telefono', 'curso', 'pago'];

                    for (const key of allowedKeys) {
                        if (parsedData[key]) {
                            cleanData[key] = parsedData[key];
                        }
                    }

                    if (Object.keys(cleanData).length > 0) {
                        logger.info("Datos JSON extraídos:", cleanData);
                        return cleanData;
                    }
                }
            }
        } catch (error) {
            logger.error(`Error al parsear JSON de la respuesta: ${error.message}`);
        }
    }

    // Si no se encontró un bloque JSON o falló el parsing, usar extracción basada en patrones
    const extractedData = {};

    // Patrones para extraer información
    const patterns = {
        nombre: /(?:nombre|llamo|soy)[^\w]+([\w\s]+?)(?:\.|,|\n|$)/i,
        correo: /(?:correo|email)[^\w]+([\w.-]+@[\w.-]+\.\w+)/i,
        telefono: /(?:teléfono|telefono|celular|móvil|movil|número|numero|contacto)[^\w]+([+\d\s()-]{7,20})/i,
        curso: /(?:curso|taller|clase|programa|interesa)[^\w]+([\w\s]+?)(?:\.|,|\n|$)/i,
        pago: /(?:pago|pagar|abonar|transferencia|tarjeta|efectivo)[^\w]+([\w\s]+?)(?:\.|,|\n|$)/i
    };

    // Buscar coincidencias
    for (const [key, pattern] of Object.entries(patterns)) {
        const match = aiResponse.match(pattern);
        if (match && match[1]) {
            extractedData[key] = match[1].trim();
        }
    }

    // También usar el reconocedor de intenciones para extraer entidades
    const intentResult = intentRecognizer.recognizeIntents(aiResponse);
    if (intentResult.entities) {
        if (intentResult.entities.name && !extractedData.nombre) {
            extractedData.nombre = intentResult.entities.name;
        }
        if (intentResult.entities.email && !extractedData.correo) {
            extractedData.correo = intentResult.entities.email;
        }
        if (intentResult.entities.phone && !extractedData.telefono) {
            extractedData.telefono = intentResult.entities.phone;
        }
        if (intentResult.entities.product && !extractedData.curso) {
            extractedData.curso = intentResult.entities.product;
        }
    }

    return extractedData;
}

/**
 * Carga ejemplos de entrenamiento desde un archivo JSON
 * @returns {Array} - Ejemplos de entrenamiento
 */
async function loadTrainingExamples() {
    // Usar caché para evitar lecturas repetidas del disco
    return await cacheManager.getOrSet('training_examples', async () => {
        try {
            const data = await fs.readFile(config.TRAINING_DATA_PATH, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            logger.warn(`No se pudieron cargar ejemplos de entrenamiento: ${error.message}`);
            return [];
        }
    }, {
        // Mantener en caché por 1 hora, o hasta que se modifique el archivo
        ttl: 3600000
    });
}

/**
 * Obtiene información de productos desde archivo local o datos predeterminados
 * @returns {Promise<string>} - Información de productos formateada
 */
async function getProductsInfo() {
    // Usar caché para evitar lecturas repetidas del disco
    return await cacheManager.getOrSet('products_info', async () => {
        try {

            // Si no hay productos en Bitrix24 o falló, usar información predeterminada
            return `- Programación: Cursos de Python, JavaScript, Java y desarrollo web. Desde $299.
- Diseño: Cursos de diseño gráfico, UX/UI y herramientas Adobe. Desde $349.
- Marketing: Cursos de marketing digital, SEO y redes sociales. Desde $299.
- Modalidades: Online en vivo, grabado o híbrido.
- Promociones: 20% de descuento en el segundo curso, becas disponibles.`;
        } catch (error) {
            logger.error(`Error al obtener información de productos: ${error.message}`);
            return 'Información de productos no disponible en este momento.';
        }
    }, {
        // Mantener en caché por 30 minutos (los productos pueden cambiar con cierta frecuencia)
        ttl: 1800000
    });
}

/**
 * Genera un prompt mejorado para Ollama
 * @param {string} conversationHistory - Historial de conversación formateado
 * @param {string} userName - Nombre del usuario si se conoce
 * @param {Object} collectedData - Datos ya recolectados
 * @param {Object} context - Contexto adicional (sentimiento, intención, etc.)
 * @returns {Promise<string>} - Prompt completo para Ollama
 */
async function generateEnhancedPrompt(conversationHistory, userName = 'Usuario', collectedData = {}, context = {}) {
    // Cargar ejemplos de entrenamiento
    const trainingExamples = await loadTrainingExamples();

    // Obtener información de productos
    const productsInfo = await getProductsInfo();

    // Determinar qué datos faltan por recolectar
    const missingData = [];
    if (!collectedData.nombre) missingData.push('nombre completo');
    if (!collectedData.correo) missingData.push('dirección de correo electrónico');
    if (!collectedData.telefono) missingData.push('número de teléfono');
    if (!collectedData.curso) missingData.push('curso o servicio de interés');
    if (!collectedData.pago) missingData.push('método de pago preferido');

    // Seleccionar plantilla según el modelo y recursos disponibles
    let promptTemplate;

    // Si hay un modelo específico configurado, usar su plantilla
    if (context.modelId) {
        // Generar prompt usando el módulo de modelos de IA
        return aiModels.generatePrompt(context.modelId, {
            business_name: config.BUSINESS_NAME,
            products_info: productsInfo,
            conversation_history: conversationHistory
        });
    }

    // Si no hay modelo específico, usar plantilla estándar mejorada
    let prompt = `Eres un asistente virtual de ventas para ${config.BUSINESS_NAME}. Tu objetivo es conversar amigablemente con el usuario, entender sus necesidades y recolectar la siguiente información:`;

    // Si faltan datos, especificar cuáles
    if (missingData.length > 0) {
        prompt += `\nNecesitas recolectar de forma natural los siguientes datos que aún faltan:`;
        missingData.forEach((item, index) => {
            prompt += `\n${index + 1}. ${item}`;
        });
    } else {
        prompt += `\nYa has recolectado toda la información necesaria. Ahora puedes enfocarte en resolver dudas y cerrar la venta.`;
    }

    // Añadir instrucciones específicas
    prompt += `\n\nInstrucciones importantes:
1. Sé conversacional y natural, no hagas preguntas directas tipo formulario.
2. Adapta tus respuestas al contexto de la conversación.
3. Proporciona información precisa sobre los productos/servicios cuando te pregunten.
4. Si el usuario pregunta algo que no sabes, da aviso a un asistente humano.
5. Mantén un tono amigable y profesional en todo momento.
6. No solicites información sensible como contraseñas o datos bancarios.
7. Si el usuario ya proporcionó algún dato, no lo solicites nuevamente.`;

    // Añadir instrucciones basadas en el sentimiento si está disponible
    if (context.sentiment) {
        if (context.sentiment === 'negative' || context.sentiment === 'very_negative') {
            prompt += `\n8. El usuario muestra signos de insatisfacción. Utiliza un tono empático y comprensivo. Reconoce su frustración y muestra disposición para resolver sus dudas.`;
        } else if (context.sentiment === 'positive' || context.sentiment === 'very_positive') {
            prompt += `\n8. El usuario muestra interés positivo. Es un buen momento para sugerir productos adicionales o complementarios y reforzar su decisión.`;
        }

        if (context.urgency && context.urgency >= 7) {
            prompt += `\n9. El usuario muestra alta urgencia. Prioriza respuestas concisas y ofrece soluciones inmediatas.`;
        }
    }

    // Añadir instrucciones basadas en la intención si está disponible
    if (context.primaryIntent) {
        prompt += `\n\nEl usuario parece estar interesado en: ${context.primaryIntent.replace('_', ' ').toLowerCase()}. Adapta tu respuesta a esta intención.`;
    }

    // Añadir información sobre los productos/servicios
    prompt += `\n\nInformación sobre nuestros productos/servicios:\n${productsInfo}`;

    // Añadir ejemplos de entrenamiento si existen
    if (trainingExamples.length > 0) {
        prompt += `\n\nEjemplos de cómo responder a preguntas comunes:`;
        trainingExamples.forEach(example => {
            prompt += `\n\nUsuario: ${example.prompt}\nAsistente: ${example.response}`;
        });
    }

    // Añadir instrucción para incluir datos estructurados en la respuesta
    prompt += `\n\n**Instrucción Importante:** Cuando creas que has recopilado toda o la mayoría de la información necesaria, incluye al final de tu respuesta un bloque JSON claramente marcado con los datos. Usa este formato EXACTO (incluyendo el marcador):
**DATOS_FINALES:** {"nombre": "...", "correo": "...", "telefono": "...", "curso": "...", "pago": "..."}
Si aún no tienes un dato, omite la clave o déjala como string vacío en el JSON. Solo incluye este bloque cuando estés razonablemente seguro de haber obtenido la información.`;

    // Añadir el historial de conversación
    prompt += `\n\nAquí está la conversación hasta ahora:
--- HISTORIAL ---
${conversationHistory}
---
Asistente:`;

    return prompt;
}

/**
 * Llama a la API de Ollama y procesa la respuesta
 * @param {string} chatId - ID del chat
 * @param {Array} history - Historial de mensajes
 * @param {Object} collectedData - Datos ya recolectados
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<Object>} - Respuesta procesada y datos extraídos
 */
async function callOllamaAndProcess(chatId, history, collectedData = {}, options = {}) {
    if (!history || history.length === 0) {
        logger.error(`No hay historial para llamar a Ollama para ${chatId}`);
        return {
            response: "Lo siento, parece que me perdí. ¿Podrías empezar de nuevo?",
            extractedData: {}
        };
    }

    const conversationHistory = formatHistoryForOllama(history);
    const userName = collectedData.nombre || 'Usuario';

    // Generar una clave de caché única basada en el historial y los datos recolectados
    // Solo cachear si no se especifica una opción de no caché
    if (!options.noCache) {
        // Crear un hash de la conversación y los datos para usar como clave de caché
        const cacheKey = generateCacheKey(history, collectedData, options);

        // Intentar obtener respuesta de la caché
        const cachedResponse = await cacheManager.get(cacheKey);
        if (cachedResponse) {
            logger.info(`Respuesta obtenida de caché para ${chatId}`);
            return cachedResponse;
        }
    }

    // Analizar último mensaje del usuario para contexto
    const lastUserMessage = history.filter(msg => msg.role === 'user').pop();
    let context = {};

    if (lastUserMessage && lastUserMessage.content) {
        // Analizar sentimiento
        const sentimentResult = sentimentAnalyzer.analyzeSentiment(lastUserMessage.content);
        context.sentiment = sentimentResult.sentiment;
        context.urgency = sentimentResult.urgency;

        // Reconocer intención
        const intentResult = intentRecognizer.recognizeIntents(lastUserMessage.content);
        context.primaryIntent = intentResult.primaryIntent;
        context.entities = intentResult.entities;
    }

    // Analizar conversación completa para tendencias
    const userMessages = history.filter(msg => msg.role === 'user').map(msg => msg.content);
    if (userMessages.length > 1) {
        const conversationAnalysis = sentimentAnalyzer.analyzeConversation(userMessages);
        context.overallSentiment = conversationAnalysis.overallSentiment;
        context.sentimentTrend = conversationAnalysis.sentimentTrend;
    }

    // Seleccionar modelo según opciones o configuración
    const modelId = options.modelId || config.OLLAMA_MODEL;
    context.modelId = modelId;

    try {
        // Generar prompt mejorado con todo el contexto
        const prompt = await generateEnhancedPrompt(conversationHistory, userName, collectedData, context);

        logger.info(`Enviando prompt a Ollama (modelo: ${modelId}) para ${chatId}`);
        logger.debug('Prompt enviado:', { prompt });

        // Llamar a Ollama
        const response = await axios.post(config.OLLAMA_URL, {
            model: modelId,
            prompt: prompt,
            stream: false,
            options: {
                temperature: options.temperature || 0.7,
                top_k: options.top_k || 40,
                top_p: options.top_p || 0.9,
            }
        }, { timeout: config.OLLAMA_TIMEOUT });

        // Procesar respuesta
        const aiRawResponse = response.data.response || '';
        logger.info(`Respuesta recibida de Ollama para ${chatId}`);

        // Extraer datos estructurados
        const extractedData = extractDataFromAIResponse(aiRawResponse);
        logger.debug('Datos extraídos:', { extractedData });

        // Limpiar respuesta (quitar bloque JSON si existe)
        const dataMarker = "**DATOS_FINALES:**";
        const markerIndex = aiRawResponse.indexOf(dataMarker);
        const cleanResponse = markerIndex !== -1
            ? aiRawResponse.substring(0, markerIndex).trim()
            : aiRawResponse;

        // Evitar respuestas vacías después de limpiar
        const finalResponse = cleanResponse || "¡Entendido! He registrado la información.";

        // Sincronizar con Bitrix24 si hay datos suficientes
        if (bitrix24 && extractedData && (extractedData.nombre || extractedData.telefono || extractedData.correo)) {
            try {
                const syncResult = await bitrix24.syncClientData({
                    ...collectedData,
                    ...extractedData
                });

                if (syncResult.success) {
                    logger.info(`Datos sincronizados con Bitrix24 para ${chatId}`);
                }
            } catch (syncError) {
                logger.error(`Error al sincronizar con Bitrix24: ${syncError.message}`);
            }
        }

        const result = {
            response: finalResponse,
            extractedData,
            context: {
                sentiment: context.sentiment,
                urgency: context.urgency,
                primaryIntent: context.primaryIntent
            }
        };

        // Guardar en caché si no se especifica una opción de no caché
        if (!options.noCache) {
            const cacheKey = generateCacheKey(history, collectedData, options);
            await cacheManager.set(cacheKey, result, {
                // Tiempo de vida de 1 hora para respuestas cacheadas
                ttl: 3600000
            });
            logger.debug(`Respuesta guardada en caché para ${chatId}`);
        }

        return result;
    } catch (error) {
        logger.error(`Error al llamar a Ollama para ${chatId}: ${error.message}`);

        // Si el error es por el modelo, intentar con un modelo de respaldo
        if (error.message.includes('model') && modelId !== 'llama3.1:8b-q4') {
            logger.warn(`Intentando con modelo de respaldo para ${chatId}`);
            return callOllamaAndProcess(chatId, history, collectedData, {
                ...options,
                modelId: 'llama3.1:8b-q4' // Modelo de respaldo ligero
            });
        }

        return {
            response: "Lo siento, estoy teniendo problemas para procesar tu mensaje. ¿Podrías intentarlo de nuevo en unos momentos?",
            extractedData: {}
        };
    }
}

/**
 * Genera una clave de caché única basada en el historial, datos recolectados y opciones
 * @param {Array} history - Historial de mensajes
 * @param {Object} collectedData - Datos ya recolectados
 * @param {Object} options - Opciones adicionales
 * @returns {string} - Clave de caché única
 */
function generateCacheKey(history, collectedData, options) {
    // Extraer solo los últimos 5 mensajes para la clave de caché
    // Esto permite que conversaciones similares compartan caché
    const recentMessages = history.slice(-5);

    // Crear un objeto con los datos relevantes para la clave
    const keyData = {
        messages: recentMessages.map(msg => ({
            role: msg.role,
            content: msg.content
        })),
        collectedData: { ...collectedData },
        modelId: options.modelId || config.OLLAMA_MODEL
    };

    // Convertir a JSON y generar hash
    const jsonData = JSON.stringify(keyData);
    const hash = crypto.createHash('md5').update(jsonData).digest('hex');

    return `ai_response:${hash}`;
}

/**
 * Obtiene modelos de IA recomendados según los recursos del sistema
 * @param {Object} systemResources - Recursos del sistema (RAM, CPU)
 * @returns {Array} - Lista de modelos recomendados
 */
function getRecommendedModels(systemResources = {}) {
    return aiModels.getRecommendedModels(systemResources);
}

/**
 * Analiza el sentimiento de un mensaje
 * @param {string} message - Mensaje a analizar
 * @returns {Object} - Resultado del análisis
 */
function analyzeSentiment(message) {
    return sentimentAnalyzer.analyzeSentiment(message);
}

/**
 * Reconoce intenciones en un mensaje
 * @param {string} message - Mensaje a analizar
 * @returns {Object} - Intenciones reconocidas
 */
function recognizeIntents(message) {
    return intentRecognizer.recognizeIntents(message);
}

/**
 * Estima el número de tokens en un texto
 * @param {string} text - Texto a analizar
 * @returns {number} - Número estimado de tokens
 */
function estimateTokenCount(text) {
    // Estimación simple: aproximadamente 1 token por cada 4 caracteres
    return Math.ceil(text.length / 4);
}

/**
 * Optimiza los parámetros del modelo según el contexto
 * @param {Object} options - Opciones especificadas por el usuario
 * @param {number} tokenCount - Número estimado de tokens
 * @param {Object} context - Contexto de la conversación
 * @returns {Object} - Parámetros optimizados
 */
function optimizeModelParameters(options, tokenCount, context = {}) {
    // Parámetros base
    const modelOptions = {
        temperature: options.temperature || 0.7,
        top_k: options.top_k || 40,
        top_p: options.top_p || 0.9,
        num_predict: options.max_tokens || 500
    };

    // Ajustar según la longitud del prompt
    if (tokenCount > 2000) {
        // Para prompts muy largos, reducir la longitud de respuesta
        modelOptions.num_predict = Math.min(modelOptions.num_predict, 300);
        // Reducir temperatura para respuestas más concisas
        modelOptions.temperature = Math.min(modelOptions.temperature, 0.5);
    } else if (tokenCount < 500) {
        // Para prompts cortos, permitir respuestas más largas
        modelOptions.num_predict = Math.min(modelOptions.num_predict + 100, 800);
    }

    // Ajustar según el contexto
    if (context.primaryIntent) {
        switch (context.primaryIntent) {
            case 'product_info':
            case 'technical_question':
                // Para información factual, reducir temperatura
                modelOptions.temperature = Math.min(modelOptions.temperature, 0.4);
                break;

            case 'creative_request':
                // Para solicitudes creativas, aumentar temperatura
                modelOptions.temperature = Math.max(modelOptions.temperature, 0.8);
                break;
        }
    }

    // Ajustar según el sentimiento
    if (context.sentiment === 'negative' || context.sentiment === 'very_negative') {
        // Para sentimientos negativos, ser más preciso y menos creativo
        modelOptions.temperature = Math.min(modelOptions.temperature, 0.5);
        modelOptions.top_p = Math.min(modelOptions.top_p, 0.8);
    }

    return modelOptions;
}

/**
 * Calcula el tiempo de vida en caché basado en el contexto
 * @param {Object} context - Contexto de la conversación
 * @returns {Object} - Opciones de caché con TTL
 */
function calculateCacheTTL(context = {}) {
    // TTL base: 1 hora
    let ttl = 3600000; // 1 hora en ms

    // Ajustar según la intención
    if (context.primaryIntent) {
        switch (context.primaryIntent) {
            case 'product_info':
            case 'pricing':
                // Información de productos y precios: caché más larga (4 horas)
                ttl = 4 * 3600000;
                break;
            case 'greeting':
            case 'farewell':
                // Saludos y despedidas: caché muy larga (24 horas)
                ttl = 24 * 3600000;
                break;
            case 'complaint':
            case 'urgent':
                // Quejas y urgencias: caché corta (15 minutos)
                ttl = 15 * 60000;
                break;
        }
    }

    // Ajustar según el sentimiento
    if (context.sentiment === 'negative' || context.sentiment === 'very_negative') {
        // Reducir TTL para sentimientos negativos
        ttl = Math.min(ttl, 30 * 60000); // 30 minutos máximo
    }

    return { ttl };
}

/**
 * Registra métricas de rendimiento de la IA
 * @param {number} processingTime - Tiempo de procesamiento en ms
 * @param {number} tokenCount - Número de tokens
 * @param {boolean} cacheHit - Si se obtuvo de caché
 * @param {boolean} error - Si hubo un error
 */
function trackAiMetrics(processingTime, tokenCount, cacheHit = false, error = false) {
    try {
        // Si el módulo de monitoreo está disponible, registrar métricas
        const monitoringSystem = require('./monitoring-system');

        monitoringSystem.trackAiRequest({
            processingTime,
            tokenCount,
            cacheHit,
            error
        });
    } catch (e) {
        // Si no está disponible, ignorar silenciosamente
        logger.debug('Módulo de monitoreo no disponible para registrar métricas de IA');
    }
}

module.exports = {
    callOllamaAndProcess,
    formatHistoryForOllama,
    extractDataFromAIResponse,
    generateEnhancedPrompt,
    loadTrainingExamples,
    getRecommendedModels,
    analyzeSentiment,
    recognizeIntents,
    // Nuevas funciones de optimización
    estimateTokenCount,
    optimizeModelParameters,
    calculateCacheTTL,
    trackAiMetrics
};
