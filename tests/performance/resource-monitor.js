/**
 * Monitor de recursos para el Asistente de Ventas WhatsApp
 * 
 * Este script monitorea el uso de recursos (CPU, memoria, disco) durante
 * la ejecución de la aplicación.
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const os = require('os');
const si = require('systeminformation');
const { spawn } = require('child_process');

// Configuración
const MONITOR_INTERVAL = 1000; // 1 segundo
const MONITOR_DURATION = 60000; // 1 minuto
const REPORT_FILE = path.join(__dirname, 'resource-monitor-report.json');
const APP_COMMAND = 'npm';
const APP_ARGS = ['run', 'electron'];

// Resultados del monitoreo
const results = {
  system: {},
  samples: [],
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
 * Monitorea el uso de recursos de un proceso
 * @param {number} pid - ID del proceso
 * @returns {Promise<Object>} - Uso de recursos
 */
async function monitorProcess(pid) {
  try {
    const [processLoad, processMem] = await Promise.all([
      si.processLoad(pid),
      si.processMemory(pid)
    ]);
    
    return {
      cpu: processLoad.cpu,
      memory: {
        rss: Math.round(processMem.rss / (1024 * 1024) * 100) / 100,
        vss: Math.round(processMem.vsize / (1024 * 1024) * 100) / 100
      }
    };
  } catch (error) {
    console.error(`Error al monitorear proceso ${pid}: ${error.message}`);
    return {
      cpu: 0,
      memory: {
        rss: 0,
        vss: 0
      },
      error: error.message
    };
  }
}

/**
 * Monitorea el uso de recursos del sistema
 * @returns {Promise<Object>} - Uso de recursos
 */
async function monitorSystem() {
  try {
    const [currentLoad, mem, fsStats] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.fsStats()
    ]);
    
    return {
      cpu: {
        total: currentLoad.currentLoad,
        user: currentLoad.currentLoadUser,
        system: currentLoad.currentLoadSystem
      },
      memory: {
        total: Math.round(mem.total / (1024 * 1024) * 100) / 100,
        used: Math.round(mem.used / (1024 * 1024) * 100) / 100,
        free: Math.round(mem.free / (1024 * 1024) * 100) / 100,
        usedPercent: Math.round(mem.used / mem.total * 10000) / 100
      },
      disk: {
        reads: fsStats.rx,
        writes: fsStats.wx,
        ioTime: fsStats.tIO
      }
    };
  } catch (error) {
    console.error(`Error al monitorear sistema: ${error.message}`);
    return {
      cpu: {
        total: 0,
        user: 0,
        system: 0
      },
      memory: {
        total: 0,
        used: 0,
        free: 0,
        usedPercent: 0
      },
      disk: {
        reads: 0,
        writes: 0,
        ioTime: 0
      },
      error: error.message
    };
  }
}

/**
 * Ejecuta el monitoreo de recursos
 */
async function runResourceMonitor() {
  console.log('Iniciando monitoreo de recursos...');
  
  // Recopilar información del sistema
  console.log('Recopilando información del sistema...');
  results.system = await collectSystemInfo();
  console.log('Información del sistema recopilada.');
  
  // Iniciar la aplicación
  console.log(`Iniciando aplicación: ${APP_COMMAND} ${APP_ARGS.join(' ')}...`);
  const app = spawn(APP_COMMAND, APP_ARGS, {
    stdio: 'pipe',
    detached: true
  });
  
  let appPid = app.pid;
  console.log(`Aplicación iniciada con PID: ${appPid}`);
  
  // Manejar salida de la aplicación
  app.stdout.on('data', (data) => {
    console.log(`[APP] ${data.toString().trim()}`);
  });
  
  app.stderr.on('data', (data) => {
    console.error(`[APP ERROR] ${data.toString().trim()}`);
  });
  
  // Manejar cierre de la aplicación
  app.on('close', (code) => {
    console.log(`Aplicación cerrada con código: ${code}`);
  });
  
  // Iniciar monitoreo
  console.log(`Monitoreando recursos durante ${MONITOR_DURATION / 1000} segundos...`);
  const startTime = performance.now();
  let sampleCount = 0;
  
  const monitorInterval = setInterval(async () => {
    const currentTime = performance.now();
    const elapsedTime = currentTime - startTime;
    
    // Verificar si se ha alcanzado la duración del monitoreo
    if (elapsedTime >= MONITOR_DURATION) {
      clearInterval(monitorInterval);
      
      // Terminar la aplicación
      try {
        process.kill(appPid, 'SIGTERM');
        console.log(`Aplicación terminada (PID: ${appPid})`);
      } catch (error) {
        console.error(`Error al terminar aplicación: ${error.message}`);
      }
      
      // Calcular resumen
      calculateSummary();
      
      // Guardar resultados
      fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));
      console.log(`Resultados guardados en ${REPORT_FILE}`);
      
      // Mostrar resumen
      displaySummary();
      
      console.log('Monitoreo de recursos completado.');
      return;
    }
    
    // Monitorear recursos
    const systemResources = await monitorSystem();
    let processResources = { cpu: 0, memory: { rss: 0, vss: 0 } };
    
    if (appPid) {
      try {
        processResources = await monitorProcess(appPid);
      } catch (error) {
        console.error(`Error al monitorear proceso: ${error.message}`);
      }
    }
    
    // Guardar muestra
    const sample = {
      timestamp: new Date().toISOString(),
      elapsedTime: Math.round(elapsedTime),
      system: systemResources,
      process: processResources
    };
    
    results.samples.push(sample);
    sampleCount++;
    
    // Mostrar progreso
    const progress = Math.round(elapsedTime / MONITOR_DURATION * 100);
    console.log(`Progreso: ${progress}% (${sampleCount} muestras) - CPU: ${processResources.cpu.toFixed(2)}%, Memoria: ${processResources.memory.rss.toFixed(2)} MB`);
  }, MONITOR_INTERVAL);
}

