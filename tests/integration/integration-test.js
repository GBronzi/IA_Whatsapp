/**
 * Pruebas de integración para el Asistente de Ventas WhatsApp
 * 
 * Este script verifica la integración entre los diferentes componentes del sistema.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const os = require('os');

// Importar módulos a probar
let licenseClient;
try {
  licenseClient = require('../../license-client');
} catch (error) {
  console.error(`Error al cargar cliente de licencias: ${error.message}`);
}

let autoUpdater;
try {
  autoUpdater = require('../../auto-updater');
} catch (error) {
  console.error(`Error al cargar gestor de actualizaciones: ${error.message}`);
}

// Configuración de prueba
const TEST_LICENSE_KEY = 'eyJhcHBOYW1lIjoiQXNpc3RlbnRlVmVudGFzV2hhdHNBcHAiLCJ1c2VyTmFtZSI6IlRlc3RVc2VyIiwic2VjcmV0S2V5IjoiMTIzNDU2Nzg5MCIsInRpbWVzdGFtcCI6MTY4MDAwMDAwMDAwMCwiZXhwaXJ5RGF0ZSI6IjIwMjQtMTItMzFUMjM6NTk6NTkuOTk5WiJ9.abcd1234';
const REPORT_FILE = path.join(__dirname, 'integration-test-report.json');

// Resultados de las pruebas
const results = {
  date: new Date().toISOString(),
  system: {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpus: os.cpus().length
  },
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  }
};

/**
 * Ejecuta una prueba y registra el resultado
 * @param {string} name - Nombre de la prueba
 * @param {Function} testFn - Función de prueba
 */
async function runTest(name, testFn) {
  console.log(`Ejecutando prueba: ${name}`);
  
  const testResult = {
    name,
    status: 'skipped',
    duration: 0,
    error: null
  };
  
  try {
    const start = performance.now();
    await testFn();
    const end = performance.now();
    
    testResult.status = 'passed';
    testResult.duration = end - start;
    
    results.summary.passed++;
    console.log(`✓ Prueba pasada: ${name} (${testResult.duration.toFixed(2)} ms)`);
  } catch (error) {
    testResult.status = 'failed';
    testResult.error = error.message;
    
    results.summary.failed++;
    console.error(`✗ Prueba fallida: ${name}`);
    console.error(`  Error: ${error.message}`);
  }
  
  results.tests.push(testResult);
  results.summary.total++;
}

/**
 * Ejecuta las pruebas de integración
 */
