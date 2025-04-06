/**
 * Pruebas de rendimiento para el Asistente de Ventas WhatsApp
 * 
 * Este script mide los tiempos de respuesta de las operaciones principales
 * y genera un informe de rendimiento.
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const os = require('os');
const si = require('systeminformation');

// Importar módulos a probar
let licenseClient;
try {
  licenseClient = require('../../license-client');
} catch (error) {
  console.error(`Error al cargar cliente de licencias: ${error.message}`);
}

// Configuración de prueba
const TEST_LICENSE_KEY = 'eyJhcHBOYW1lIjoiQXNpc3RlbnRlVmVudGFzV2hhdHNBcHAiLCJ1c2VyTmFtZSI6IlRlc3RVc2VyIiwic2VjcmV0S2V5IjoiMTIzNDU2Nzg5MCIsInRpbWVzdGFtcCI6MTY4MDAwMDAwMDAwMCwiZXhwaXJ5RGF0ZSI6IjIwMjQtMTItMzFUMjM6NTk6NTkuOTk5WiJ9.abcd1234';
const TEST_ITERATIONS = 100;
const REPORT_FILE = path.join(__dirname, 'performance-report.json');

// Resultados de las pruebas
const results = {
  system: {},
  tests: {},
  summary: {}
};

/**
 * Mide el tiempo de ejecución de una función
 * @param {Function} fn - Función a medir
 * @param {Array} args - Argumentos para la función
 * @param {number} iterations - Número de iteraciones
 * @returns {Object} - Resultados de la medición
 */
async function measureExecutionTime(fn, args = [], iterations = 1) {
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn(...args);
    const end = performance.now();
    times.push(end - start);
  }
  
  // Calcular estadísticas
  const total = times.reduce((sum, time) => sum + time, 0);
  const average = total / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  // Calcular desviación estándar
  const variance = times.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);
  
  return {
    times,
    total,
    average,
    min,
    max,
    stdDev
  };
}

/**
 * Recopila información del sistema
 * @returns {Promise<Object>} - Información del sistema
 */
async function collectSystemInfo() {
  try {
    const [cpu, mem, disk, osInfo] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.fsSize(),
      si.osInfo()
    ]);
    
    return {
      os: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        version: osInfo.distro
      },
      cpu: {
        model: cpu.manufacturer + ' ' + cpu.brand,
        cores: cpu.cores,
        speed: cpu.speed
      },
      memory: {
        total: Math.round(mem.total / (1024 * 1024 * 1024) * 100) / 100 + ' GB',
        free: Math.round(mem.free / (1024 * 1024 * 1024) * 100) / 100 + ' GB',
        used: Math.round(mem.used / (1024 * 1024 * 1024) * 100) / 100 + ' GB'
      },
      disk: {
        total: Math.round(disk[0].size / (1024 * 1024 * 1024) * 100) / 100 + ' GB',
        free: Math.round(disk[0].available / (1024 * 1024 * 1024) * 100) / 100 + ' GB',
        used: Math.round((disk[0].size - disk[0].available) / (1024 * 1024 * 1024) * 100) / 100 + ' GB'
      }
    };
  } catch (error) {
    console.error(`Error al recopilar información del sistema: ${error.message}`);
    return {
      os: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch()
      },
      error: error.message
    };
  }
}

/**
 * Ejecuta las pruebas de rendimiento
 */
async function runPerformanceTests() {
  console.log('Iniciando pruebas de rendimiento...');
  
  // Recopilar información del sistema
  console.log('Recopilando información del sistema...');
  results.system = await collectSystemInfo();
  console.log('Información del sistema recopilada.');
  
  // Inicializar cliente de licencias
  if (licenseClient) {
    console.log('Inicializando cliente de licencias...');
    licenseClient.initialize({
      serverUrl: 'http://localhost:3000',
      timeout: 5000,
      retryCount: 3,
      retryDelay: 1000,
      offlineMode: true,
      cacheExpiry: 86400000
    });
    
    // Prueba: Verificación de licencia
    console.log(`Ejecutando prueba de verificación de licencia (${TEST_ITERATIONS} iteraciones)...`);
    results.tests.verifyLicense = await measureExecutionTime(
      licenseClient.verifyLicense.bind(licenseClient),
      [TEST_LICENSE_KEY],
      TEST_ITERATIONS
    );
    console.log('Prueba de verificación de licencia completada.');
    
    // Prueba: Generación de ID de dispositivo
    console.log(`Ejecutando prueba de generación de ID de dispositivo (${TEST_ITERATIONS} iteraciones)...`);
    results.tests.generateDeviceId = await measureExecutionTime(
      licenseClient.generateDeviceId.bind(licenseClient),
      [],
      TEST_ITERATIONS
    );
    console.log('Prueba de generación de ID de dispositivo completada.');
  } else {
    console.warn('Cliente de licencias no disponible. Omitiendo pruebas relacionadas.');
  }
  
  // Calcular resumen
  results.summary = {
    date: new Date().toISOString(),
    totalTests: Object.keys(results.tests).length,
    averageTimes: {}
  };
  
  // Calcular tiempos promedio
  for (const [testName, testResult] of Object.entries(results.tests)) {
    results.summary.averageTimes[testName] = {
      average: testResult.average.toFixed(2) + ' ms',
      min: testResult.min.toFixed(2) + ' ms',
      max: testResult.max.toFixed(2) + ' ms'
    };
  }
  
  // Guardar resultados
  fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));
  console.log(`Resultados guardados en ${REPORT_FILE}`);
  
  // Mostrar resumen
  console.log('\nResumen de pruebas de rendimiento:');
  console.log('--------------------------------');
  console.log(`Sistema: ${results.system.os.platform} ${results.system.os.arch} (${results.system.cpu.model})`);
  console.log(`Memoria: ${results.system.memory.total} (${results.system.memory.used} usado)`);
  console.log('--------------------------------');
  
  for (const [testName, stats] of Object.entries(results.summary.averageTimes)) {
    console.log(`${testName}: Promedio: ${stats.average}, Min: ${stats.min}, Max: ${stats.max}`);
  }
  
  console.log('--------------------------------');
  console.log('Pruebas de rendimiento completadas.');
}

// Ejecutar pruebas
runPerformanceTests().catch(error => {
  console.error(`Error al ejecutar pruebas de rendimiento: ${error.message}`);
  process.exit(1);
});
