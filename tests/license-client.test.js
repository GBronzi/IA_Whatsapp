/**
 * Pruebas para el cliente de licencias
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const nock = require('nock');

// Importar cliente de licencias
let licenseClient;
try {
  licenseClient = require('../license-client');
} catch (error) {
  console.error(`Error al cargar cliente de licencias: ${error.message}`);
  process.exit(1);
}

// Configuración de prueba
const TEST_SERVER_URL = 'http://localhost:3000';
const TEST_LICENSE_KEY = 'eyJhcHBOYW1lIjoiQXNpc3RlbnRlVmVudGFzV2hhdHNBcHAiLCJ1c2VyTmFtZSI6IlRlc3RVc2VyIiwic2VjcmV0S2V5IjoiMTIzNDU2Nzg5MCIsInRpbWVzdGFtcCI6MTY4MDAwMDAwMDAwMCwiZXhwaXJ5RGF0ZSI6IjIwMjQtMTItMzFUMjM6NTk6NTkuOTk5WiJ9.abcd1234';
const TEST_DEVICE_ID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Función para generar una licencia de prueba
function generateTestLicense(expiryDate = '2024-12-31T23:59:59.999Z') {
  const data = {
    appName: 'AsistenteVentasWhatsApp',
    userName: 'TestUser',
    secretKey: '1234567890',
    timestamp: 1680000000000,
    expiryDate
  };
  
  const dataString = JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(dataString).digest('hex');
  
  return `${Buffer.from(dataString).toString('base64')}.${hash.substring(0, 8)}`;
}

// Configurar cliente de licencias
licenseClient.initialize({
  serverUrl: TEST_SERVER_URL,
  timeout: 1000,
  retryCount: 1,
  retryDelay: 100,
  offlineMode: false,
  cacheExpiry: 1000
});

// Mockear función de generación de ID de dispositivo
const originalGenerateDeviceId = licenseClient.generateDeviceId;
licenseClient.generateDeviceId = () => TEST_DEVICE_ID;

// Pruebas
describe('Cliente de licencias', function() {
  // Restaurar mocks después de las pruebas
  after(function() {
    licenseClient.generateDeviceId = originalGenerateDeviceId;
    nock.cleanAll();
  });
  
  describe('Verificación de licencia', function() {
    it('debería rechazar una licencia vacía', async function() {
      const result = await licenseClient.verifyLicense('');
      
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.status, 'invalid');
    });
    
    it('debería verificar una licencia válida con el servidor', async function() {
      // Mockear respuesta del servidor
      nock(TEST_SERVER_URL)
        .post('/api/verify-license')
        .reply(200, {
          valid: true,
          status: 'active',
          message: 'Licencia válida',
          expiryDate: '2024-12-31T23:59:59.999Z'
        });
      
      const result = await licenseClient.verifyLicense(TEST_LICENSE_KEY);
      
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.status, 'active');
      assert.strictEqual(result.offlineMode, false);
    });
    
    it('debería rechazar una licencia inválida con el servidor', async function() {
      // Mockear respuesta del servidor
      nock(TEST_SERVER_URL)
        .post('/api/verify-license')
        .reply(200, {
          valid: false,
          status: 'invalid',
          message: 'Licencia inválida'
        });
      
      const result = await licenseClient.verifyLicense('invalid-license-key');
      
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.status, 'invalid');
      assert.strictEqual(result.offlineMode, false);
    });
    
    it('debería verificar una licencia offline cuando el servidor no está disponible', async function() {
      // Mockear error de conexión
      nock(TEST_SERVER_URL)
        .post('/api/verify-license')
        .replyWithError('Connection error');
      
      // Generar licencia de prueba
      const licenseKey = generateTestLicense();
      
      const result = await licenseClient.verifyLicense(licenseKey);
      
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.status, 'active');
      assert.strictEqual(result.offlineMode, true);
    });
    
    it('debería rechazar una licencia expirada en modo offline', async function() {
      // Mockear error de conexión
      nock(TEST_SERVER_URL)
        .post('/api/verify-license')
        .replyWithError('Connection error');
      
      // Generar licencia expirada
      const licenseKey = generateTestLicense('2020-12-31T23:59:59.999Z');
      
      const result = await licenseClient.verifyLicense(licenseKey);
      
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.status, 'expired');
      assert.strictEqual(result.offlineMode, true);
    });
  });
  
  describe('Activación de licencia', function() {
    it('debería rechazar una licencia vacía', async function() {
      const result = await licenseClient.activateLicense('');
      
      assert.strictEqual(result.success, false);
    });
    
    it('debería activar una licencia válida con el servidor', async function() {
      // Mockear respuesta del servidor
      nock(TEST_SERVER_URL)
        .post('/api/activate-license')
        .reply(200, {
          success: true,
          message: 'Licencia activada correctamente',
          license: {
            key: TEST_LICENSE_KEY,
            status: 'active',
            expiryDate: '2024-12-31T23:59:59.999Z'
          },
          recoveryKey: '0123456789abcdef'
        });
      
      const result = await licenseClient.activateLicense(TEST_LICENSE_KEY);
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.license.key, TEST_LICENSE_KEY);
      assert.strictEqual(result.recoveryKey, '0123456789abcdef');
    });
    
    it('debería rechazar una licencia inválida con el servidor', async function() {
      // Mockear respuesta del servidor
      nock(TEST_SERVER_URL)
        .post('/api/activate-license')
        .reply(200, {
          success: false,
          message: 'Licencia inválida'
        });
      
      const result = await licenseClient.activateLicense('invalid-license-key');
      
      assert.strictEqual(result.success, false);
    });
  });
  
  describe('Recuperación de licencia', function() {
    it('debería rechazar una clave de recuperación vacía', async function() {
      const result = await licenseClient.recoverLicense('', 'TestUser');
      
      assert.strictEqual(result.success, false);
    });
    
    it('debería rechazar un nombre de usuario vacío', async function() {
      const result = await licenseClient.recoverLicense('0123456789abcdef', '');
      
      assert.strictEqual(result.success, false);
    });
    
    it('debería recuperar una licencia válida con el servidor', async function() {
      // Mockear respuesta del servidor
      nock(TEST_SERVER_URL)
        .post('/api/recover-license')
        .reply(200, {
          success: true,
          message: 'Licencia recuperada correctamente',
          license: {
            key: TEST_LICENSE_KEY,
            status: 'active',
            expiryDate: '2024-12-31T23:59:59.999Z'
          }
        });
      
      const result = await licenseClient.recoverLicense('0123456789abcdef', 'TestUser');
      
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.license.key, TEST_LICENSE_KEY);
    });
    
    it('debería rechazar una clave de recuperación inválida con el servidor', async function() {
      // Mockear respuesta del servidor
      nock(TEST_SERVER_URL)
        .post('/api/recover-license')
        .reply(200, {
          success: false,
          message: 'Clave de recuperación inválida'
        });
      
      const result = await licenseClient.recoverLicense('invalid-recovery-key', 'TestUser');
      
      assert.strictEqual(result.success, false);
    });
  });
  
  describe('Generación de ID de dispositivo', function() {
    it('debería generar un ID de dispositivo único', function() {
      // Restaurar función original
      licenseClient.generateDeviceId = originalGenerateDeviceId;
      
      const deviceId = licenseClient.generateDeviceId();
      
      assert.strictEqual(typeof deviceId, 'string');
      assert.strictEqual(deviceId.length, 64); // SHA-256 hex digest
    });
  });
});
