/**
 * Pruebas para el análisis predictivo
 */

const predictiveAnalytics = require('../admin-panel/controllers/predictive-analytics');
const { LinearRegression, KMeans, NaiveBayes } = require('../admin-panel/models/ml-models');

describe('Análisis predictivo', () => {
  test('Debe predecir comportamiento de clientes', async () => {
    const predictions = await predictiveAnalytics.predictClientBehavior();
    
    expect(Array.isArray(predictions)).toBe(true);
    
    if (predictions.length > 0) {
      const prediction = predictions[0];
      
      expect(prediction).toHaveProperty('client');
      expect(prediction).toHaveProperty('predictions');
      expect(prediction.predictions).toHaveProperty('conversionProbability');
      expect(prediction.predictions).toHaveProperty('nextInteraction');
      expect(prediction.predictions).toHaveProperty('customerValue');
      
      expect(typeof prediction.predictions.conversionProbability).toBe('number');
      expect(prediction.predictions.conversionProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.predictions.conversionProbability).toBeLessThanOrEqual(1);
    }
  });
  
  test('Debe predecir ventas futuras', async () => {
    const forecast = await predictiveAnalytics.predictSales('monthly');
    
    expect(forecast).toHaveProperty('historical');
    expect(forecast).toHaveProperty('predictions');
    expect(forecast).toHaveProperty('period');
    
    expect(Array.isArray(forecast.historical)).toBe(true);
    expect(Array.isArray(forecast.predictions)).toBe(true);
    expect(forecast.period).toBe('monthly');
    
    if (forecast.predictions.length > 0) {
      const prediction = forecast.predictions[0];
      
      expect(prediction).toHaveProperty('period');
      expect(prediction).toHaveProperty('value');
      expect(typeof prediction.value).toBe('number');
    }
  });
  
  test('Debe segmentar clientes', async () => {
    const segments = await predictiveAnalytics.segmentClients();
    
    expect(segments).toHaveProperty('segments');
    expect(segments).toHaveProperty('totalClients');
    
    expect(Array.isArray(segments.segments)).toBe(true);
    expect(typeof segments.totalClients).toBe('number');
    
    if (segments.segments.length > 0) {
      const segment = segments.segments[0];
      
      expect(segment).toHaveProperty('id');
      expect(segment).toHaveProperty('name');
      expect(segment).toHaveProperty('description');
      expect(segment).toHaveProperty('clients');
      expect(segment).toHaveProperty('count');
      
      expect(Array.isArray(segment.clients)).toBe(true);
      expect(typeof segment.count).toBe('number');
    }
  });
  
  test('Debe obtener recomendaciones personalizadas', async () => {
    // Usar un número de teléfono de prueba
    const phone = '1234567890';
    
    try {
      const recommendations = await predictiveAnalytics.getPersonalizedRecommendations(phone);
      
      expect(recommendations).toHaveProperty('client');
      expect(recommendations).toHaveProperty('recommendations');
      expect(recommendations).toHaveProperty('messages');
      
      expect(Array.isArray(recommendations.recommendations)).toBe(true);
      expect(Array.isArray(recommendations.messages)).toBe(true);
    } catch (error) {
      // Si el cliente no existe, la prueba pasa
      expect(error.message).toContain('Cliente no encontrado');
    }
  });
});

describe('Modelos de aprendizaje automático', () => {
  test('Modelo de regresión lineal', () => {
    const model = new LinearRegression();
    
    // Datos de ejemplo
    const X = [[1], [2], [3], [4], [5]];
    const y = [2, 4, 6, 8, 10];
    
    // Entrenar modelo
    model.fit(X, y);
    
    // Predecir
    const prediction = model.predict([[6]]);
    
    // La predicción debería ser cercana a 12
    expect(prediction).toBeGreaterThan(10);
    expect(prediction).toBeLessThan(14);
  });
  
  test('Modelo de clustering K-Means', () => {
    const model = new KMeans(2);
    
    // Datos de ejemplo (dos grupos claros)
    const X = [
      [1, 1], [1, 2], [2, 1], [2, 2], // Grupo 1
      [10, 10], [10, 11], [11, 10], [11, 11] // Grupo 2
    ];
    
    // Entrenar modelo
    const clusters = model.fit(X);
    
    // Verificar que hay dos clusters
    expect(new Set(clusters).size).toBe(2);
    
    // Verificar que los puntos cercanos están en el mismo cluster
    expect(clusters[0]).toBe(clusters[1]);
    expect(clusters[0]).toBe(clusters[2]);
    expect(clusters[0]).toBe(clusters[3]);
    
    expect(clusters[4]).toBe(clusters[5]);
    expect(clusters[4]).toBe(clusters[6]);
    expect(clusters[4]).toBe(clusters[7]);
    
    // Verificar que los puntos de diferentes grupos están en diferentes clusters
    expect(clusters[0]).not.toBe(clusters[4]);
  });
  
  test('Modelo de Naive Bayes', () => {
    const model = new NaiveBayes();
    
    // Datos de ejemplo
    const X = [
      [1, 1], [1, 2], [2, 1], [2, 2], // Clase 0
      [5, 5], [5, 6], [6, 5], [6, 6]  // Clase 1
    ];
    const y = [0, 0, 0, 0, 1, 1, 1, 1];
    
    // Entrenar modelo
    model.fit(X, y);
    
    // Predecir
    const prediction1 = model.predict([1.5, 1.5]);
    const prediction2 = model.predict([5.5, 5.5]);
    
    // Verificar predicciones
    expect(prediction1).toBe(0);
    expect(prediction2).toBe(1);
    
    // Verificar probabilidades
    const probability1 = model.predictProbability([1.5, 1.5], 0);
    const probability2 = model.predictProbability([5.5, 5.5], 1);
    
    expect(probability1).toBeGreaterThan(0.5);
    expect(probability2).toBeGreaterThan(0.5);
  });
});
