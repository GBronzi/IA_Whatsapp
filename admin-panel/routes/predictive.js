/**
 * routes/predictive.js - Rutas para el análisis predictivo
 */

const express = require('express');
const router = express.Router();
const predictiveAnalytics = require('../controllers/predictive-analytics');

// Ruta principal de análisis predictivo
router.get('/', (req, res) => {
  res.render('predictive/index', {
    title: 'Análisis Predictivo',
    user: req.user
  });
});

// Obtener predicciones de comportamiento de clientes
router.get('/client-behavior', async (req, res) => {
  try {
    const predictions = await predictiveAnalytics.predictClientBehavior();
    
    res.render('predictive/client-behavior', {
      title: 'Predicción de Comportamiento de Clientes',
      user: req.user,
      predictions
    });
  } catch (error) {
    res.status(500).render('error', {
      message: 'Error al obtener predicciones de comportamiento',
      error: { status: 500, stack: process.env.NODE_ENV === 'production' ? '' : error.stack }
    });
  }
});

// Obtener predicciones de ventas
router.get('/sales-forecast', async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    const forecast = await predictiveAnalytics.predictSales(period);
    
    res.render('predictive/sales-forecast', {
      title: 'Pronóstico de Ventas',
      user: req.user,
      forecast,
      period
    });
  } catch (error) {
    res.status(500).render('error', {
      message: 'Error al obtener pronóstico de ventas',
      error: { status: 500, stack: process.env.NODE_ENV === 'production' ? '' : error.stack }
    });
  }
});

// Obtener segmentación de clientes
router.get('/client-segmentation', async (req, res) => {
  try {
    const segments = await predictiveAnalytics.segmentClients();
    
    res.render('predictive/client-segmentation', {
      title: 'Segmentación de Clientes',
      user: req.user,
      segments
    });
  } catch (error) {
    res.status(500).render('error', {
      message: 'Error al obtener segmentación de clientes',
      error: { status: 500, stack: process.env.NODE_ENV === 'production' ? '' : error.stack }
    });
  }
});

// Obtener recomendaciones personalizadas para un cliente
router.get('/recommendations/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const recommendations = await predictiveAnalytics.getPersonalizedRecommendations(phone);
    
    res.render('predictive/recommendations', {
      title: 'Recomendaciones Personalizadas',
      user: req.user,
      phone,
      recommendations
    });
  } catch (error) {
    res.status(500).render('error', {
      message: 'Error al obtener recomendaciones personalizadas',
      error: { status: 500, stack: process.env.NODE_ENV === 'production' ? '' : error.stack }
    });
  }
});

// API para obtener predicciones de comportamiento de clientes
router.get('/api/client-behavior', async (req, res) => {
  try {
    const predictions = await predictiveAnalytics.predictClientBehavior();
    
    res.json({
      success: true,
      data: predictions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener predicciones de comportamiento',
      error: error.message
    });
  }
});

// API para obtener predicciones de ventas
router.get('/api/sales-forecast', async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;
    const forecast = await predictiveAnalytics.predictSales(period);
    
    res.json({
      success: true,
      data: forecast
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener pronóstico de ventas',
      error: error.message
    });
  }
});

// API para obtener segmentación de clientes
router.get('/api/client-segmentation', async (req, res) => {
  try {
    const segments = await predictiveAnalytics.segmentClients();
    
    res.json({
      success: true,
      data: segments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener segmentación de clientes',
      error: error.message
    });
  }
});

// API para obtener recomendaciones personalizadas para un cliente
router.get('/api/recommendations/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const recommendations = await predictiveAnalytics.getPersonalizedRecommendations(phone);
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener recomendaciones personalizadas',
      error: error.message
    });
  }
});

module.exports = router;
