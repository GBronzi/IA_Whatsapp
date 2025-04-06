/**
 * human-assistance-detector.js
 * 
 * Sistema avanzado para detectar cuando un cliente necesita asistencia humana.
 * Utiliza análisis de texto, detección de emociones y aprendizaje para mejorar con el tiempo.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const config = require('./config');

// Importar módulos de NLP si están disponibles
let natural;
try {
    natural = require('natural');
} catch (error) {
    logger.warn(`Módulo 'natural' no disponible. Algunas funcionalidades de NLP estarán limitadas.`);
}

// Importar módulos de análisis de sentimientos si están disponibles
let sentiment;
try {
    sentiment = require('sentiment');
} catch (error) {
    logger.warn(`Módulo 'sentiment' no disponible. La detección de emociones estará limitada.`);
}

/**
 * Clase para detectar cuando un cliente necesita asistencia humana
 */
class HumanAssistanceDetector {
    /**
     * Constructor
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        this.options = {
            // Ruta al archivo de datos de entrenamiento
            trainingDataPath: options.trainingDataPath || path.join(__dirname, 'data', 'human-assistance-training.json'),
            // Umbral de puntuación para considerar que se necesita asistencia humana
            scoreThreshold: options.scoreThreshold || 0.6,
            // Peso de cada factor en la puntuación final
            weights: options.weights || {
                keywords: 0.3,
                patterns: 0.2,
                sentiment: 0.2,
                consecutiveQuestions: 0.15,
                messageLength: 0.05,
                messageFrequency: 0.1
            },
            // Número máximo de mensajes a considerar para el contexto
            maxContextMessages: options.maxContextMessages || 5,
            // Tiempo máximo (en ms) para considerar mensajes consecutivos
            consecutiveMessageTimeThreshold: options.consecutiveMessageTimeThreshold || 60000, // 1 minuto
            // Número de mensajes negativos consecutivos para activar asistencia
            negativeMessagesThreshold: options.negativeMessagesThreshold || 2,
            // Activar aprendizaje automático
            enableLearning: options.enableLearning !== undefined ? options.enableLearning : true
        };

        // Inicializar componentes NLP si están disponibles
        if (natural) {
            this.tokenizer = new natural.WordTokenizer();
            this.stemmer = natural.PorterStemmerEs;
            this.classifier = new natural.BayesClassifier();
        }

        // Inicializar analizador de sentimientos si está disponible
        if (sentiment) {
            this.sentimentAnalyzer = new sentiment();
        }

        // Cargar datos de entrenamiento
        this.trainingData = this.loadTrainingData();

        // Inicializar clasificador si está disponible
        if (natural && this.trainingData.examples) {
            this.initializeClassifier();
        }

        // Caché de resultados recientes para evitar recálculos
        this.cache = new Map();
        this.cacheMaxSize = 100;

        logger.info('Sistema de detección de asistencia humana inicializado');
    }

    /**
     * Carga los datos de entrenamiento desde un archivo
     * @returns {Object} - Datos de entrenamiento
     */
    loadTrainingData() {
        try {
            if (fs.existsSync(this.options.trainingDataPath)) {
                const data = fs.readFileSync(this.options.trainingDataPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            logger.error(`Error al cargar datos de entrenamiento: ${error.message}`);
        }

        // Datos de entrenamiento por defecto si no se puede cargar el archivo
        return {
            keywords: [
                // Palabras clave que indican necesidad de asistencia humana
                { text: "humano", weight: 0.8 },
                { text: "persona", weight: 0.8 },
                { text: "agente", weight: 0.8 },
                { text: "representante", weight: 0.8 },
                { text: "supervisor", weight: 0.8 },
                { text: "hablar", weight: 0.6 },
                { text: "comunicar", weight: 0.6 },
                { text: "real", weight: 0.5 },
                { text: "ayuda", weight: 0.5 },
                { text: "asistencia", weight: 0.7 },
                { text: "urgente", weight: 0.8 },
                { text: "problema", weight: 0.5 },
                { text: "error", weight: 0.6 },
                { text: "confundido", weight: 0.6 },
                { text: "confusión", weight: 0.6 },
                { text: "frustrado", weight: 0.7 },
                { text: "frustración", weight: 0.7 },
                { text: "molesto", weight: 0.7 },
                { text: "enojado", weight: 0.8 },
                { text: "insatisfecho", weight: 0.7 }
            ],
            patterns: [
                // Patrones de texto que indican necesidad de asistencia humana
                { pattern: "quiero hablar con un", weight: 0.9 },
                { pattern: "necesito hablar con un", weight: 0.9 },
                { pattern: "puedo hablar con un", weight: 0.8 },
                { pattern: "comuníqueme con un", weight: 0.9 },
                { pattern: "pásame con un", weight: 0.9 },
                { pattern: "no me estás entendiendo", weight: 0.8 },
                { pattern: "no entiendes", weight: 0.7 },
                { pattern: "no es lo que pregunt", weight: 0.7 },
                { pattern: "no es eso lo que", weight: 0.7 },
                { pattern: "no me sirve", weight: 0.6 },
                { pattern: "no me ayuda", weight: 0.7 },
                { pattern: "no es útil", weight: 0.6 },
                { pattern: "esto no funciona", weight: 0.7 },
                { pattern: "no funciona", weight: 0.5 },
                { pattern: "estoy frustrado", weight: 0.8 },
                { pattern: "me estoy enojando", weight: 0.8 },
                { pattern: "esto es ridículo", weight: 0.7 },
                { pattern: "es una pérdida de tiempo", weight: 0.7 },
                { pattern: "quiero cancelar", weight: 0.6 },
                { pattern: "quiero un reembolso", weight: 0.7 }
            ],
            negativeEmotions: [
                // Emociones negativas que pueden indicar necesidad de asistencia humana
                "frustración", "enojo", "ira", "molestia", "confusión", 
                "decepción", "insatisfacción", "irritación", "ansiedad", "preocupación"
            ],
            examples: [
                // Ejemplos de mensajes que requieren asistencia humana
                { text: "Quiero hablar con un humano", needsHuman: true },
                { text: "Necesito hablar con una persona real", needsHuman: true },
                { text: "Puedo hablar con un agente?", needsHuman: true },
                { text: "Esto no funciona, necesito ayuda de un representante", needsHuman: true },
                { text: "Estoy frustrado, no me estás entendiendo", needsHuman: true },
                { text: "Quiero hablar con un supervisor", needsHuman: true },
                { text: "No entiendes lo que te estoy diciendo", needsHuman: true },
                { text: "Esto es ridículo, necesito hablar con alguien real", needsHuman: true },
                { text: "No es lo que pregunté, quiero hablar con un humano", needsHuman: true },
                { text: "Estoy enojado por el mal servicio", needsHuman: true },
                { text: "Necesito un reembolso urgente", needsHuman: true },
                { text: "Esto es una pérdida de tiempo", needsHuman: true },
                { text: "No me estás ayudando", needsHuman: true },
                { text: "Quiero cancelar mi pedido", needsHuman: true },
                { text: "Esto no es útil", needsHuman: true },
                
                // Ejemplos de mensajes que no requieren asistencia humana
                { text: "Hola, ¿cómo estás?", needsHuman: false },
                { text: "Gracias por la información", needsHuman: false },
                { text: "¿Cuál es el precio del producto?", needsHuman: false },
                { text: "¿Cuándo estará disponible?", needsHuman: false },
                { text: "Me gustaría saber más sobre esto", needsHuman: false },
                { text: "¿Tienen envío a mi ciudad?", needsHuman: false },
                { text: "¿Aceptan tarjetas de crédito?", needsHuman: false },
                { text: "¿Cuál es el horario de atención?", needsHuman: false },
                { text: "Necesito más información", needsHuman: false },
                { text: "¿Puedo hacer un pedido ahora?", needsHuman: false },
                { text: "¿Tienen descuentos?", needsHuman: false },
                { text: "¿Cómo puedo realizar un seguimiento de mi pedido?", needsHuman: false },
                { text: "¿Cuánto tiempo tarda el envío?", needsHuman: false },
                { text: "¿Tienen este producto en otro color?", needsHuman: false },
                { text: "Gracias por tu ayuda", needsHuman: false }
            ]
        };
    }

    /**
     * Inicializa el clasificador con los datos de entrenamiento
     */
    initializeClassifier() {
        if (!natural || !this.trainingData.examples) {
            return;
        }

        try {
            // Entrenar el clasificador con los ejemplos
            for (const example of this.trainingData.examples) {
                this.classifier.addDocument(example.text, example.needsHuman ? 'needs_human' : 'no_human');
            }

            this.classifier.train();
            logger.info('Clasificador de asistencia humana entrenado correctamente');
        } catch (error) {
            logger.error(`Error al entrenar clasificador: ${error.message}`);
        }
    }

    /**
     * Guarda los datos de entrenamiento en un archivo
     * @returns {boolean} - true si se guardaron correctamente, false en caso contrario
     */
    saveTrainingData() {
        try {
            // Asegurarse de que el directorio existe
            const dir = path.dirname(this.options.trainingDataPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // Guardar datos
            fs.writeFileSync(
                this.options.trainingDataPath,
                JSON.stringify(this.trainingData, null, 2),
                'utf8'
            );
            
            logger.info('Datos de entrenamiento guardados correctamente');
            return true;
        } catch (error) {
            logger.error(`Error al guardar datos de entrenamiento: ${error.message}`);
            return false;
        }
    }

    /**
     * Añade un ejemplo al conjunto de entrenamiento y reentrenar el clasificador
     * @param {string} text - Texto del mensaje
     * @param {boolean} needsHuman - Indica si el mensaje necesita asistencia humana
     * @returns {boolean} - true si se añadió correctamente, false en caso contrario
     */
    addTrainingExample(text, needsHuman) {
        if (!this.options.enableLearning) {
            return false;
        }

        try {
            // Añadir ejemplo a los datos de entrenamiento
            this.trainingData.examples.push({ text, needsHuman });

            // Reentrenar el clasificador si está disponible
            if (natural && this.classifier) {
                this.classifier.addDocument(text, needsHuman ? 'needs_human' : 'no_human');
                this.classifier.train();
            }

            // Guardar datos de entrenamiento
            this.saveTrainingData();
            
            logger.info(`Ejemplo de entrenamiento añadido: "${text}" (${needsHuman ? 'necesita humano' : 'no necesita humano'})`);
            return true;
        } catch (error) {
            logger.error(`Error al añadir ejemplo de entrenamiento: ${error.message}`);
            return false;
        }
    }

    /**
     * Detecta si un mensaje necesita asistencia humana
     * @param {string} message - Mensaje a analizar
     * @param {Object} context - Contexto del mensaje (mensajes anteriores, información del chat, etc.)
     * @returns {Object} - Resultado de la detección
     */
    detectHumanAssistanceNeeded(message, context = {}) {
        // Verificar si el mensaje está en caché
        const cacheKey = `${message}_${JSON.stringify(context)}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Inicializar resultado
        const result = {
            needsHumanAssistance: false,
            score: 0,
            factors: {},
            confidence: 0,
            explanation: []
        };

        try {
            // Normalizar mensaje
            const normalizedMessage = this.normalizeText(message);
            
            // Calcular puntuación basada en palabras clave
            const keywordScore = this.calculateKeywordScore(normalizedMessage);
            result.factors.keywordScore = keywordScore;
            result.explanation.push(`Puntuación de palabras clave: ${keywordScore.toFixed(2)}`);
            
            // Calcular puntuación basada en patrones
            const patternScore = this.calculatePatternScore(normalizedMessage);
            result.factors.patternScore = patternScore;
            result.explanation.push(`Puntuación de patrones: ${patternScore.toFixed(2)}`);
            
            // Calcular puntuación basada en sentimientos
            const sentimentScore = this.calculateSentimentScore(message);
            result.factors.sentimentScore = sentimentScore;
            result.explanation.push(`Puntuación de sentimientos: ${sentimentScore.toFixed(2)}`);
            
            // Calcular puntuación basada en preguntas consecutivas
            const consecutiveQuestionsScore = this.calculateConsecutiveQuestionsScore(message, context);
            result.factors.consecutiveQuestionsScore = consecutiveQuestionsScore;
            result.explanation.push(`Puntuación de preguntas consecutivas: ${consecutiveQuestionsScore.toFixed(2)}`);
            
            // Calcular puntuación basada en longitud del mensaje
            const messageLengthScore = this.calculateMessageLengthScore(message);
            result.factors.messageLengthScore = messageLengthScore;
            result.explanation.push(`Puntuación de longitud del mensaje: ${messageLengthScore.toFixed(2)}`);
            
            // Calcular puntuación basada en frecuencia de mensajes
            const messageFrequencyScore = this.calculateMessageFrequencyScore(context);
            result.factors.messageFrequencyScore = messageFrequencyScore;
            result.explanation.push(`Puntuación de frecuencia de mensajes: ${messageFrequencyScore.toFixed(2)}`);
            
            // Calcular puntuación del clasificador si está disponible
            let classifierScore = 0;
            if (natural && this.classifier) {
                const classification = this.classifier.classify(message);
                const classifications = this.classifier.getClassifications(message);
                
                // Obtener la puntuación de confianza
                const needsHumanClassification = classifications.find(c => c.label === 'needs_human');
                classifierScore = needsHumanClassification ? needsHumanClassification.value : 0;
                
                result.factors.classifierScore = classifierScore;
                result.explanation.push(`Puntuación del clasificador: ${classifierScore.toFixed(2)}`);
            }
            
            // Calcular puntuación final ponderada
            result.score = (
                this.options.weights.keywords * keywordScore +
                this.options.weights.patterns * patternScore +
                this.options.weights.sentiment * sentimentScore +
                this.options.weights.consecutiveQuestions * consecutiveQuestionsScore +
                this.options.weights.messageLength * messageLengthScore +
                this.options.weights.messageFrequency * messageFrequencyScore
            );
            
            // Ajustar con la puntuación del clasificador si está disponible
            if (classifierScore > 0) {
                // Dar más peso al clasificador si la puntuación es alta
                const classifierWeight = 0.4;
                result.score = (result.score * (1 - classifierWeight)) + (classifierScore * classifierWeight);
            }
            
            // Determinar si se necesita asistencia humana
            result.needsHumanAssistance = result.score >= this.options.scoreThreshold;
            
            // Calcular confianza
            result.confidence = Math.min(1, result.score / this.options.scoreThreshold);
            
            // Añadir explicación final
            result.explanation.push(`Puntuación final: ${result.score.toFixed(2)} (umbral: ${this.options.scoreThreshold})`);
            result.explanation.push(`Confianza: ${(result.confidence * 100).toFixed(2)}%`);
            result.explanation.push(`Resultado: ${result.needsHumanAssistance ? 'Necesita asistencia humana' : 'No necesita asistencia humana'}`);
            
            // Guardar en caché
            this.cache.set(cacheKey, result);
            
            // Limitar tamaño de la caché
            if (this.cache.size > this.cacheMaxSize) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            
            return result;
        } catch (error) {
            logger.error(`Error al detectar necesidad de asistencia humana: ${error.message}`);
            
            // En caso de error, devolver un resultado conservador
            return {
                needsHumanAssistance: false,
                score: 0,
                factors: {},
                confidence: 0,
                explanation: [`Error: ${error.message}`]
            };
        }
    }

    /**
     * Normaliza un texto (elimina acentos, convierte a minúsculas, etc.)
     * @param {string} text - Texto a normalizar
     * @returns {string} - Texto normalizado
     */
    normalizeText(text) {
        if (!text) return '';
        
        // Convertir a minúsculas
        let normalized = text.toLowerCase();
        
        // Eliminar acentos
        normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Eliminar caracteres especiales y números
        normalized = normalized.replace(/[^\w\s]/g, ' ').replace(/\d+/g, ' ');
        
        // Eliminar espacios múltiples
        normalized = normalized.replace(/\s+/g, ' ').trim();
        
        return normalized;
    }

    /**
     * Calcula la puntuación basada en palabras clave
     * @param {string} normalizedMessage - Mensaje normalizado
     * @returns {number} - Puntuación (0-1)
     */
    calculateKeywordScore(normalizedMessage) {
        if (!normalizedMessage || !this.trainingData.keywords) {
            return 0;
        }
        
        let totalScore = 0;
        let maxPossibleScore = 0;
        
        // Tokenizar el mensaje si está disponible el tokenizador
        const tokens = this.tokenizer 
            ? this.tokenizer.tokenize(normalizedMessage) 
            : normalizedMessage.split(' ');
        
        // Aplicar stemming si está disponible
        const stems = this.stemmer 
            ? tokens.map(token => this.stemmer.stem(token)) 
            : tokens;
        
        // Buscar palabras clave
        for (const keyword of this.trainingData.keywords) {
            maxPossibleScore += keyword.weight;
            
            // Normalizar y tokenizar la palabra clave
            const normalizedKeyword = this.normalizeText(keyword.text);
            
            // Verificar si la palabra clave está en el mensaje
            if (normalizedMessage.includes(normalizedKeyword)) {
                totalScore += keyword.weight;
                continue;
            }
            
            // Verificar si el stem de la palabra clave está en los stems del mensaje
            if (this.stemmer) {
                const keywordStem = this.stemmer.stem(normalizedKeyword);
                if (stems.includes(keywordStem)) {
                    totalScore += keyword.weight;
                }
            }
        }
        
        // Normalizar puntuación (0-1)
        return maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
    }

    /**
     * Calcula la puntuación basada en patrones
     * @param {string} normalizedMessage - Mensaje normalizado
     * @returns {number} - Puntuación (0-1)
     */
    calculatePatternScore(normalizedMessage) {
        if (!normalizedMessage || !this.trainingData.patterns) {
            return 0;
        }
        
        let totalScore = 0;
        let maxPossibleScore = 0;
        
        // Buscar patrones
        for (const patternObj of this.trainingData.patterns) {
            maxPossibleScore += patternObj.weight;
            
            // Normalizar el patrón
            const normalizedPattern = this.normalizeText(patternObj.pattern);
            
            // Verificar si el patrón está en el mensaje
            if (normalizedMessage.includes(normalizedPattern)) {
                totalScore += patternObj.weight;
            }
        }
        
        // Normalizar puntuación (0-1)
        return maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
    }

    /**
     * Calcula la puntuación basada en análisis de sentimientos
     * @param {string} message - Mensaje original
     * @returns {number} - Puntuación (0-1)
     */
    calculateSentimentScore(message) {
        if (!message) {
            return 0;
        }
        
        // Si está disponible el analizador de sentimientos
        if (this.sentimentAnalyzer) {
            try {
                const result = this.sentimentAnalyzer.analyze(message);
                
                // Normalizar puntuación (-5 a 5 -> 0 a 1)
                // Valores negativos indican sentimientos negativos
                // Invertimos para que sentimientos negativos den puntuación alta
                const normalizedScore = Math.max(0, Math.min(1, (0 - result.comparative + 5) / 10));
                
                return normalizedScore;
            } catch (error) {
                logger.error(`Error en análisis de sentimientos: ${error.message}`);
            }
        }
        
        // Análisis básico de sentimientos si no está disponible el analizador
        const negativeEmotions = this.trainingData.negativeEmotions || [];
        let negativeCount = 0;
        
        for (const emotion of negativeEmotions) {
            if (message.toLowerCase().includes(emotion)) {
                negativeCount++;
            }
        }
        
        // Normalizar puntuación (0-1)
        return Math.min(1, negativeCount / 3);
    }

    /**
     * Calcula la puntuación basada en preguntas consecutivas
     * @param {string} message - Mensaje actual
     * @param {Object} context - Contexto del mensaje
     * @returns {number} - Puntuación (0-1)
     */
    calculateConsecutiveQuestionsScore(message, context) {
        if (!message || !context || !context.previousMessages) {
            return 0;
        }
        
        // Contar preguntas consecutivas
        let consecutiveQuestions = message.endsWith('?') ? 1 : 0;
        
        // Obtener mensajes anteriores del usuario
        const userMessages = context.previousMessages
            .filter(msg => msg.role === 'user')
            .slice(-this.options.maxContextMessages);
        
        // Contar preguntas consecutivas
        for (const msg of userMessages) {
            if (msg.content.endsWith('?')) {
                consecutiveQuestions++;
            } else {
                break;
            }
        }
        
        // Normalizar puntuación (0-1)
        return Math.min(1, consecutiveQuestions / 3);
    }

    /**
     * Calcula la puntuación basada en la longitud del mensaje
     * @param {string} message - Mensaje original
     * @returns {number} - Puntuación (0-1)
     */
    calculateMessageLengthScore(message) {
        if (!message) {
            return 0;
        }
        
        // Mensajes muy cortos o muy largos pueden indicar frustración
        const length = message.length;
        
        if (length < 5) {
            // Mensajes muy cortos (posible frustración)
            return 0.7;
        } else if (length > 200) {
            // Mensajes muy largos (posible explicación detallada de un problema)
            return 0.6;
        } else {
            // Mensajes de longitud normal
            return 0;
        }
    }

    /**
     * Calcula la puntuación basada en la frecuencia de mensajes
     * @param {Object} context - Contexto del mensaje
     * @returns {number} - Puntuación (0-1)
     */
    calculateMessageFrequencyScore(context) {
        if (!context || !context.previousMessages || context.previousMessages.length < 2) {
            return 0;
        }
        
        // Obtener mensajes anteriores del usuario
        const userMessages = context.previousMessages
            .filter(msg => msg.role === 'user')
            .slice(-this.options.maxContextMessages);
        
        if (userMessages.length < 2) {
            return 0;
        }
        
        // Calcular tiempo promedio entre mensajes
        let totalTimeDiff = 0;
        let count = 0;
        
        for (let i = 1; i < userMessages.length; i++) {
            const currentTime = userMessages[i].timestamp || 0;
            const prevTime = userMessages[i - 1].timestamp || 0;
            
            if (currentTime > 0 && prevTime > 0) {
                const timeDiff = currentTime - prevTime;
                totalTimeDiff += timeDiff;
                count++;
            }
        }
        
        if (count === 0) {
            return 0;
        }
        
        const avgTimeDiff = totalTimeDiff / count;
        
        // Mensajes muy frecuentes pueden indicar urgencia o frustración
        // Normalizar puntuación (0-1)
        // Menos de 10 segundos entre mensajes -> puntuación alta
        // Más de 1 minuto entre mensajes -> puntuación baja
        return Math.max(0, Math.min(1, 1 - (avgTimeDiff / this.options.consecutiveMessageTimeThreshold)));
    }

    /**
     * Proporciona retroalimentación sobre una detección
     * @param {string} message - Mensaje original
     * @param {boolean} actualNeedsHuman - Indica si realmente se necesitaba asistencia humana
     * @param {Object} context - Contexto del mensaje
     * @returns {boolean} - true si se procesó correctamente, false en caso contrario
     */
    provideFeedback(message, actualNeedsHuman, context = {}) {
        if (!this.options.enableLearning || !message) {
            return false;
        }
        
        try {
            // Añadir ejemplo al conjunto de entrenamiento
            return this.addTrainingExample(message, actualNeedsHuman);
        } catch (error) {
            logger.error(`Error al proporcionar retroalimentación: ${error.message}`);
            return false;
        }
    }
}

// Exportar una instancia única
module.exports = new HumanAssistanceDetector({
    trainingDataPath: config.HUMAN_ASSISTANCE_TRAINING_DATA_PATH,
    scoreThreshold: config.HUMAN_ASSISTANCE_SCORE_THRESHOLD,
    enableLearning: config.HUMAN_ASSISTANCE_ENABLE_LEARNING
});
