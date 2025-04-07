/**
 * Pruebas para el sistema de monitoreo
 */

const monitoringSystem = require('../monitoring-system');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Directorio temporal para pruebas
const TEST_DIR = path.join(os.tmpdir(), 'monitoring-test-' + Date.now());

describe('Sistema de monitoreo', () => {
  beforeAll(async () => {
    // Crear directorio temporal
    await fs.mkdir(TEST_DIR, { recursive: true });
    
    // Configurar sistema de monitoreo para pruebas
    monitoringSystem.options.metricsDir = TEST_DIR;
    monitoringSystem.options.metricsInterval = 1000; // 1 segundo para pruebas
    monitoringSystem.options.maxMetricsFiles = 5;
    monitoringSystem.options.enableAlerts = true;
    monitoringSystem.options.enableMetricsLogging = true;
    
    // Iniciar sistema de monitoreo
    await monitoringSystem.start();
  });
  
  afterAll(async () => {
    // Detener sistema de monitoreo
    monitoringSystem.stop();
    
    // Eliminar directorio temporal
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Error al eliminar directorio temporal: ${error.message}`);
    }
  });
  
  test('Debe inicializarse correctamente', () => {
    expect(monitoringSystem.isRunning).toBe(true);
  });
  
  test('Debe recopilar métricas del sistema', async () => {
    // Recopilar métricas
    const metrics = await monitoringSystem.collectMetrics();
    
    // Verificar métricas del sistema
    expect(metrics.system).toBeDefined();
    expect(metrics.system.cpu).toBeDefined();
    expect(metrics.system.memory).toBeDefined();
    expect(metrics.system.memory.total).toBeGreaterThan(0);
    expect(metrics.system.memory.used).toBeGreaterThan(0);
    expect(metrics.system.memory.percentage).toBeGreaterThan(0);
    expect(metrics.system.uptime).toBeGreaterThan(0);
  });
  
  test('Debe registrar mensajes y errores', () => {
    // Registrar mensaje
    monitoringSystem.trackMessage({
      responseTime: 150,
      queueSize: 5,
      activeChats: 10
    });
    
    // Registrar error
    monitoringSystem.trackError({
      message: 'Error de prueba',
      code: 'TEST_ERROR',
      stack: 'Error: Error de prueba\n    at Test.test'
    });
    
    // Verificar contadores
    expect(monitoringSystem.counters.messageCount).toBe(1);
    expect(monitoringSystem.counters.errorCount).toBe(1);
    expect(monitoringSystem.counters.responseTimes).toContain(150);
    
    // Verificar métricas de aplicación
    expect(monitoringSystem.metrics.application.queueSize).toBe(5);
    expect(monitoringSystem.metrics.application.activeChats).toBe(10);
  });
  
  test('Debe registrar solicitudes a la IA', () => {
    // Registrar solicitud a la IA
    monitoringSystem.trackAiRequest({
      tokenCount: 250,
      processingTime: 300
    });
    
    // Verificar contadores
    expect(monitoringSystem.counters.aiRequestCount).toBe(1);
    expect(monitoringSystem.counters.tokenCount).toBe(250);
    expect(monitoringSystem.counters.aiProcessingTimes).toContain(300);
  });
  
  test('Debe generar alertas cuando se superan umbrales', () => {
    // Configurar umbrales bajos para pruebas
    const originalThresholds = { ...monitoringSystem.options.thresholds };
    monitoringSystem.options.thresholds = {
      cpu: 1, // 1% (se superará fácilmente)
      memory: 1, // 1% (se superará fácilmente)
      responseTime: 100, // 100ms (se superará con 150ms)
      errorRate: 1, // 1% (se superará con 1 error en 1 mensaje)
      queueSize: 1 // 1 mensaje (se superará con 5 mensajes)
    };
    
    // Espiar evento de alerta
    const alertSpy = jest.fn();
    monitoringSystem.on('alert', alertSpy);
    
    // Verificar umbrales
    monitoringSystem.checkThresholds();
    
    // Restaurar umbrales originales
    monitoringSystem.options.thresholds = originalThresholds;
    
    // Verificar que se generaron alertas
    expect(alertSpy).toHaveBeenCalled();
    expect(monitoringSystem.activeAlerts.size).toBeGreaterThan(0);
  });
  
  test('Debe guardar métricas en archivos', async () => {
    // Guardar métricas
    await monitoringSystem.saveMetrics();
    
    // Verificar que se creó el archivo
    const files = await fs.readdir(TEST_DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/^metrics-.*\.json$/);
    
    // Verificar contenido del archivo
    const filePath = path.join(TEST_DIR, files[0]);
    const fileContent = await fs.readFile(filePath, 'utf8');
    const metrics = JSON.parse(fileContent);
    
    expect(metrics.timestamp).toBeDefined();
    expect(metrics.system).toBeDefined();
    expect(metrics.application).toBeDefined();
    expect(metrics.ai).toBeDefined();
  });
  
  test('Debe limpiar archivos antiguos', async () => {
    // Crear varios archivos de métricas
    for (let i = 0; i < 10; i++) {
      const timestamp = new Date(Date.now() - i * 60000).toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(TEST_DIR, `metrics-${timestamp}.json`);
      await fs.writeFile(filePath, JSON.stringify(monitoringSystem.metrics));
    }
    
    // Limpiar archivos antiguos
    await monitoringSystem.cleanupOldMetricsFiles();
    
    // Verificar que solo quedan los archivos más recientes
    const files = await fs.readdir(TEST_DIR);
    const metricsFiles = files.filter(file => file.startsWith('metrics-') && file.endsWith('.json'));
    
    expect(metricsFiles.length).toBeLessThanOrEqual(monitoringSystem.options.maxMetricsFiles);
  });
  
  test('Debe obtener historial de métricas', async () => {
    // Obtener historial de métricas
    const history = await monitoringSystem.getMetricsHistory({
      limit: 5,
      startTime: Date.now() - 3600000, // Última hora
      endTime: Date.now()
    });
    
    // Verificar historial
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeLessThanOrEqual(5);
    
    if (history.length > 0) {
      expect(history[0].timestamp).toBeDefined();
      expect(history[0].system).toBeDefined();
      expect(history[0].application).toBeDefined();
      expect(history[0].ai).toBeDefined();
    }
  });
});
