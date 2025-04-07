/**
 * controllers/predictive-analytics.js - Controlador para análisis predictivo
 */

const database = require('../../database');
const crmManager = require('../../crm-manager');
const { LinearRegression, KMeans, NaiveBayes } = require('../models/ml-models');

/**
 * Predice el comportamiento futuro de los clientes
 * @returns {Promise<Array>} - Predicciones de comportamiento
 */
async function predictClientBehavior() {
  try {
    // Obtener datos de clientes e interacciones
    const clients = await crmManager.getClients();
    const clientPredictions = [];
    
    for (const client of clients) {
      // Obtener interacciones del cliente
      const interactions = await crmManager.getInteractions(client.phone);
      
      if (interactions.length < 3) {
        // No hay suficientes datos para hacer predicciones
        continue;
      }
      
      // Extraer características para el modelo
      const features = extractClientFeatures(client, interactions);
      
      // Predecir probabilidad de conversión
      const conversionProbability = predictConversion(features);
      
      // Predecir próxima interacción
      const nextInteraction = predictNextInteraction(features);
      
      // Predecir valor del cliente
      const customerValue = predictCustomerValue(features);
      
      // Añadir predicciones
      clientPredictions.push({
        client: {
          phone: client.phone,
          name: client.name
        },
        predictions: {
          conversionProbability,
          nextInteraction,
          customerValue
        }
      });
    }
    
    return clientPredictions;
  } catch (error) {
    console.error('Error al predecir comportamiento de clientes:', error);
    throw error;
  }
}

/**
 * Predice las ventas futuras
 * @param {string} period - Período de predicción ('daily', 'weekly', 'monthly')
 * @returns {Promise<Object>} - Pronóstico de ventas
 */
async function predictSales(period = 'monthly') {
  try {
    // Obtener datos históricos de ventas
    const salesData = await getSalesHistoricalData(period);
    
    if (salesData.length < 5) {
      throw new Error('No hay suficientes datos históricos para hacer predicciones');
    }
    
    // Crear modelo de regresión lineal
    const model = new LinearRegression();
    
    // Preparar datos para el modelo
    const X = salesData.map((data, index) => [index + 1]); // Característica: índice de tiempo
    const y = salesData.map(data => data.value); // Objetivo: valor de ventas
    
    // Entrenar modelo
    model.fit(X, y);
    
    // Predecir próximos períodos
    const futurePeriods = 6; // Predecir los próximos 6 períodos
    const predictions = [];
    
    for (let i = 1; i <= futurePeriods; i++) {
      const futureIndex = X.length + i;
      const predictedValue = model.predict([[futureIndex]]);
      
      predictions.push({
        period: getNextPeriodLabel(salesData[salesData.length - 1].period, i, period),
        value: Math.max(0, predictedValue) // Asegurar que no sea negativo
      });
    }
    
    return {
      historical: salesData,
      predictions,
      period
    };
  } catch (error) {
    console.error('Error al predecir ventas:', error);
    throw error;
  }
}

/**
 * Segmenta los clientes en grupos según su comportamiento
 * @returns {Promise<Object>} - Segmentos de clientes
 */
async function segmentClients() {
  try {
    // Obtener datos de clientes e interacciones
    const clients = await crmManager.getClients();
    const clientFeatures = [];
    const clientsData = [];
    
    for (const client of clients) {
      // Obtener interacciones del cliente
      const interactions = await crmManager.getInteractions(client.phone);
      
      // Extraer características para el modelo
      const features = extractClientFeatures(client, interactions);
      
      // Añadir características
      clientFeatures.push([
        features.interactionCount,
        features.averageResponseTime,
        features.sentimentScore,
        features.daysSinceLastInteraction
      ]);
      
      clientsData.push({
        phone: client.phone,
        name: client.name,
        features
      });
    }
    
    if (clientFeatures.length < 5) {
      throw new Error('No hay suficientes clientes para hacer segmentación');
    }
    
    // Crear modelo de clustering
    const k = Math.min(5, Math.floor(clientFeatures.length / 2)); // Número de clusters
    const model = new KMeans(k);
    
    // Entrenar modelo
    const clusters = model.fit(clientFeatures);
    
    // Organizar clientes por segmento
    const segments = Array(k).fill().map(() => []);
    
    for (let i = 0; i < clientsData.length; i++) {
      const clusterIndex = clusters[i];
      segments[clusterIndex].push(clientsData[i]);
    }
    
    // Generar descripciones de segmentos
    const segmentDescriptions = generateSegmentDescriptions(segments, clientFeatures);
    
    return {
      segments: segments.map((clients, index) => ({
        id: index + 1,
        name: segmentDescriptions[index].name,
        description: segmentDescriptions[index].description,
        clients,
        count: clients.length
      })),
      totalClients: clientsData.length
    };
  } catch (error) {
    console.error('Error al segmentar clientes:', error);
    throw error;
  }
}

