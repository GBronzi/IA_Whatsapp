/**
 * Pruebas de carga para el Asistente de Ventas WhatsApp
 * 
 * Este script simula múltiples operaciones concurrentes para evaluar
 * el comportamiento del sistema bajo carga.
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
const CONCURRENT_USERS = 50;
const OPERATIONS_PER_USER = 10;
const REPORT_FILE = path.join(__dirname, 'load-test-report.json');

// Resultados de las pruebas
const results = {
  system: {},
  tests: {},
  summary: {}
};

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
 * Simula un usuario realizando operaciones
 * @param {number} userId - ID del usuario
 * @returns {Promise<Object>} - Resultados de las operaciones
 */
async function simulateUser(userId) {
  const userResults = {
    userId,
    operations: [],
    errors: []
  };
  
  // Inicializar cliente de licencias
  if (!licenseClient) {
    userResults.errors.push('Cliente de licencias no disponible');
    return userResults;
  }
  
  // Realizar operaciones
  for (let i = 0; i < OPERATIONS_PER_USER; i++) {
    try {
      const start = performance.now();
      
      // Alternar entre diferentes operaciones
      if (i % 2 === 0) {
        // Verificar licencia
        await licenseClient.verifyLicense(TEST_LICENSE_KEY);
        
        const end = performance.now();
        userResults.operations.push({
          type: 'verifyLicense',
          duration: end - start
        });
      } else {
        // Generar ID de dispositivo
        licenseClient.generateDeviceId();
        
        const end = performance.now();
        userResults.operations.push({
          type: 'generateDeviceId',
          duration: end - start
        });
      }
      
      // Simular tiempo de espera entre operaciones (1-100 ms)
      await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 100) + 1));
    } catch (error) {
      userResults.errors.push(`Error en operación ${i}: ${error.message}`);
    }
  }
  
  return userResults;
}

/**
 * Ejecuta las pruebas de carga
 */