/**
 * Calcula el resumen del monitoreo
 */
function calculateSummary() {
  // Verificar si hay muestras
  if (results.samples.length === 0) {
    results.summary = {
      error: 'No hay muestras disponibles'
    };
    return;
  }
  
  // Extraer valores
  const processCpu = results.samples.map(sample => sample.process.cpu);
  const processMemRss = results.samples.map(sample => sample.process.memory.rss);
  const processMemVss = results.samples.map(sample => sample.process.memory.vss);
  const systemCpu = results.samples.map(sample => sample.system.cpu.total);
  const systemMemUsed = results.samples.map(sample => sample.system.memory.used);
  const systemMemPercent = results.samples.map(sample => sample.system.memory.usedPercent);
  
  // Calcular estadísticas
  results.summary = {
    date: new Date().toISOString(),
    duration: results.samples[results.samples.length - 1].elapsedTime,
    sampleCount: results.samples.length,
    process: {
      cpu: {
        min: Math.min(...processCpu),
        max: Math.max(...processCpu),
        avg: processCpu.reduce((sum, val) => sum + val, 0) / processCpu.length
      },
      memory: {
        rss: {
          min: Math.min(...processMemRss),
          max: Math.max(...processMemRss),
          avg: processMemRss.reduce((sum, val) => sum + val, 0) / processMemRss.length
        },
        vss: {
          min: Math.min(...processMemVss),
          max: Math.max(...processMemVss),
          avg: processMemVss.reduce((sum, val) => sum + val, 0) / processMemVss.length
        }
      }
    },
    system: {
      cpu: {
        min: Math.min(...systemCpu),
        max: Math.max(...systemCpu),
        avg: systemCpu.reduce((sum, val) => sum + val, 0) / systemCpu.length
      },
      memory: {
        used: {
          min: Math.min(...systemMemUsed),
          max: Math.max(...systemMemUsed),
          avg: systemMemUsed.reduce((sum, val) => sum + val, 0) / systemMemUsed.length
        },
        percent: {
          min: Math.min(...systemMemPercent),
          max: Math.max(...systemMemPercent),
          avg: systemMemPercent.reduce((sum, val) => sum + val, 0) / systemMemPercent.length
        }
      }
    }
  };
}

/**
 * Muestra el resumen del monitoreo
 */
function displaySummary() {
  console.log('\nResumen del monitoreo de recursos:');
  console.log('--------------------------------');
  console.log(`Sistema: ${results.system.os.platform} ${results.system.os.arch} (${results.system.cpu.model})`);
  console.log(`Memoria: ${results.system.memory.total} (${results.system.memory.used} usado)`);
  console.log('--------------------------------');
  console.log(`Duración: ${results.summary.duration} ms`);
  console.log(`Muestras: ${results.summary.sampleCount}`);
  console.log('--------------------------------');
  console.log('Proceso:');
  console.log(`CPU: Min: ${results.summary.process.cpu.min.toFixed(2)}%, Max: ${results.summary.process.cpu.max.toFixed(2)}%, Promedio: ${results.summary.process.cpu.avg.toFixed(2)}%`);
  console.log(`Memoria RSS: Min: ${results.summary.process.memory.rss.min.toFixed(2)} MB, Max: ${results.summary.process.memory.rss.max.toFixed(2)} MB, Promedio: ${results.summary.process.memory.rss.avg.toFixed(2)} MB`);
  console.log(`Memoria VSS: Min: ${results.summary.process.memory.vss.min.toFixed(2)} MB, Max: ${results.summary.process.memory.vss.max.toFixed(2)} MB, Promedio: ${results.summary.process.memory.vss.avg.toFixed(2)} MB`);
  console.log('--------------------------------');
  console.log('Sistema:');
  console.log(`CPU: Min: ${results.summary.system.cpu.min.toFixed(2)}%, Max: ${results.summary.system.cpu.max.toFixed(2)}%, Promedio: ${results.summary.system.cpu.avg.toFixed(2)}%`);
  console.log(`Memoria: Min: ${results.summary.system.memory.used.min.toFixed(2)} MB, Max: ${results.summary.system.memory.used.max.toFixed(2)} MB, Promedio: ${results.summary.system.memory.used.avg.toFixed(2)} MB`);
  console.log(`Memoria %: Min: ${results.summary.system.memory.percent.min.toFixed(2)}%, Max: ${results.summary.system.memory.percent.max.toFixed(2)}%, Promedio: ${results.summary.system.memory.percent.avg.toFixed(2)}%`);
  console.log('--------------------------------');
}

// Ejecutar monitoreo
runResourceMonitor().catch(error => {
  console.error(`Error al ejecutar monitoreo de recursos: ${error.message}`);
  process.exit(1);
});
