/**
 * intent-recognizer.js - Módulo para reconocer intenciones del usuario
 * 
 * Este módulo implementa un reconocedor de intenciones basado en reglas y palabras clave.
 * Para una implementación más avanzada, se podría utilizar un modelo de IA específico.
 */

// Definición de intenciones con sus palabras clave
const INTENTS = {
    // Intenciones de información general
    GREETING: {
        keywords: ['hola', 'buenos días', 'buenas tardes', 'buenas noches', 'saludos', 'qué tal', 'como estás'],
        priority: 1
    },
    FAREWELL: {
        keywords: ['adiós', 'hasta luego', 'nos vemos', 'chao', 'bye', 'hasta pronto', 'me voy'],
        priority: 1
    },
    THANKS: {
        keywords: ['gracias', 'te agradezco', 'muchas gracias', 'agradecido', 'thank you'],
        priority: 1
    },
    
    // Intenciones de información de productos/servicios
    PRODUCT_INFO: {
        keywords: ['información', 'detalles', 'características', 'especificaciones', 'qué ofrece', 'qué incluye', 'cómo funciona', 'qué es'],
        priority: 3
    },
    PRICE_INFO: {
        keywords: ['precio', 'costo', 'cuánto cuesta', 'valor', 'tarifa', 'cuánto vale', 'presupuesto', 'cotización'],
        priority: 4
    },
    DISCOUNT_INFO: {
        keywords: ['descuento', 'oferta', 'promoción', 'rebaja', 'más barato', 'ahorro', 'cupón'],
        priority: 4
    },
    AVAILABILITY: {
        keywords: ['disponible', 'disponibilidad', 'en stock', 'hay', 'tienen', 'cuándo', 'fecha', 'plazo', 'tiempo'],
        priority: 3
    },
    COMPARISON: {
        keywords: ['comparar', 'diferencia', 'mejor', 'ventaja', 'desventaja', 'versus', 'vs', 'o', 'entre'],
        priority: 3
    },
    
    // Intenciones de proceso de compra
    PURCHASE_INTEREST: {
        keywords: ['comprar', 'adquirir', 'me interesa', 'quiero', 'deseo', 'necesito', 'busco', 'estoy interesado'],
        priority: 5
    },
    PAYMENT_INFO: {
        keywords: ['pago', 'forma de pago', 'método de pago', 'tarjeta', 'transferencia', 'efectivo', 'cómo pagar', 'pagar'],
        priority: 4
    },
    SHIPPING_INFO: {
        keywords: ['envío', 'entrega', 'enviar', 'recibir', 'domicilio', 'dirección', 'cuándo llega', 'tiempo de entrega'],
        priority: 3
    },
    RETURN_POLICY: {
        keywords: ['devolución', 'devolver', 'garantía', 'cambio', 'reembolso', 'política', 'si no me gusta'],
        priority: 2
    },
    
    // Intenciones de soporte/ayuda
    HELP: {
        keywords: ['ayuda', 'ayúdame', 'necesito ayuda', 'problema', 'duda', 'consulta', 'pregunta', 'no entiendo'],
        priority: 4
    },
    COMPLAINT: {
        keywords: ['queja', 'reclamar', 'reclamo', 'insatisfecho', 'molesto', 'enojado', 'mal servicio', 'no funciona'],
        priority: 5
    },
    SPEAK_AGENT: {
        keywords: ['hablar con persona', 'agente humano', 'representante', 'persona real', 'supervisor', 'no bot', 'servicio al cliente'],
        priority: 5
    },
    
    // Intenciones de información personal
    PROVIDE_CONTACT: {
        keywords: ['mi número', 'mi teléfono', 'mi correo', 'mi email', 'contactarme', 'mi contacto', 'mi nombre es', 'me llamo', 'soy'],
        priority: 4
    },
    REQUEST_CALLBACK: {
        keywords: ['llamarme', 'devolver llamada', 'contactarme', 'comunicarse conmigo', 'llamar más tarde'],
        priority: 4
    },
    
    // Intenciones de navegación/proceso
    RESTART: {
        keywords: ['reiniciar', 'comenzar de nuevo', 'empezar de nuevo', 'borrar', 'olvidar', 'reset'],
        priority: 5
    },
    CANCEL: {
        keywords: ['cancelar', 'anular', 'no quiero', 'desistir', 'olvidalo', 'dejalo', 'no me interesa'],
        priority: 5
    }
};

/**
 * Reconoce intenciones en un mensaje
 * @param {string} message - Mensaje a analizar
 * @param {Object} options - Opciones adicionales
 * @returns {Object} - Intenciones reconocidas
 */