async function runLoadTests() {
  console.log('Iniciando pruebas de carga...');
  
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
  } else {
    console.warn('Cliente de licencias no disponible. Omitiendo pruebas relacionadas.');
    return;
  }
  
  // Medir uso de recursos antes de la prueba
  const startCpu = process.cpuUsage();
  const startMem = process.memoryUsage();
  const startTime = performance.now();
  
  // Simular usuarios concurrentes
  console.log(`Simulando ${CONCURRENT_USERS} usuarios concurrentes (${OPERATIONS_PER_USER} operaciones por usuario)...`);
  const userPromises = [];
  
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    userPromises.push(simulateUser(i));
  }
  
  // Esperar a que todos los usuarios completen sus operaciones
  const userResults = await Promise.all(userPromises);
  
  // Medir uso de recursos después de la prueba
  const endTime = performance.now();
  const endCpu = process.cpuUsage(startCpu);
  const endMem = process.memoryUsage();
  
  // Calcular estadísticas
  const totalOperations = userResults.reduce((sum, user) => sum + user.operations.length, 0);
  const totalErrors = userResults.reduce((sum, user) => sum + user.errors.length, 0);
  const totalDuration = endTime - startTime;
  const operationsPerSecond = (totalOperations / totalDuration) * 1000;
  
  // Calcular tiempos por tipo de operación
  const operationTimes = {};
  
  userResults.forEach(user => {
    user.operations.forEach(op => {
      if (!operationTimes[op.type]) {
        operationTimes[op.type] = [];
      }
      operationTimes[op.type].push(op.duration);
    });
  });
  
  // Calcular estadísticas por tipo de operación
  const operationStats = {};
  
  for (const [type, times] of Object.entries(operationTimes)) {
    const total = times.reduce((sum, time) => sum + time, 0);
    const average = total / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    // Calcular desviación estándar
    const variance = times.reduce((sum, time) => sum + Math.pow(time - average, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);
    
    operationStats[type] = {
      count: times.length,
      average,
      min,
      max,
      stdDev
    };
  }
  
  // Guardar resultados
  results.tests = {
    userResults,
    operationStats,
    resources: {
      cpu: {
        user: endCpu.user / 1000,
        system: endCpu.system / 1000
      },
      memory: {
        rss: {
          start: Math.round(startMem.rss / (1024 * 1024) * 100) / 100 + ' MB',
          end: Math.round(endMem.rss / (1024 * 1024) * 100) / 100 + ' MB',
          diff: Math.round((endMem.rss - startMem.rss) / (1024 * 1024) * 100) / 100 + ' MB'
        },
        heapTotal: {
          start: Math.round(startMem.heapTotal / (1024 * 1024) * 100) / 100 + ' MB',
          end: Math.round(endMem.heapTotal / (1024 * 1024) * 100) / 100 + ' MB',
          diff: Math.round((endMem.heapTotal - startMem.heapTotal) / (1024 * 1024) * 100) / 100 + ' MB'
        },
        heapUsed: {
          start: Math.round(startMem.heapUsed / (1024 * 1024) * 100) / 100 + ' MB',
          end: Math.round(endMem.heapUsed / (1024 * 1024) * 100) / 100 + ' MB',
          diff: Math.round((endMem.heapUsed - startMem.heapUsed) / (1024 * 1024) * 100) / 100 + ' MB'
        }
      }
    }
  };
  
  // Calcular resumen
  results.summary = {
    date: new Date().toISOString(),
    totalUsers: CONCURRENT_USERS,
    totalOperations,
    totalErrors,
    totalDuration: totalDuration.toFixed(2) + ' ms',
    operationsPerSecond: operationsPerSecond.toFixed(2),
    successRate: ((totalOperations - totalErrors) / totalOperations * 100).toFixed(2) + '%',
    averageTimes: {}
  };
  
  // Calcular tiempos promedio
  for (const [type, stats] of Object.entries(operationStats)) {
    results.summary.averageTimes[type] = {
      average: stats.average.toFixed(2) + ' ms',
      min: stats.min.toFixed(2) + ' ms',
      max: stats.max.toFixed(2) + ' ms'
    };
  }
  
  // Guardar resultados
  fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));
  console.log(`Resultados guardados en ${REPORT_FILE}`);
  
  // Mostrar resumen
  console.log('\nResumen de pruebas de carga:');
  console.log('--------------------------------');
  console.log(`Sistema: ${results.system.os.platform} ${results.system.os.arch} (${results.system.cpu.model})`);
  console.log(`Memoria: ${results.system.memory.total} (${results.system.memory.used} usado)`);
  console.log('--------------------------------');
  console.log(`Usuarios concurrentes: ${CONCURRENT_USERS}`);
  console.log(`Operaciones totales: ${totalOperations}`);
  console.log(`Errores totales: ${totalErrors}`);
  console.log(`Duración total: ${results.summary.totalDuration}`);
  console.log(`Operaciones por segundo: ${results.summary.operationsPerSecond}`);
  console.log(`Tasa de éxito: ${results.summary.successRate}`);
  console.log('--------------------------------');
  
  for (const [type, stats] of Object.entries(results.summary.averageTimes)) {
    console.log(`${type}: Promedio: ${stats.average}, Min: ${stats.min}, Max: ${stats.max}`);
  }
  
  console.log('--------------------------------');
  console.log('Uso de recursos:');
  console.log(`CPU: Usuario: ${results.tests.resources.cpu.user} ms, Sistema: ${results.tests.resources.cpu.system} ms`);
  console.log(`Memoria RSS: ${results.tests.resources.memory.rss.start} -> ${results.tests.resources.memory.rss.end} (${results.tests.resources.memory.rss.diff})`);
  console.log(`Memoria Heap: ${results.tests.resources.memory.heapUsed.start} -> ${results.tests.resources.memory.heapUsed.end} (${results.tests.resources.memory.heapUsed.diff})`);
  console.log('--------------------------------');
  console.log('Pruebas de carga completadas.');
}

// Ejecutar pruebas
runLoadTests().catch(error => {
  console.error(`Error al ejecutar pruebas de carga: ${error.message}`);
  process.exit(1);
});