/**
 * Obtiene recomendaciones personalizadas para un cliente
 * @param {string} phone - Número de teléfono del cliente
 * @returns {Promise<Object>} - Recomendaciones personalizadas
 */
async function getPersonalizedRecommendations(phone) {
  try {
    // Obtener datos del cliente
    const client = await crmManager.getClient(phone);
    
    if (!client) {
      throw new Error('Cliente no encontrado');
    }
    
    // Obtener interacciones del cliente
    const interactions = await crmManager.getInteractions(phone);
    
    // Extraer características para el modelo
    const features = extractClientFeatures(client, interactions);
    
    // Obtener productos disponibles
    const products = await crmManager.getProducts();
    
    // Crear modelo de recomendación
    const model = new NaiveBayes();
    
    // Entrenar modelo con datos históricos
    const trainingData = await getRecommendationTrainingData();
    model.fit(trainingData.features, trainingData.labels);
    
    // Predecir productos recomendados
    const recommendedProducts = [];
    
    for (const product of products) {
      const probability = model.predictProbability([
        ...Object.values(features),
        product.id
      ]);
      
      if (probability > 0.3) { // Umbral de probabilidad
        recommendedProducts.push({
          ...product,
          probability
        });
      }
    }
    
    // Ordenar por probabilidad
    recommendedProducts.sort((a, b) => b.probability - a.probability);
    
    // Generar mensajes personalizados
    const messages = generatePersonalizedMessages(client, features, recommendedProducts);
    
    return {
      client,
      recommendations: recommendedProducts.slice(0, 5), // Top 5 recomendaciones
      messages
    };
  } catch (error) {
    console.error('Error al obtener recomendaciones personalizadas:', error);
    throw error;
  }
}

/**
 * Extrae características de un cliente y sus interacciones
 * @param {Object} client - Datos del cliente
 * @param {Array} interactions - Interacciones del cliente
 * @returns {Object} - Características extraídas
 */
function extractClientFeatures(client, interactions) {
  // Número de interacciones
  const interactionCount = interactions.length;
  
  // Tiempo promedio de respuesta
  let totalResponseTime = 0;
  let responseCount = 0;
  
  for (let i = 0; i < interactions.length - 1; i++) {
    if (interactions[i].role === 'user' && interactions[i + 1].role === 'assistant') {
      const responseTime = new Date(interactions[i + 1].timestamp) - new Date(interactions[i].timestamp);
      totalResponseTime += responseTime;
      responseCount++;
    }
  }
  
  const averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;
  
  // Puntuación de sentimiento
  let sentimentScore = 0;
  
  for (const interaction of interactions) {
    if (interaction.sentiment) {
      switch (interaction.sentiment) {
        case 'very_positive':
          sentimentScore += 2;
          break;
        case 'positive':
          sentimentScore += 1;
          break;
        case 'neutral':
          sentimentScore += 0;
          break;
        case 'negative':
          sentimentScore -= 1;
          break;
        case 'very_negative':
          sentimentScore -= 2;
          break;
      }
    }
  }
  
  // Normalizar puntuación de sentimiento
  sentimentScore = interactionCount > 0 ? sentimentScore / interactionCount : 0;
  
  // Días desde la última interacción
  let daysSinceLastInteraction = 0;
  
  if (interactions.length > 0) {
    const lastInteraction = new Date(interactions[interactions.length - 1].timestamp);
    const now = new Date();
    daysSinceLastInteraction = Math.floor((now - lastInteraction) / (1000 * 60 * 60 * 24));
  }
  
  // Tasa de respuesta
  const userMessages = interactions.filter(interaction => interaction.role === 'user').length;
  const assistantMessages = interactions.filter(interaction => interaction.role === 'assistant').length;
  const responseRate = userMessages > 0 ? assistantMessages / userMessages : 0;
  
  return {
    interactionCount,
    averageResponseTime,
    sentimentScore,
    daysSinceLastInteraction,
    responseRate,
    status: client.status || 'unknown'
  };
}