function recognizeIntents(message, options = {}) {
    if (!message || typeof message !== 'string') {
        return {
            primaryIntent: null,
            allIntents: [],
            confidence: 0,
            entities: {}
        };
    }
    
    // Convertir a minúsculas para facilitar la comparación
    const lowerMessage = message.toLowerCase();
    
    // Almacenar coincidencias por intención
    const matches = {};
    
    // Analizar cada intención
    Object.entries(INTENTS).forEach(([intent, data]) => {
        let intentMatches = 0;
        const matchedKeywords = [];
        
        // Contar coincidencias de palabras clave
        data.keywords.forEach(keyword => {
            if (lowerMessage.includes(keyword)) {
                intentMatches++;
                matchedKeywords.push(keyword);
            }
        });
        
        // Si hay coincidencias, guardar información
        if (intentMatches > 0) {
            matches[intent] = {
                count: intentMatches,
                priority: data.priority,
                score: intentMatches * data.priority, // Puntuación = coincidencias * prioridad
                matchedKeywords
            };
        }
    });
    
    // Ordenar intenciones por puntuación
    const sortedIntents = Object.entries(matches)
        .sort((a, b) => b[1].score - a[1].score)
        .map(([intent, data]) => ({
            intent,
            score: data.score,
            confidence: Math.min(1, data.score / 10), // Normalizar confianza (0-1)
            matchedKeywords: data.matchedKeywords
        }));
    
    // Extraer entidades (información específica)
    const entities = extractEntities(message);
    
    return {
        primaryIntent: sortedIntents.length > 0 ? sortedIntents[0].intent : null,
        allIntents: sortedIntents,
        confidence: sortedIntents.length > 0 ? sortedIntents[0].confidence : 0,
        entities
    };
}

/**
 * Extrae entidades (información específica) del mensaje
 * @param {string} message - Mensaje a analizar
 * @returns {Object} - Entidades extraídas
 */
function extractEntities(message) {
    const entities = {};
    
    // Extraer correo electrónico
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const emails = message.match(emailRegex);
    if (emails && emails.length > 0) {
        entities.email = emails[0];
    }
    
    // Extraer número de teléfono (varios formatos)
    const phoneRegex = /(\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/g;
    const phones = message.match(phoneRegex);
    if (phones && phones.length > 0) {
        entities.phone = phones[0];
    }
    
    // Extraer nombre (después de "me llamo", "soy", "mi nombre es")
    const nameRegex = /(me llamo|soy|mi nombre es)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+)(?:\.|,|\s|$)/i;
    const nameMatch = message.match(nameRegex);
    if (nameMatch && nameMatch[2]) {
        entities.name = nameMatch[2].trim();
    }
    
    // Extraer producto/servicio (después de "interesado en", "quiero", "necesito")
    const productRegex = /(interesado en|quiero|necesito|busco)\s+([A-Za-zÀ-ÖØ-öø-ÿ\s]+)(?:\.|,|\s|$)/i;
    const productMatch = message.match(productRegex);
    if (productMatch && productMatch[2]) {
        entities.product = productMatch[2].trim();
    }
    
    return entities;
}

/**
 * Genera una respuesta basada en la intención reconocida
 * @param {Object} intentResult - Resultado del reconocimiento de intenciones
 * @param {Object} context - Contexto de la conversación
 * @returns {Object} - Respuesta generada
 */
