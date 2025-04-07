/**
 * routes/api.js - Rutas de la API para el panel de administración
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const database = require('../../database');
const crmManager = require('../../crm-manager');
const monitoringSystem = require('../../monitoring-system');
const backupManager = require('../../backup-manager');
const authManager = require('../../auth-manager');

// Middleware para verificar autenticación en API
function apiAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ success: false, message: 'No autorizado' });
}

// Middleware para verificar rol de administrador en API
function apiAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ success: false, message: 'Acceso denegado' });
}

// Ruta de estado del sistema
router.get('/status', apiAuth, async (req, res) => {
  try {
    // Obtener métricas del sistema
    const metrics = monitoringSystem.getMetrics();
    
    // Obtener estado del CRM
    const crmStatus = await crmManager.getCrmStatus();
    
    // Obtener estado de la base de datos
    const dbStatus = database.isInitialized() ? 'connected' : 'disconnected';
    
    // Obtener alertas activas
    const activeAlerts = monitoringSystem.getActiveAlerts();
    
    res.json({
      success: true,
      data: {
        system: {
          cpu: metrics.system.cpu,
          memory: metrics.system.memory,
          uptime: metrics.system.uptime
        },
        application: {
          messageCount: metrics.application.messageCount,
          errorCount: metrics.application.errorCount,
          queueSize: metrics.application.queueSize,
          activeChats: metrics.application.activeChats
        },
        services: {
          database: dbStatus,
          crm: crmStatus.connected ? 'connected' : 'disconnected',
          monitoring: monitoringSystem.isRunning ? 'running' : 'stopped'
        },
        alerts: activeAlerts
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado del sistema',
      error: error.message
    });
  }
});

// Rutas para clientes
router.get('/clients', apiAuth, async (req, res) => {
  try {
    // Obtener parámetros de consulta
    const { page = 1, limit = 20, search = '', status = '' } = req.query;
    
    // Construir criterios de búsqueda
    const criteria = {};
    
    if (search) {
      criteria.search = search;
    }
    
    if (status) {
      criteria.status = status;
    }
    
    // Obtener clientes
    const clients = await crmManager.searchClients(criteria);
    
    // Paginar resultados
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedClients = clients.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      data: {
        clients: paginatedClients,
        pagination: {
          total: clients.length,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(clients.length / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener clientes',
      error: error.message
    });
  }
});

router.get('/clients/:phone', apiAuth, async (req, res) => {
  try {
    const { phone } = req.params;
    
    // Obtener cliente
    const client = await crmManager.getClient(phone);
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }
    
    // Obtener interacciones
    const interactions = await crmManager.getInteractions(phone);
    
    res.json({
      success: true,
      data: {
        client,
        interactions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener cliente',
      error: error.message
    });
  }
});

router.put('/clients/:phone', apiAuth, async (req, res) => {
  try {
    const { phone } = req.params;
    const clientData = req.body;
    
    // Actualizar cliente
    const result = await crmManager.updateClient(phone, clientData);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar cliente',
      error: error.message
    });
  }
});

// Rutas para estadísticas
router.get('/statistics', apiAuth, async (req, res) => {
  try {
    // Obtener estadísticas de clientes
    const clientStats = await crmManager.getClientStats();
    
    // Obtener historial de métricas
    const { timeRange = '24h' } = req.query;
    
    let startTime;
    const now = Date.now();
    
    switch (timeRange) {
      case '1h':
        startTime = now - 60 * 60 * 1000;
        break;
      case '6h':
        startTime = now - 6 * 60 * 60 * 1000;
        break;
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        startTime = now - 24 * 60 * 60 * 1000;
    }
    
    const metricsHistory = await monitoringSystem.getMetricsHistory({
      startTime,
      endTime: now
    });
    
    res.json({
      success: true,
      data: {
        clients: clientStats,
        metrics: metricsHistory
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas',
      error: error.message
    });
  }
});

// Rutas para respaldos
router.get('/backups', apiAdmin, async (req, res) => {
  try {
    // Obtener lista de respaldos
    const backups = await backupManager.getBackups();
    
    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener respaldos',
      error: error.message
    });
  }
});

router.post('/backups', apiAdmin, async (req, res) => {
  try {
    const { label } = req.body;
    
    // Crear respaldo
    const backup = await backupManager.createBackup(label);
    
    res.json({
      success: true,
      data: backup
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear respaldo',
      error: error.message
    });
  }
});

router.post('/backups/:id/restore', apiAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Restaurar respaldo
    const result = await backupManager.restoreBackup(id);
    
    res.json({
      success: true,
      data: { restored: result }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al restaurar respaldo',
      error: error.message
    });
  }
});

router.delete('/backups/:id', apiAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Eliminar respaldo
    const result = await backupManager.deleteBackup(id);
    
    res.json({
      success: true,
      data: { deleted: result }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar respaldo',
      error: error.message
    });
  }
});

// Rutas para usuarios
router.get('/users', apiAdmin, (req, res) => {
  try {
    // Obtener usuarios
    const users = authManager.getAllUsers();
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      error: error.message
    });
  }
});

router.post('/users', apiAdmin, async (req, res) => {
  try {
    const userData = req.body;
    
    // Crear usuario
    const user = await authManager.createUser(userData);
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      error: error.message
    });
  }
});

router.put('/users/:username', apiAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    const userData = req.body;
    
    // Actualizar usuario
    const user = await authManager.updateUser(username, userData);
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      error: error.message
    });
  }
});

router.delete('/users/:username', apiAdmin, async (req, res) => {
  try {
    const { username } = req.params;
    
    // No permitir eliminar al propio usuario
    if (username === req.user.username) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propio usuario'
      });
    }
    
    // Eliminar usuario
    const result = await authManager.deleteUser(username);
    
    res.json({
      success: true,
      data: { deleted: result }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario',
      error: error.message
    });
  }
});

// Rutas para configuración
router.get('/settings/crm', apiAdmin, (req, res) => {
  try {
    // Obtener configuración del CRM
    const crmConfig = crmManager.getConfig();
    
    res.json({
      success: true,
      data: crmConfig
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración del CRM',
      error: error.message
    });
  }
});

router.put('/settings/crm', apiAdmin, async (req, res) => {
  try {
    const crmConfig = req.body;
    
    // Actualizar configuración del CRM
    const result = await crmManager.updateConfig(crmConfig);
    
    res.json({
      success: true,
      data: { updated: result }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al actualizar configuración del CRM',
      error: error.message
    });
  }
});

module.exports = router;
