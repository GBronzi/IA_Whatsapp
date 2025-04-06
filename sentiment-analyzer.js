/**
 * sentiment-analyzer.js - Módulo para analizar el sentimiento de los mensajes
 * 
 * Este módulo implementa un analizador de sentimiento básico basado en reglas
 * y palabras clave. Para una implementación más avanzada, se podría utilizar
 * un modelo de IA específico para análisis de sentimiento.
 */

// Palabras clave positivas en español
const POSITIVE_KEYWORDS = [
    'gracias', 'excelente', 'bueno', 'genial', 'fantástico', 'maravilloso',
    'encantado', 'feliz', 'contento', 'satisfecho', 'perfecto', 'increíble',
    'me gusta', 'me encanta', 'estupendo', 'magnífico', 'brillante', 'espectacular',
    'agradecido', 'útil', 'servicial', 'amable', 'rápido', 'eficiente',
    'recomendaré', 'recomendaría', 'positivo', 'fácil', 'claro', 'sencillo',
    'sí', 'por supuesto', 'definitivamente', 'seguro', 'interesado', 'quiero',
    'compraré', 'adquirir', 'me interesa', 'me gustaría', 'deseo', 'acepto'
];

// Palabras clave negativas en español
const NEGATIVE_KEYWORDS = [
    'malo', 'terrible', 'horrible', 'pésimo', 'deficiente', 'decepcionado',
    'decepcionante', 'insatisfecho', 'molesto', 'enfadado', 'enojado', 'frustrado',
    'no me gusta', 'odio', 'detesto', 'lento', 'ineficiente', 'complicado',
    'difícil', 'confuso', 'problema', 'error', 'fallo', 'queja', 'reclamar',
    'demasiado caro', 'costoso', 'caro', 'no funciona', 'roto', 'estropeado',
    'no', 'nunca', 'jamás', 'cancelar', 'devolver', 'reembolso', 'devolución',
    'no entiendo', 'no comprendo', 'no me interesa', 'no quiero', 'imposible'
];

// Palabras clave de urgencia o prioridad
const URGENCY_KEYWORDS = [
    'urgente', 'inmediato', 'rápido', 'pronto', 'ahora', 'enseguida',
    'necesito ya', 'lo antes posible', 'cuanto antes', 'emergencia',
    'importante', 'prioritario', 'crítico', 'crucial', 'esencial',
    'no puedo esperar', 'para hoy', 'mañana', 'esta semana'
];

// Emojis positivos
const POSITIVE_EMOJIS = [
    '😊', '😃', '😄', '😁', '😀', '🙂', '😉', '👍', '👌', '👏',
    '❤️', '💕', '💖', '💯', '🔥', '✅', '✔️', '🎉', '🎊', '🤩'
];

// Emojis negativos
const NEGATIVE_EMOJIS = [
    '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩',
    '😢', '😭', '😤', '😠', '😡', '👎', '❌', '⛔', '🚫', '💔'
];

/**
 * Analiza el sentimiento de un mensaje
 * @param {string} message - Mensaje a analizar
 * @returns {Object} - Resultado del análisis
 */
function analyzeSentiment(message) {
    if (!message || typeof message !== 'string') {
        return {
            sentiment: 'neutral',
            score: 0,
            urgency: 0,
            details: {
                positiveMatches: [],
                negativeMatches: [],
                urgencyMatches: []
            }
        };
    }
    
    // Convertir a minúsculas para facilitar la comparación
    const lowerMessage = message.toLowerCase();
    
    // Contar coincidencias de palabras clave
    let positiveScore = 0;
    let negativeScore = 0;
    let urgencyScore = 0;
    
    // Almacenar palabras coincidentes para análisis detallado
    const positiveMatches = [];
    const negativeMatches = [];
    const urgencyMatches = [];
    
    // Analizar palabras clave positivas
    POSITIVE_KEYWORDS.forEach(keyword => {
        if (lowerMessage.includes(keyword)) {
            positiveScore++;
            positiveMatches.push(keyword);
        }
    });
    
    // Analizar palabras clave negativas
    NEGATIVE_KEYWORDS.forEach(keyword => {
        if (lowerMessage.includes(keyword)) {
            negativeScore++;
            negativeMatches.push(keyword);
        }
    });
    
    // Analizar palabras clave de urgencia
    URGENCY_KEYWORDS.forEach(keyword => {
        if (lowerMessage.includes(keyword)) {
            urgencyScore++;
            urgencyMatches.push(keyword);
        }
    });
    
    // Analizar emojis positivos
    POSITIVE_EMOJIS.forEach(emoji => {
        const count = (message.match(new RegExp(emoji, 'g')) || []).length;
        positiveScore += count;
        if (count > 0) {
            positiveMatches.push(emoji);
        }
    });
    
    // Analizar emojis negativos
    NEGATIVE_EMOJIS.forEach(emoji => {
        const count = (message.match(new RegExp(emoji, 'g')) || []).length;
        negativeScore += count;
        if (count > 0) {
            negativeMatches.push(emoji);
        }
    });
    
    // Calcular puntuación final
    const finalScore = positiveScore - negativeScore;
    
    // Determinar sentimiento
    let sentiment;
    if (finalScore > 2) {
        sentiment = 'very_positive';
    } else if (finalScore > 0) {
        sentiment = 'positive';
    } else if (finalScore < -2) {
        sentiment = 'very_negative';
    } else if (finalScore < 0) {
        sentiment = 'negative';
    } else {
        sentiment = 'neutral';
    }
    
    // Normalizar puntuación de urgencia (0-10)
    const normalizedUrgency = Math.min(10, urgencyScore * 2);
    
    return {
        sentiment,
        score: finalScore,
        urgency: normalizedUrgency,
        details: {
            positiveMatches: [...new Set(positiveMatches)],
            negativeMatches: [...new Set(negativeMatches)],
            urgencyMatches: [...new Set(urgencyMatches)]
        }
    };
}