/**
 * Predice la probabilidad de conversión de un cliente
 * @param {Object} features - Características del cliente
 * @returns {number} - Probabilidad de conversión (0-1)
 */
function predictConversion(features) {
  // Modelo simple basado en reglas
  let probability = 0.5; // Probabilidad base
  
  // Ajustar según el número de interacciones
  if (features.interactionCount > 10) {
    probability += 0.2;
  } else if (features.interactionCount > 5) {
    probability += 0.1;
  } else if (features.interactionCount < 2) {
    probability -= 0.2;
  }
  
  // Ajustar según el sentimiento
  probability += features.sentimentScore * 0.1;
  
  // Ajustar según el tiempo desde la última interacción
  if (features.daysSinceLastInteraction < 1) {
    probability += 0.1; // Muy reciente
  } else if (features.daysSinceLastInteraction < 3) {
    probability += 0.05; // Reciente
  } else if (features.daysSinceLastInteraction > 30) {
    probability -= 0.2; // Muy antiguo
  } else if (features.daysSinceLastInteraction > 14) {
    probability -= 0.1; // Antiguo
  }
  
  // Ajustar según el estado
  if (features.status === 'converted') {
    probability = 1.0; // Ya convertido
  } else if (features.status === 'lost') {
    probability = 0.1; // Perdido
  }
  
  // Limitar entre 0 y 1
  return Math.max(0, Math.min(1, probability));
}

/**
 * Predice cuándo será la próxima interacción del cliente
 * @param {Object} features - Características del cliente
 * @returns {Object} - Predicción de próxima interacción
 */
function predictNextInteraction(features) {
  // Modelo simple basado en reglas
  let daysUntilNext = 7; // Valor base
  
  // Ajustar según el número de interacciones
  if (features.interactionCount > 10) {
    daysUntilNext -= 2; // Cliente frecuente
  } else if (features.interactionCount < 3) {
    daysUntilNext += 3; // Cliente nuevo
  }
  
  // Ajustar según el tiempo desde la última interacción
  if (features.daysSinceLastInteraction < 1) {
    daysUntilNext -= 1; // Interacción muy reciente
  } else if (features.daysSinceLastInteraction > 30) {
    daysUntilNext += 5; // Hace mucho que no interactúa
  }
  
  // Ajustar según el sentimiento
  if (features.sentimentScore > 1) {
    daysUntilNext -= 1; // Sentimiento muy positivo
  } else if (features.sentimentScore < -1) {
    daysUntilNext += 2; // Sentimiento muy negativo
  }
  
  // Calcular fecha
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + Math.max(1, daysUntilNext));
  
  // Calcular probabilidad
  let probability = 0.7; // Probabilidad base
  
  // Ajustar según el estado
  if (features.status === 'lost') {
    probability = 0.2; // Cliente perdido
  } else if (features.status === 'active') {
    probability = 0.8; // Cliente activo
  }
  
  return {
    daysUntilNext: Math.max(1, daysUntilNext),
    date: nextDate.toISOString().split('T')[0],
    probability
  };
}

/**
 * Predice el valor potencial del cliente
 * @param {Object} features - Características del cliente
 * @returns {Object} - Predicción de valor del cliente
 */
function predictCustomerValue(features) {
  // Modelo simple basado en reglas
  let value = 100; // Valor base
  
  // Ajustar según el número de interacciones
  value += features.interactionCount * 10;
  
  // Ajustar según el sentimiento
  value += features.sentimentScore * 20;
  
  // Ajustar según el tiempo desde la última interacción
  if (features.daysSinceLastInteraction > 30) {
    value *= 0.7; // Reducir valor si hace mucho que no interactúa
  }
  
  // Ajustar según el estado
  if (features.status === 'converted') {
    value *= 1.5; // Cliente ya convertido
  } else if (features.status === 'lost') {
    value *= 0.3; // Cliente perdido
  }
  
  // Categorizar
  let category;
  if (value > 300) {
    category = 'alto';
  } else if (value > 150) {
    category = 'medio';
  } else {
    category = 'bajo';
  }
  
  return {
    value: Math.round(value),
    category
  };
}

/**
 * Obtiene datos históricos de ventas
 * @param {string} period - Período ('daily', 'weekly', 'monthly')
 * @returns {Promise<Array>} - Datos históricos de ventas
 */
