/**
 * ai-models.js - Configuración y gestión de modelos de IA optimizados para ventas
 */

// Lista de modelos de IA recomendados para ventas, ordenados por requisitos de recursos
const AI_MODELS = [
    {
        id: 'llama3.1-8b-q4',
        name: 'Llama 3.1 8B (Cuantizado)',
        description: 'Versión ligera de Llama 3.1 con 8B de parámetros, optimizada para equipos con recursos limitados.',
        requirements: {
            ram: '4GB+',
            vram: 'No requerida',
            disk: '5GB'
        },
        performance: 'Buena',
        url: 'https://ollama.com/library/llama3.1:8b-q4',
        command: 'ollama pull llama3.1:8b-q4',
        tags: ['ligero', 'rápido', 'recursos-bajos']
    },
    {
        id: 'mistral-7b-instruct-q4',
        name: 'Mistral 7B Instruct (Cuantizado)',
        description: 'Modelo Mistral optimizado para instrucciones, con buena relación rendimiento/recursos.',
        requirements: {
            ram: '4GB+',
            vram: 'No requerida',
            disk: '4GB'
        },
        performance: 'Buena',
        url: 'https://ollama.com/library/mistral:7b-instruct-q4',
        command: 'ollama pull mistral:7b-instruct-q4',
        tags: ['ligero', 'instrucciones', 'recursos-bajos']
    },
    {
        id: 'phi3-mini-4k-instruct-q4',
        name: 'Phi-3 Mini 4K (Cuantizado)',
        description: 'Modelo pequeño pero potente, ideal para equipos con muy pocos recursos.',
        requirements: {
            ram: '2GB+',
            vram: 'No requerida',
            disk: '2GB'
        },
        performance: 'Moderada',
        url: 'https://ollama.com/library/phi3:mini-4k-instruct-q4',
        command: 'ollama pull phi3:mini-4k-instruct-q4',
        tags: ['muy-ligero', 'recursos-mínimos']
    },
    {
        id: 'llama3.2-1b-q4',
        name: 'Llama 3.2 1B (Cuantizado)',
        description: 'La versión más pequeña de Llama 3.2, extremadamente ligera.',
        requirements: {
            ram: '2GB+',
            vram: 'No requerida',
            disk: '1GB'
        },
        performance: 'Básica',
        url: 'https://ollama.com/library/llama3.2:1b-q4',
        command: 'ollama pull llama3.2:1b-q4',
        tags: ['ultra-ligero', 'recursos-mínimos']
    },
    {
        id: 'llama3.2-3b-q4',
        name: 'Llama 3.2 3B (Cuantizado)',
        description: 'Versión de 3B parámetros, buen equilibrio entre rendimiento y recursos.',
        requirements: {
            ram: '3GB+',
            vram: 'No requerida',
            disk: '2GB'
        },
        performance: 'Moderada',
        url: 'https://ollama.com/library/llama3.2:3b-q4',
        command: 'ollama pull llama3.2:3b-q4',
        tags: ['ligero', 'equilibrado']
    },
    {
        id: 'llama3.2-8b-q4',
        name: 'Llama 3.2 8B (Cuantizado)',
        description: 'Versión de 8B parámetros, buen rendimiento para equipos de recursos medios.',
        requirements: {
            ram: '6GB+',
            vram: 'No requerida',
            disk: '5GB'
        },
        performance: 'Buena',
        url: 'https://ollama.com/library/llama3.2:8b-q4',
        command: 'ollama pull llama3.2:8b-q4',
        tags: ['medio', 'equilibrado']
    },
    {
        id: 'llama3.2-70b-q4',
        name: 'Llama 3.2 70B (Cuantizado)',
        description: 'Versión completa de Llama 3.2, excelente rendimiento pero requiere más recursos.',
        requirements: {
            ram: '16GB+',
            vram: 'Recomendada',
            disk: '40GB'
        },
        performance: 'Excelente',
        url: 'https://ollama.com/library/llama3.2:70b-q4',
        command: 'ollama pull llama3.2:70b-q4',
        tags: ['pesado', 'alto-rendimiento']
    }
];