/**
 * Analiza una conversación completa para detectar tendencias
 * @param {Array} messages - Lista de mensajes
 * @returns {Object} - Análisis de la conversación
 */
function analyzeConversation(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return {
            overallSentiment: 'neutral',
            averageScore: 0,
            sentimentTrend: 'stable',
            urgencyLevel: 0,
            messageCount: 0
        };
    }
    
    // Analizar cada mensaje
    const analyses = messages.map(msg => analyzeSentiment(msg.content || msg));
    
    // Calcular puntuación promedio
    const scores = analyses.map(a => a.score);
    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Calcular nivel de urgencia promedio
    const urgencyScores = analyses.map(a => a.urgency);
    const averageUrgency = urgencyScores.reduce((sum, score) => sum + score, 0) / urgencyScores.length;
    
    // Determinar tendencia (comparando primera y segunda mitad de la conversación)
    let sentimentTrend = 'stable';
    if (messages.length >= 4) {
        const midpoint = Math.floor(messages.length / 2);
        const firstHalfScores = scores.slice(0, midpoint);
        const secondHalfScores = scores.slice(midpoint);
        
        const firstHalfAvg = firstHalfScores.reduce((sum, score) => sum + score, 0) / firstHalfScores.length;
        const secondHalfAvg = secondHalfScores.reduce((sum, score) => sum + score, 0) / secondHalfScores.length;
        
        const difference = secondHalfAvg - firstHalfAvg;
        
        if (difference > 1) {
            sentimentTrend = 'improving';
        } else if (difference < -1) {
            sentimentTrend = 'deteriorating';
        }
    }
    
    // Determinar sentimiento general
    let overallSentiment;
    if (averageScore > 2) {
        overallSentiment = 'very_positive';
    } else if (averageScore > 0) {
        overallSentiment = 'positive';
    } else if (averageScore < -2) {
        overallSentiment = 'very_negative';
    } else if (averageScore < 0) {
        overallSentiment = 'negative';
    } else {
        overallSentiment = 'neutral';
    }
    
    return {
        overallSentiment,
        averageScore,
        sentimentTrend,
        urgencyLevel: averageUrgency,
        messageCount: messages.length
    };
}

/**
 * Genera recomendaciones basadas en el análisis de sentimiento
 * @param {Object} analysis - Resultado del análisis
 * @returns {Array} - Lista de recomendaciones
 */
function generateRecommendations(analysis) {
    const recommendations = [];
    
    // Recomendaciones basadas en el sentimiento
    if (analysis.sentiment === 'very_negative' || analysis.sentiment === 'negative') {
        recommendations.push('El cliente muestra signos de insatisfacción. Considera ofrecer una solución inmediata o escalar a un supervisor.');
        recommendations.push('Utiliza un tono empático y comprensivo. Reconoce su frustración y muestra disposición para resolver el problema.');
    } else if (analysis.sentiment === 'neutral') {
        recommendations.push('El cliente no muestra una inclinación clara. Intenta generar interés con preguntas abiertas y destacando beneficios.');
        recommendations.push('Proporciona información relevante y personalizada para despertar emociones positivas.');
    } else if (analysis.sentiment === 'positive' || analysis.sentiment === 'very_positive') {
        recommendations.push('El cliente muestra interés positivo. Es un buen momento para sugerir productos adicionales o complementarios.');
        recommendations.push('Refuerza su decisión con comentarios positivos y agradece su interés.');
    }
    
    // Recomendaciones basadas en la urgencia
    if (analysis.urgency >= 7) {
        recommendations.push('El cliente muestra alta urgencia. Prioriza esta conversación y ofrece soluciones inmediatas.');
    } else if (analysis.urgency >= 4) {
        recommendations.push('El cliente muestra cierta urgencia. Considera acelerar el proceso de venta o atención.');
    }
    
    // Recomendaciones basadas en palabras clave específicas
    if (analysis.details) {
        if (analysis.details.negativeMatches.includes('caro') || analysis.details.negativeMatches.includes('costoso')) {
            recommendations.push('El cliente muestra preocupación por el precio. Considera destacar el valor y beneficios, o mencionar opciones de financiamiento.');
        }
        
        if (analysis.details.positiveMatches.includes('interesado') || analysis.details.positiveMatches.includes('me interesa')) {
            recommendations.push('El cliente muestra interés explícito. Es un buen momento para cerrar la venta o avanzar al siguiente paso.');
        }
    }
    
    return recommendations;
}

module.exports = {
    analyzeSentiment,
    analyzeConversation,
    generateRecommendations
};
