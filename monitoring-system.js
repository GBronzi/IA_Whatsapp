/**
 * monitoring-system.js
 * 
 * Sistema de monitoreo en tiempo real para el Asistente de Ventas WhatsApp.
 * Recopila métricas de rendimiento, registra eventos importantes y proporciona
 * alertas cuando se detectan problemas.
 */

const os = require('os');
const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const logger = require('./logger');
const config = require('./config');

// Clase para el sistema de monitoreo
class MonitoringSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      // Intervalo de recopilación de métricas (en ms)
      metricsInterval: options.metricsInterval || 60000, // 1 minuto
      
      // Directorio para almacenar métricas
      metricsDir: options.metricsDir || path.join(__dirname, 'data', 'metrics'),
      
      // Número máximo de archivos de métricas a mantener
      maxMetricsFiles: options.maxMetricsFiles || 1440, // 24 horas (con intervalo de 1 minuto)
      
      // Umbrales para alertas
      thresholds: options.thresholds || {
        cpu: 80, // Porcentaje de uso de CPU
        memory: 80, // Porcentaje de uso de memoria
        responseTime: 5000, // Tiempo de respuesta en ms
        errorRate: 5, // Porcentaje de errores
        queueSize: 100 // Tamaño de la cola de mensajes
      },
      
      // Habilitar alertas
      enableAlerts: options.enableAlerts !== undefined ? options.enableAlerts : true,
      
      // Habilitar registro de métricas
      enableMetricsLogging: options.enableMetricsLogging !== undefined ? options.enableMetricsLogging : true
    };
    
    // Métricas actuales
    this.metrics = {
      timestamp: Date.now(),
      system: {
        cpu: 0,
        memory: {
          total: 0,
          used: 0,
          percentage: 0
        },
        uptime: 0
      },
      application: {
        messageCount: 0,
        responseTime: {
          avg: 0,
          min: 0,
          max: 0
        },
        errorCount: 0,
        errorRate: 0,
        queueSize: 0,
        activeChats: 0
      },
      ai: {
        requestCount: 0,
        tokenCount: 0,
        processingTime: {
          avg: 0,
          min: 0,
          max: 0
        }
      }
    };
    
    // Contadores para cálculos de promedios
    this.counters = {
      responseTimes: [],
      aiProcessingTimes: [],
      messageCount: 0,
      errorCount: 0,
      aiRequestCount: 0,
      tokenCount: 0
    };
    
    // Alertas activas
    this.activeAlerts = new Map();
    
    // Intervalos
    this.metricsInterval = null;
    
    // Estado del sistema
    this.isRunning = false;
  }
  
  /**
   * Inicia el sistema de monitoreo
   */
  async start() {
    if (this.isRunning) return;
    
    try {
      logger.info('Iniciando sistema de monitoreo...');
      
      // Crear directorio de métricas si no existe
      if (this.options.enableMetricsLogging) {
        await this.ensureMetricsDirectory();
      }
      
      // Iniciar recopilación de métricas
      this.metricsInterval = setInterval(() => {
        this.collectMetrics().catch(error => {
          logger.error(`Error al recopilar métricas: ${error.message}`);
        });
      }, this.options.metricsInterval);
      
      // Recopilar métricas iniciales
      await this.collectMetrics();
      
      this.isRunning = true;
      logger.info('Sistema de monitoreo iniciado correctamente');
      
      // Emitir evento de inicio
      this.emit('started');
      
      return true;
    } catch (error) {
      logger.error(`Error al iniciar sistema de monitoreo: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Detiene el sistema de monitoreo
   */
  stop() {
    if (!this.isRunning) return;
    
    logger.info('Deteniendo sistema de monitoreo...');
    
    // Detener recopilación de métricas
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    
    this.isRunning = false;
    logger.info('Sistema de monitoreo detenido');
    
    // Emitir evento de detención
    this.emit('stopped');
    
    return true;
  }
  
  /**
   * Recopila métricas del sistema y la aplicación
   */
  async collectMetrics() {
    try {
      const now = Date.now();
      
      // Actualizar timestamp
      this.metrics.timestamp = now;
      
      // Recopilar métricas del sistema
      await this.collectSystemMetrics();
      
      // Recopilar métricas de la aplicación
      this.collectApplicationMetrics();
      
      // Verificar umbrales y generar alertas
      if (this.options.enableAlerts) {
        this.checkThresholds();
      }
      
      // Guardar métricas
      if (this.options.enableMetricsLogging) {
        await this.saveMetrics();
      }
      
      // Emitir evento con métricas actualizadas
      this.emit('metrics', { ...this.metrics });
      
      // Reiniciar contadores para el próximo intervalo
      this.resetCounters();
      
      return { ...this.metrics };
    } catch (error) {
      logger.error(`Error al recopilar métricas: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Recopila métricas del sistema operativo
   */
  async collectSystemMetrics() {
    // CPU
    const cpuUsage = await this.getCpuUsage();
    this.metrics.system.cpu = cpuUsage;
    
    // Memoria
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercentage = (usedMem / totalMem) * 100;
    
    this.metrics.system.memory = {
      total: totalMem,
      used: usedMem,
      percentage: memPercentage
    };
    
    // Tiempo de actividad
    this.metrics.system.uptime = os.uptime();
  }
  
  /**
   * Recopila métricas de la aplicación
   */
  collectApplicationMetrics() {
    // Mensajes
    this.metrics.application.messageCount = this.counters.messageCount;
    
    // Tiempo de respuesta
    const responseTimes = this.counters.responseTimes;
    if (responseTimes.length > 0) {
      this.metrics.application.responseTime = {
        avg: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes)
      };
    }
    
    // Errores
    this.metrics.application.errorCount = this.counters.errorCount;
    this.metrics.application.errorRate = this.counters.messageCount > 0
      ? (this.counters.errorCount / this.counters.messageCount) * 100
      : 0;
    
    // IA
    this.metrics.ai.requestCount = this.counters.aiRequestCount;
    this.metrics.ai.tokenCount = this.counters.tokenCount;
    
    const aiProcessingTimes = this.counters.aiProcessingTimes;
    if (aiProcessingTimes.length > 0) {
      this.metrics.ai.processingTime = {
        avg: aiProcessingTimes.reduce((sum, time) => sum + time, 0) / aiProcessingTimes.length,
        min: Math.min(...aiProcessingTimes),
        max: Math.max(...aiProcessingTimes)
      };
    }
  }
  
  /**
   * Obtiene el uso de CPU
   * @returns {Promise<number>} - Porcentaje de uso de CPU
   */
  async getCpuUsage() {
    return new Promise((resolve) => {
      const startMeasure = this.getCpuInfo();
      
      // Esperar un segundo para obtener una medición precisa
      setTimeout(() => {
        const endMeasure = this.getCpuInfo();
        const idleDifference = endMeasure.idle - startMeasure.idle;
        const totalDifference = endMeasure.total - startMeasure.total;
        
        const cpuUsage = 100 - (100 * idleDifference / totalDifference);
        resolve(cpuUsage);
      }, 1000);
    });
  }
  
  /**
   * Obtiene información de CPU
   * @returns {Object} - Información de CPU
   */
  getCpuInfo() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += cpu.times[type];
      }
      idle += cpu.times.idle;
    }
    
    return { idle, total };
  }
  
  /**
   * Verifica los umbrales y genera alertas
   */
  checkThresholds() {
    const { thresholds } = this.options;
    
    // Verificar CPU
    this.checkThreshold(
      'cpu',
      this.metrics.system.cpu,
      thresholds.cpu,
      `Uso de CPU alto: ${this.metrics.system.cpu.toFixed(1)}%`
    );
    
    // Verificar memoria
    this.checkThreshold(
      'memory',
      this.metrics.system.memory.percentage,
      thresholds.memory,
      `Uso de memoria alto: ${this.metrics.system.memory.percentage.toFixed(1)}%`
    );
    
    // Verificar tiempo de respuesta
    if (this.metrics.application.responseTime.avg > 0) {
      this.checkThreshold(
        'responseTime',
        this.metrics.application.responseTime.avg,
        thresholds.responseTime,
        `Tiempo de respuesta alto: ${this.metrics.application.responseTime.avg.toFixed(0)}ms`
      );
    }
    
    // Verificar tasa de errores
    this.checkThreshold(
      'errorRate',
      this.metrics.application.errorRate,
      thresholds.errorRate,
      `Tasa de errores alta: ${this.metrics.application.errorRate.toFixed(1)}%`
    );
    
    // Verificar tamaño de cola
    this.checkThreshold(
      'queueSize',
      this.metrics.application.queueSize,
      thresholds.queueSize,
      `Cola de mensajes grande: ${this.metrics.application.queueSize} mensajes`
    );
  }
  
  /**
   * Verifica un umbral específico y genera una alerta si es necesario
   * @param {string} metricName - Nombre de la métrica
   * @param {number} value - Valor actual
   * @param {number} threshold - Umbral
   * @param {string} message - Mensaje de alerta
   */
  checkThreshold(metricName, value, threshold, message) {
    const alertId = `threshold_${metricName}`;
    
    if (value >= threshold) {
      // Si la alerta no está activa, crearla
      if (!this.activeAlerts.has(alertId)) {
        const alert = {
          id: alertId,
          type: 'threshold',
          metric: metricName,
          value,
          threshold,
          message,
          timestamp: Date.now(),
          resolved: false
        };
        
        this.activeAlerts.set(alertId, alert);
        
        // Emitir evento de alerta
        this.emit('alert', alert);
        
        // Registrar alerta
        logger.warn(`Alerta: ${message}`);
      }
    } else if (this.activeAlerts.has(alertId)) {
      // Si la alerta está activa y el valor está por debajo del umbral, resolverla
      const alert = this.activeAlerts.get(alertId);
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      
      // Emitir evento de resolución
      this.emit('alertResolved', alert);
      
      // Eliminar de alertas activas
      this.activeAlerts.delete(alertId);
      
      // Registrar resolución
      logger.info(`Alerta resuelta: ${metricName} ha vuelto a niveles normales`);
    }
  }
  
  /**
   * Registra un mensaje procesado
   * @param {Object} data - Datos del mensaje
   */
  trackMessage(data = {}) {
    this.counters.messageCount++;
    
    // Actualizar tamaño de cola si se proporciona
    if (data.queueSize !== undefined) {
      this.metrics.application.queueSize = data.queueSize;
    }
    
    // Actualizar número de chats activos si se proporciona
    if (data.activeChats !== undefined) {
      this.metrics.application.activeChats = data.activeChats;
    }
    
    // Registrar tiempo de respuesta si se proporciona
    if (data.responseTime) {
      this.counters.responseTimes.push(data.responseTime);
    }
  }
  
  /**
   * Registra un error
   * @param {Object} data - Datos del error
   */
  trackError(data = {}) {
    this.counters.errorCount++;
    
    // Emitir evento de error
    this.emit('error', {
      timestamp: Date.now(),
      ...data
    });
  }
  
  /**
   * Registra una solicitud a la IA
   * @param {Object} data - Datos de la solicitud
   */
  trackAiRequest(data = {}) {
    this.counters.aiRequestCount++;
    
    // Registrar tokens si se proporcionan
    if (data.tokenCount) {
      this.counters.tokenCount += data.tokenCount;
    }
    
    // Registrar tiempo de procesamiento si se proporciona
    if (data.processingTime) {
      this.counters.aiProcessingTimes.push(data.processingTime);
    }
  }
  
  /**
   * Reinicia los contadores para el próximo intervalo
   */
  resetCounters() {
    this.counters = {
      responseTimes: [],
      aiProcessingTimes: [],
      messageCount: 0,
      errorCount: 0,
      aiRequestCount: 0,
      tokenCount: 0
    };
  }
  
  /**
   * Asegura que el directorio de métricas exista
   */
  async ensureMetricsDirectory() {
    try {
      await fs.mkdir(this.options.metricsDir, { recursive: true });
    } catch (error) {
      logger.error(`Error al crear directorio de métricas: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Guarda las métricas actuales en un archivo
   */
  async saveMetrics() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(this.options.metricsDir, `metrics-${timestamp}.json`);
      
      await fs.writeFile(filePath, JSON.stringify(this.metrics, null, 2), 'utf8');
      
      // Eliminar archivos antiguos si se supera el límite
      await this.cleanupOldMetricsFiles();
    } catch (error) {
      logger.error(`Error al guardar métricas: ${error.message}`);
    }
  }
  
  /**
   * Elimina archivos de métricas antiguos
   */
  async cleanupOldMetricsFiles() {
    try {
      const files = await fs.readdir(this.options.metricsDir);
      
      // Filtrar solo archivos de métricas
      const metricsFiles = files.filter(file => file.startsWith('metrics-') && file.endsWith('.json'));
      
      // Si hay más archivos que el límite, eliminar los más antiguos
      if (metricsFiles.length > this.options.maxMetricsFiles) {
        // Ordenar por nombre (que incluye timestamp)
        metricsFiles.sort();
        
        // Calcular cuántos archivos eliminar
        const filesToDelete = metricsFiles.slice(0, metricsFiles.length - this.options.maxMetricsFiles);
        
        // Eliminar archivos
        for (const file of filesToDelete) {
          await fs.unlink(path.join(this.options.metricsDir, file));
        }
      }
    } catch (error) {
      logger.error(`Error al limpiar archivos de métricas antiguos: ${error.message}`);
    }
  }
  
  /**
   * Obtiene las métricas actuales
   * @returns {Object} - Métricas actuales
   */
  getMetrics() {
    return { ...this.metrics };
  }
  
  /**
   * Obtiene las alertas activas
   * @returns {Array} - Alertas activas
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values());
  }
  
  /**
   * Obtiene el historial de métricas
   * @param {Object} options - Opciones de consulta
   * @returns {Promise<Array>} - Historial de métricas
   */
  async getMetricsHistory(options = {}) {
    try {
      const {
        limit = 60, // Últimas 60 métricas por defecto
        startTime = 0,
        endTime = Date.now()
      } = options;
      
      // Leer directorio de métricas
      const files = await fs.readdir(this.options.metricsDir);
      
      // Filtrar solo archivos de métricas
      const metricsFiles = files.filter(file => file.startsWith('metrics-') && file.endsWith('.json'));
      
      // Ordenar por nombre (que incluye timestamp) de más reciente a más antiguo
      metricsFiles.sort().reverse();
      
      // Limitar número de archivos
      const limitedFiles = metricsFiles.slice(0, limit);
      
      // Leer archivos y parsear métricas
      const metricsHistory = [];
      
      for (const file of limitedFiles) {
        try {
          const filePath = path.join(this.options.metricsDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const metrics = JSON.parse(data);
          
          // Filtrar por rango de tiempo
          if (metrics.timestamp >= startTime && metrics.timestamp <= endTime) {
            metricsHistory.push(metrics);
          }
        } catch (error) {
          logger.error(`Error al leer archivo de métricas ${file}: ${error.message}`);
        }
      }
      
      return metricsHistory;
    } catch (error) {
      logger.error(`Error al obtener historial de métricas: ${error.message}`);
      return [];
    }
  }
}

// Exportar una instancia única
module.exports = new MonitoringSystem({
  metricsInterval: config.MONITORING_METRICS_INTERVAL || 60000,
  metricsDir: path.join(__dirname, config.MONITORING_METRICS_DIR || 'data/metrics'),
  maxMetricsFiles: config.MONITORING_MAX_METRICS_FILES || 1440,
  thresholds: {
    cpu: config.MONITORING_THRESHOLD_CPU || 80,
    memory: config.MONITORING_THRESHOLD_MEMORY || 80,
    responseTime: config.MONITORING_THRESHOLD_RESPONSE_TIME || 5000,
    errorRate: config.MONITORING_THRESHOLD_ERROR_RATE || 5,
    queueSize: config.MONITORING_THRESHOLD_QUEUE_SIZE || 100
  },
  enableAlerts: config.MONITORING_ENABLE_ALERTS !== 'false',
  enableMetricsLogging: config.MONITORING_ENABLE_METRICS_LOGGING !== 'false'
});