async function runIntegrationTests() {
  console.log('Iniciando pruebas de integración...');
  
  // Prueba: Inicialización del cliente de licencias
  await runTest('Inicialización del cliente de licencias', async () => {
    if (!licenseClient) {
      throw new Error('Cliente de licencias no disponible');
    }
    
    licenseClient.initialize({
      serverUrl: 'http://localhost:3000',
      timeout: 5000,
      retryCount: 3,
      retryDelay: 1000,
      offlineMode: true,
      cacheExpiry: 86400000
    });
    
    // Verificar que se haya inicializado correctamente
    assert.strictEqual(typeof licenseClient.verifyLicense, 'function');
    assert.strictEqual(typeof licenseClient.activateLicense, 'function');
    assert.strictEqual(typeof licenseClient.recoverLicense, 'function');
    assert.strictEqual(typeof licenseClient.generateDeviceId, 'function');
  });
  
  // Prueba: Verificación de licencia
  await runTest('Verificación de licencia', async () => {
    if (!licenseClient) {
      throw new Error('Cliente de licencias no disponible');
    }
    
    const result = await licenseClient.verifyLicense(TEST_LICENSE_KEY);
    
    // Verificar resultado
    assert.strictEqual(typeof result, 'object');
    assert.strictEqual(typeof result.valid, 'boolean');
    assert.strictEqual(typeof result.status, 'string');
    assert.strictEqual(typeof result.message, 'string');
  });
  
  // Prueba: Generación de ID de dispositivo
  await runTest('Generación de ID de dispositivo', async () => {
    if (!licenseClient) {
      throw new Error('Cliente de licencias no disponible');
    }
    
    const deviceId = licenseClient.generateDeviceId();
    
    // Verificar resultado
    assert.strictEqual(typeof deviceId, 'string');
    assert.strictEqual(deviceId.length, 64); // SHA-256 hex digest
  });
  
  // Prueba: Inicialización del gestor de actualizaciones
  await runTest('Inicialización del gestor de actualizaciones', async () => {
    if (!autoUpdater) {
      throw new Error('Gestor de actualizaciones no disponible');
    }
    
    // Crear un mock para la ventana principal
    const mockWindow = {
      webContents: {
        send: () => {}
      }
    };
    
    // Inicializar gestor de actualizaciones
    autoUpdater.initialize({
      updateUrl: 'http://localhost:3001',
      autoDownload: false,
      autoInstall: false,
      channel: 'stable',
      mainWindow: mockWindow
    });
    
    // Verificar que se haya inicializado correctamente
    assert.strictEqual(typeof autoUpdater.checkForUpdates, 'function');
    assert.strictEqual(typeof autoUpdater.downloadUpdate, 'function');
    assert.strictEqual(typeof autoUpdater.quitAndInstall, 'function');
    assert.strictEqual(typeof autoUpdater.getStatus, 'function');
  });
  
  // Prueba: Obtención del estado de actualizaciones
  await runTest('Obtención del estado de actualizaciones', async () => {
    if (!autoUpdater) {
      throw new Error('Gestor de actualizaciones no disponible');
    }
    
    const status = autoUpdater.getStatus();
    
    // Verificar resultado
    assert.strictEqual(typeof status, 'object');
    assert.strictEqual(typeof status.updateAvailable, 'boolean');
    assert.strictEqual(typeof status.updateDownloaded, 'boolean');
    assert.strictEqual(typeof status.autoDownload, 'boolean');
    assert.strictEqual(typeof status.autoInstall, 'boolean');
  });
  
  // Prueba: Integración entre cliente de licencias y gestor de actualizaciones
  await runTest('Integración entre cliente de licencias y gestor de actualizaciones', async () => {
    if (!licenseClient || !autoUpdater) {
      throw new Error('Cliente de licencias o gestor de actualizaciones no disponible');
    }
    
    // Verificar licencia
    const licenseResult = await licenseClient.verifyLicense(TEST_LICENSE_KEY);
    
    // Si la licencia es válida, verificar actualizaciones
    if (licenseResult.valid) {
      // Obtener estado de actualizaciones
      const updateStatus = autoUpdater.getStatus();
      
      // Verificar que el estado sea un objeto válido
      assert.strictEqual(typeof updateStatus, 'object');
      assert.strictEqual(typeof updateStatus.updateAvailable, 'boolean');
    } else {
      throw new Error('La licencia no es válida, no se pueden verificar actualizaciones');
    }
  });
  
  // Guardar resultados
  fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));
  console.log(`Resultados guardados en ${REPORT_FILE}`);
  
  // Mostrar resumen
  console.log('\nResumen de pruebas de integración:');
  console.log('--------------------------------');
  console.log(`Sistema: ${results.system.platform} ${results.system.arch} (${results.system.cpus} CPUs)`);
  console.log('--------------------------------');
  console.log(`Total de pruebas: ${results.summary.total}`);
  console.log(`Pruebas pasadas: ${results.summary.passed}`);
  console.log(`Pruebas fallidas: ${results.summary.failed}`);
  console.log(`Pruebas omitidas: ${results.summary.skipped}`);
  console.log('--------------------------------');
  
  // Mostrar pruebas fallidas
  if (results.summary.failed > 0) {
    console.log('\nPruebas fallidas:');
    results.tests.filter(test => test.status === 'failed').forEach(test => {
      console.log(`- ${test.name}: ${test.error}`);
    });
    console.log('--------------------------------');
  }
  
  console.log('Pruebas de integración completadas.');
  
  // Retornar código de salida según el resultado
  return results.summary.failed === 0;
}

// Ejecutar pruebas
runIntegrationTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error(`Error al ejecutar pruebas de integración: ${error.message}`);
  process.exit(1);
});