// Prompts optimizados para ventas según el modelo
const SALES_PROMPTS = {
    // Prompt básico para modelos pequeños (1B-3B)
    basic: `Eres un asistente virtual de ventas para {business_name}. Tu objetivo es conversar amigablemente con el usuario, entender sus necesidades y recolectar información básica como nombre, correo, teléfono, producto de interés y método de pago preferido.

Sé amable y profesional. No solicites toda la información de una vez. Adapta tus respuestas según el contexto de la conversación.

Información sobre nuestros productos:
{products_info}

Aquí está la conversación hasta ahora:
{conversation_history}`,

    // Prompt estándar para modelos medianos (7B-8B)
    standard: `Eres un asistente virtual de ventas para {business_name}. Tu objetivo es conversar amigablemente con el usuario, entender sus necesidades y recolectar la siguiente información:
1. Nombre completo
2. Dirección de correo electrónico
3. Número de teléfono
4. Producto o servicio de interés
5. Método de pago preferido

Instrucciones importantes:
- Sé conversacional y natural, no hagas preguntas directas tipo formulario.
- Adapta tus respuestas al contexto de la conversación.
- Proporciona información precisa sobre los productos/servicios cuando te pregunten.
- Si el usuario ya proporcionó algún dato, no lo solicites nuevamente.
- Mantén un tono amigable y profesional en todo momento.

Información sobre nuestros productos/servicios:
{products_info}

Aquí está la conversación hasta ahora:
{conversation_history}`,

    // Prompt avanzado para modelos grandes (70B+)
    advanced: `Eres un asistente virtual de ventas experto para {business_name}. Tu objetivo es conversar amigablemente con el usuario, entender sus necesidades y recolectar la siguiente información:
1. Nombre completo
2. Dirección de correo electrónico
3. Número de teléfono (con código de país/área si es posible)
4. Producto o servicio específico de interés
5. Método de pago preferido (Ej: transferencia, tarjeta, efectivo)
6. Cualquier requisito especial o personalización deseada

Instrucciones importantes:
- Sé conversacional y natural, no hagas preguntas directas tipo formulario.
- Adapta tus respuestas al contexto de la conversación y personalidad del cliente.
- Proporciona información detallada sobre los productos/servicios cuando te pregunten.
- Utiliza técnicas de venta consultiva: identifica problemas, ofrece soluciones personalizadas.
- Si detectas objeciones, abórdalas con empatía y datos relevantes.
- Sugiere productos complementarios o superiores cuando sea apropiado.
- Si el usuario ya proporcionó algún dato, no lo solicites nuevamente.
- Mantén un tono amigable, profesional y entusiasta en todo momento.
- Analiza el sentimiento del cliente y ajusta tu enfoque según sea necesario.

Información detallada sobre nuestros productos/servicios:
{products_info}

Aquí está la conversación hasta ahora:
{conversation_history}`
};

/**
 * Obtiene la lista completa de modelos de IA disponibles
 * @returns {Array} - Lista de modelos de IA
 */
function getAvailableModels() {
    return AI_MODELS;
}

/**
 * Obtiene un modelo de IA por su ID
 * @param {string} modelId - ID del modelo
 * @returns {Object|null} - Información del modelo o null si no existe
 */
function getModelById(modelId) {
    return AI_MODELS.find(model => model.id === modelId) || null;
}

/**
 * Obtiene modelos recomendados según los recursos disponibles
 * @param {Object} resources - Recursos disponibles (ram en GB)
 * @returns {Array} - Lista de modelos recomendados
 */
function getRecommendedModels(resources = {}) {
    const availableRam = resources.ram || 4; // GB, por defecto 4GB
    
    return AI_MODELS.filter(model => {
        const requiredRam = parseInt(model.requirements.ram) || 0;
        return requiredRam <= availableRam;
    }).sort((a, b) => {
        // Ordenar por rendimiento (convertir a valor numérico)
        const performanceMap = {
            'Básica': 1,
            'Moderada': 2,
            'Buena': 3,
            'Excelente': 4
        };
        
        return performanceMap[b.performance] - performanceMap[a.performance];
    });
}

/**
 * Genera un prompt optimizado según el modelo seleccionado
 * @param {string} modelId - ID del modelo
 * @param {Object} data - Datos para el prompt (business_name, products_info, conversation_history)
 * @returns {string} - Prompt optimizado
 */
function generatePrompt(modelId, data = {}) {
    const model = getModelById(modelId);
    let promptTemplate;
    
    // Seleccionar plantilla según el tamaño del modelo
    if (!model) {
        promptTemplate = SALES_PROMPTS.standard; // Por defecto
    } else if (model.id.includes('1b') || model.id.includes('3b')) {
        promptTemplate = SALES_PROMPTS.basic;
    } else if (model.id.includes('70b')) {
        promptTemplate = SALES_PROMPTS.advanced;
    } else {
        promptTemplate = SALES_PROMPTS.standard;
    }
    
    // Reemplazar variables en la plantilla
    return promptTemplate
        .replace('{business_name}', data.business_name || 'nuestra empresa')
        .replace('{products_info}', data.products_info || 'Información no disponible.')
        .replace('{conversation_history}', data.conversation_history || '');
}

module.exports = {
    getAvailableModels,
    getModelById,
    getRecommendedModels,
    generatePrompt,
    AI_MODELS
};