function generateResponse(intentResult, context = {}) {
    if (!intentResult.primaryIntent) {
        return {
            message: 'No he entendido bien tu mensaje. ¿Podrías ser más específico?',
            action: 'ASK_CLARIFICATION'
        };
    }
    
    // Respuestas por intención
    const responses = {
        GREETING: {
            message: `¡Hola${context.clientName ? ', ' + context.clientName : ''}! ¿En qué puedo ayudarte hoy?`,
            action: 'CONTINUE_CONVERSATION'
        },
        FAREWELL: {
            message: `¡Hasta luego${context.clientName ? ', ' + context.clientName : ''}! Ha sido un placer atenderte. Si necesitas algo más, no dudes en escribirme.`,
            action: 'END_CONVERSATION'
        },
        THANKS: {
            message: '¡De nada! Estoy aquí para ayudarte. ¿Hay algo más en lo que pueda asistirte?',
            action: 'CONTINUE_CONVERSATION'
        },
        PRODUCT_INFO: {
            message: 'Tenemos varios productos/servicios que podrían interesarte. ¿Sobre cuál te gustaría más información?',
            action: 'PROVIDE_PRODUCT_INFO'
        },
        PRICE_INFO: {
            message: 'Los precios varían según el producto/servicio. ¿Sobre cuál te gustaría conocer el precio?',
            action: 'PROVIDE_PRICE_INFO'
        },
        DISCOUNT_INFO: {
            message: 'Actualmente tenemos varias promociones disponibles. ¿Te interesa algún producto/servicio en particular?',
            action: 'PROVIDE_DISCOUNT_INFO'
        },
        AVAILABILITY: {
            message: 'La disponibilidad depende del producto/servicio. ¿Cuál te interesa específicamente?',
            action: 'PROVIDE_AVAILABILITY_INFO'
        },
        COMPARISON: {
            message: 'Puedo ayudarte a comparar nuestros productos/servicios. ¿Cuáles te gustaría comparar?',
            action: 'PROVIDE_COMPARISON'
        },
        PURCHASE_INTEREST: {
            message: '¡Excelente elección! Para proceder con la compra, necesitaré algunos datos. ¿Podrías proporcionarme tu nombre completo?',
            action: 'COLLECT_CONTACT_INFO'
        },
        PAYMENT_INFO: {
            message: 'Aceptamos diversos métodos de pago: tarjeta de crédito/débito, transferencia bancaria y efectivo. ¿Cuál prefieres?',
            action: 'PROVIDE_PAYMENT_INFO'
        },
        SHIPPING_INFO: {
            message: 'Realizamos envíos a todo el país. El tiempo de entrega varía según la ubicación, generalmente entre 3-5 días hábiles. ¿Cuál es tu dirección de envío?',
            action: 'PROVIDE_SHIPPING_INFO'
        },
        RETURN_POLICY: {
            message: 'Nuestra política de devolución permite cambios o reembolsos dentro de los 14 días posteriores a la compra, siempre que el producto esté en perfectas condiciones.',
            action: 'PROVIDE_RETURN_POLICY'
        },
        HELP: {
            message: 'Estoy aquí para ayudarte. ¿Podrías especificar en qué necesitas asistencia?',
            action: 'PROVIDE_HELP'
        },
        COMPLAINT: {
            message: 'Lamento mucho que hayas tenido una mala experiencia. Me gustaría ayudarte a resolver este problema. ¿Podrías darme más detalles?',
            action: 'HANDLE_COMPLAINT'
        },
        SPEAK_AGENT: {
            message: 'Entiendo que prefieras hablar con un agente humano. Voy a transferir esta conversación a uno de nuestros representantes. ¿Podrías proporcionarme tu número de teléfono para que te contacten?',
            action: 'TRANSFER_TO_AGENT'
        },
        PROVIDE_CONTACT: {
            message: 'Gracias por proporcionarme tus datos de contacto. Los he registrado correctamente.',
            action: 'SAVE_CONTACT_INFO'
        },
        REQUEST_CALLBACK: {
            message: 'Con gusto programaré una llamada para ti. ¿Cuál sería el mejor momento para contactarte?',
            action: 'SCHEDULE_CALLBACK'
        },
        RESTART: {
            message: 'Voy a reiniciar nuestra conversación. ¿En qué puedo ayudarte hoy?',
            action: 'RESTART_CONVERSATION'
        },
        CANCEL: {
            message: 'He cancelado el proceso. ¿Hay algo más en lo que pueda ayudarte?',
            action: 'CANCEL_PROCESS'
        }
    };
    
    // Obtener respuesta para la intención primaria
    const response = responses[intentResult.primaryIntent] || {
        message: 'Entiendo. ¿Podrías darme más detalles para ayudarte mejor?',
        action: 'ASK_CLARIFICATION'
    };
    
    // Personalizar respuesta con entidades extraídas
    let personalizedMessage = response.message;
    
    if (intentResult.entities.name && !context.clientName) {
        personalizedMessage = `Gracias, ${intentResult.entities.name}. ` + personalizedMessage;
    }
    
    if (intentResult.entities.product && response.action === 'PROVIDE_PRODUCT_INFO') {
        personalizedMessage = `Claro, te cuento sobre ${intentResult.entities.product}. ` + 
            `Es uno de nuestros productos más populares. ¿Te gustaría conocer más detalles o el precio?`;
    }
    
    return {
        message: personalizedMessage,
        action: response.action,
        entities: intentResult.entities
    };
}

module.exports = {
    recognizeIntents,
    extractEntities,
    generateResponse,
    INTENTS
};