async function getSalesHistoricalData(period) {
  try {
    // En una implementación real, estos datos vendrían de la base de datos
    // Aquí generamos datos de ejemplo
    const now = new Date();
    const data = [];
    
    let numPeriods;
    let periodFormat;
    
    switch (period) {
      case 'daily':
        numPeriods = 30; // 30 días
        periodFormat = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        break;
      case 'weekly':
        numPeriods = 12; // 12 semanas
        periodFormat = date => {
          const year = date.getFullYear();
          const weekNumber = Math.ceil((date - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
          return `${year}-W${String(weekNumber).padStart(2, '0')}`;
        };
        break;
      case 'monthly':
      default:
        numPeriods = 12; // 12 meses
        periodFormat = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
    }
    
    // Generar datos históricos
    for (let i = numPeriods - 1; i >= 0; i--) {
      const date = new Date(now);
      
      switch (period) {
        case 'daily':
          date.setDate(date.getDate() - i);
          break;
        case 'weekly':
          date.setDate(date.getDate() - (i * 7));
          break;
        case 'monthly':
        default:
          date.setMonth(date.getMonth() - i);
          break;
      }
      
      // Valor base + tendencia + estacionalidad + ruido
      const baseValue = 1000;
      const trend = i * 20; // Tendencia creciente
      const seasonality = Math.sin(i / (numPeriods / 2) * Math.PI) * 200; // Estacionalidad
      const noise = Math.random() * 100 - 50; // Ruido aleatorio
      
      const value = Math.max(0, Math.round(baseValue + trend + seasonality + noise));
      
      data.push({
        period: periodFormat(date),
        value
      });
    }
    
    return data;
  } catch (error) {
    console.error('Error al obtener datos históricos de ventas:', error);
    throw error;
  }
}

/**
 * Obtiene la etiqueta del siguiente período
 * @param {string} lastPeriod - Último período
 * @param {number} increment - Incremento
 * @param {string} periodType - Tipo de período
 * @returns {string} - Etiqueta del siguiente período
 */
function getNextPeriodLabel(lastPeriod, increment, periodType) {
  try {
    let date;
    
    switch (periodType) {
      case 'daily':
        date = new Date(lastPeriod);
        date.setDate(date.getDate() + increment);
        return date.toISOString().split('T')[0];
        
      case 'weekly':
        const [year, week] = lastPeriod.split('-W').map(Number);
        date = new Date(year, 0, 1);
        date.setDate(date.getDate() + (week + increment) * 7);
        const nextYear = date.getFullYear();
        const nextWeek = Math.ceil((date - new Date(nextYear, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
        return `${nextYear}-W${String(nextWeek).padStart(2, '0')}`;
        
      case 'monthly':
      default:
        const [yearStr, monthStr] = lastPeriod.split('-');
        date = new Date(Number(yearStr), Number(monthStr) - 1, 1);
        date.setMonth(date.getMonth() + increment);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
  } catch (error) {
    console.error('Error al obtener etiqueta del siguiente período:', error);
    return `Período+${increment}`;
  }
}

/**
 * Genera descripciones para los segmentos de clientes
 * @param {Array} segments - Segmentos de clientes
 * @param {Array} features - Características de los clientes
 * @returns {Array} - Descripciones de segmentos
 */
function generateSegmentDescriptions(segments, features) {
  const descriptions = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segmentClients = segments[i];
    
    if (segmentClients.length === 0) {
      descriptions.push({
        name: `Segmento ${i + 1}`,
        description: 'Segmento vacío'
      });
      continue;
    }
    
    // Calcular promedios de características
    const avgInteractionCount = segmentClients.reduce((sum, client) => sum + client.features.interactionCount, 0) / segmentClients.length;
    const avgSentimentScore = segmentClients.reduce((sum, client) => sum + client.features.sentimentScore, 0) / segmentClients.length;
    const avgDaysSinceLastInteraction = segmentClients.reduce((sum, client) => sum + client.features.daysSinceLastInteraction, 0) / segmentClients.length;
    
    // Generar nombre y descripción
    let name, description;
    
    if (avgInteractionCount > 8 && avgSentimentScore > 0.5) {
      name = 'Clientes Leales';
      description = 'Clientes con muchas interacciones y sentimiento positivo. Alto potencial de conversión.';
    } else if (avgInteractionCount > 8 && avgSentimentScore < 0) {
      name = 'Clientes Insatisfechos';
      description = 'Clientes con muchas interacciones pero sentimiento negativo. Requieren atención especial.';
    } else if (avgInteractionCount < 3 && avgDaysSinceLastInteraction < 7) {
      name = 'Clientes Nuevos';
      description = 'Clientes con pocas interacciones recientes. Oportunidad para captar su interés.';
    } else if (avgDaysSinceLastInteraction > 30) {
      name = 'Clientes Inactivos';
      description = 'Clientes que no han interactuado recientemente. Considerar campañas de reactivación.';
    } else {
      name = `Segmento ${i + 1}`;
      description = 'Clientes con comportamiento mixto.';
    }
    
    descriptions.push({ name, description });
  }
  
  return descriptions;
}

/**
 * Obtiene datos de entrenamiento para el modelo de recomendación
 * @returns {Promise<Object>} - Datos de entrenamiento
 */
async function getRecommendationTrainingData() {
  try {
    // En una implementación real, estos datos vendrían de la base de datos
    // Aquí generamos datos de ejemplo
    const features = [];
    const labels = [];
    
    // Generar 100 ejemplos de entrenamiento
    for (let i = 0; i < 100; i++) {
      // Características aleatorias
      const interactionCount = Math.floor(Math.random() * 20);
      const averageResponseTime = Math.random() * 60000;
      const sentimentScore = Math.random() * 2 - 1;
      const daysSinceLastInteraction = Math.floor(Math.random() * 30);
      const responseRate = Math.random();
      const productId = Math.floor(Math.random() * 5) + 1;
      
      features.push([
        interactionCount,
        averageResponseTime,
        sentimentScore,
        daysSinceLastInteraction,
        responseRate,
        productId
      ]);
      
      // Etiqueta: interesado o no
      // Más probable que esté interesado si tiene muchas interacciones y sentimiento positivo
      const interested = (interactionCount > 10 || sentimentScore > 0.5) && Math.random() > 0.3;
      labels.push(interested ? 1 : 0);
    }
    
    return { features, labels };
  } catch (error) {
    console.error('Error al obtener datos de entrenamiento para recomendaciones:', error);
    throw error;
  }
}

/**
 * Genera mensajes personalizados para un cliente
 * @param {Object} client - Datos del cliente
 * @param {Object} features - Características del cliente
 * @param {Array} recommendations - Productos recomendados
 * @returns {Array} - Mensajes personalizados
 */
function generatePersonalizedMessages(client, features, recommendations) {
  const messages = [];
  
  // Mensaje basado en el tiempo desde la última interacción
  if (features.daysSinceLastInteraction > 30) {
    messages.push({
      type: 'reactivation',
      message: `Hola ${client.name}, hace tiempo que no hablamos. ¿Cómo podemos ayudarte hoy?`
    });
  } else if (features.daysSinceLastInteraction < 1) {
    messages.push({
      type: 'followup',
      message: `Gracias por tu reciente interacción, ${client.name}. ¿Hay algo más en lo que podamos ayudarte?`
    });
  }
  
  // Mensaje basado en el sentimiento
  if (features.sentimentScore < -0.5) {
    messages.push({
      type: 'satisfaction',
      message: `Lamentamos que tu experiencia no haya sido satisfactoria. Nos gustaría saber cómo podemos mejorar.`
    });
  } else if (features.sentimentScore > 0.5) {
    messages.push({
      type: 'appreciation',
      message: `Nos alegra que estés satisfecho con nuestro servicio. ¡Gracias por tu confianza!`
    });
  }
  
  // Mensaje basado en recomendaciones
  if (recommendations.length > 0) {
    const topProduct = recommendations[0];
    messages.push({
      type: 'recommendation',
      message: `Basado en tus interacciones, creemos que te podría interesar nuestro producto "${topProduct.name}".`
    });
  }
  
  // Mensaje basado en el valor del cliente
  const customerValue = predictCustomerValue(features);
  if (customerValue.category === 'alto') {
    messages.push({
      type: 'vip',
      message: `Eres uno de nuestros clientes más valiosos. Nos encantaría ofrecerte atención personalizada.`
    });
  }
  
  return messages;
}

module.exports = {
  predictClientBehavior,
  predictSales,
  segmentClients,
  getPersonalizedRecommendations
};
