/**
 * Pruebas para el módulo de actualización automática
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { EventEmitter } = require('events');
const nock = require('nock');
const sinon = require('sinon');

// Mock para electron-updater
class MockAutoUpdater extends EventEmitter {
  constructor() {
    super();
    this.logger = console;
    this.autoDownload = false;
    this.allowPrerelease = false;
    this.channel = 'latest';
  }
  
  setFeedURL(options) {
    this.feedURL = options.url;
  }
  
  async checkForUpdates() {
    return { updateAvailable: true };
  }
  
  async downloadUpdate() {
    this.emit('download-progress', { percent: 0 });
    this.emit('download-progress', { percent: 50 });
    this.emit('download-progress', { percent: 100 });
    this.emit('update-downloaded', { version: '1.1.0', releaseDate: new Date().toISOString() });
    return true;
  }
  
  quitAndInstall() {
    return true;
  }
}

// Mock para electron
const mockApp = {
  getPath: (name) => {
    if (name === 'userData') {
      return path.join(os.tmpdir(), 'auto-updater-test');
    }
    return os.tmpdir();
  }
};

const mockDialog = {
  showMessageBox: sinon.stub().resolves({ response: 0 })
};

// Crear directorio temporal para pruebas
const testDir = path.join(os.tmpdir(), 'auto-updater-test');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Mock para electron-updater
jest.mock('electron-updater', () => ({
  autoUpdater: new MockAutoUpdater()
}));

// Mock para electron
jest.mock('electron', () => ({
  app: mockApp,
  dialog: mockDialog
}));

// Importar módulo de actualización automática
let autoUpdater;
try {
  autoUpdater = require('../auto-updater');
} catch (error) {
  console.error(`Error al cargar módulo de actualización automática: ${error.message}`);
  process.exit(1);
}

// Configuración de prueba
const TEST_UPDATE_URL = 'http://localhost:3001/updates';
const TEST_VERSION = '1.0.0';

// Pruebas
describe('Módulo de actualización automática', function() {
  // Limpiar mocks después de cada prueba
  afterEach(function() {
    sinon.restore();
    nock.cleanAll();
  });
  
  // Eliminar directorio temporal después de todas las pruebas
  after(function() {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Error al eliminar directorio temporal: ${error.message}`);
    }
  });
  
  describe('Inicialización', function() {
    it('debería inicializar correctamente', async function() {
      const mockWindow = {
        webContents: {
          send: sinon.spy()
        }
      };
      
      const result = await autoUpdater.initialize({
        updateUrl: TEST_UPDATE_URL,
        autoDownload: false,
        autoInstall: false,
        channel: 'stable',
        mainWindow: mockWindow
      });
      
      assert.strictEqual(result, autoUpdater);
    });
  });
  
  describe('Verificación de actualizaciones', function() {
    it('debería verificar actualizaciones correctamente', async function() {
      // Inicializar módulo
      const mockWindow = {
        webContents: {
          send: sinon.spy()
        }
      };
      
      await autoUpdater.initialize({
        updateUrl: TEST_UPDATE_URL,
        autoDownload: false,
        autoInstall: false,
        channel: 'stable',
        mainWindow: mockWindow
      });
      
      // Mockear respuesta de checkForUpdates
      const checkForUpdatesSpy = sinon.spy(require('electron-updater').autoUpdater, 'checkForUpdates');
      
      const result = await autoUpdater.checkForUpdates();
      
      assert.strictEqual(result, true);
      assert.strictEqual(checkForUpdatesSpy.calledOnce, true);
    });
  });
  
  describe('Descarga de actualizaciones', function() {
    it('debería descargar actualizaciones correctamente', async function() {
      // Inicializar módulo
      const mockWindow = {
        webContents: {
          send: sinon.spy()
        }
      };
      
      await autoUpdater.initialize({
        updateUrl: TEST_UPDATE_URL,
        autoDownload: false,
        autoInstall: false,
        channel: 'stable',
        mainWindow: mockWindow
      });
      
      // Mockear respuesta de downloadUpdate
      const downloadUpdateSpy = sinon.spy(require('electron-updater').autoUpdater, 'downloadUpdate');
      
      const result = await autoUpdater.downloadUpdate();
      
      assert.strictEqual(result, true);
      assert.strictEqual(downloadUpdateSpy.calledOnce, true);
      assert.strictEqual(mockWindow.webContents.send.calledWith('download-progress'), true);
    });
  });
  
  describe('Instalación de actualizaciones', function() {
    it('debería instalar actualizaciones correctamente', function() {
      // Inicializar módulo
      const mockWindow = {
        webContents: {
          send: sinon.spy()
        }
      };
      
      autoUpdater.initialize({
        updateUrl: TEST_UPDATE_URL,
        autoDownload: false,
        autoInstall: false,
        channel: 'stable',
        mainWindow: mockWindow
      });
      
      // Mockear respuesta de quitAndInstall
      const quitAndInstallSpy = sinon.spy(require('electron-updater').autoUpdater, 'quitAndInstall');
      
      const result = autoUpdater.quitAndInstall();
      
      assert.strictEqual(result, true);
      assert.strictEqual(quitAndInstallSpy.calledOnce, true);
    });
  });
  
  describe('Descarga desde URL', function() {
    it('debería descargar desde URL correctamente', async function() {
      // Inicializar módulo
      const mockWindow = {
        webContents: {
          send: sinon.spy()
        }
      };
      
      await autoUpdater.initialize({
        updateUrl: TEST_UPDATE_URL,
        autoDownload: false,
        autoInstall: false,
        channel: 'stable',
        mainWindow: mockWindow
      });
      
      // Mockear axios
      const axiosMock = {
        method: 'GET',
        url: 'http://example.com/update.exe',
        responseType: 'stream',
        data: new EventEmitter()
      };
      
      const axiosStub = sinon.stub().resolves(axiosMock);
      autoUpdater.__set__('axios', axiosStub);
      
      // Mockear fs.createWriteStream
      const mockWriteStream = new EventEmitter();
      mockWriteStream.pipe = sinon.spy();
      
      const createWriteStreamStub = sinon.stub(fs, 'createWriteStream').returns(mockWriteStream);
      
      // Iniciar descarga
      const downloadPromise = autoUpdater.downloadFromUrl('http://example.com/update.exe', '1.1.0');
      
      // Simular finalización de descarga
      setTimeout(() => {
        mockWriteStream.emit('finish');
      }, 100);
      
      const result = await downloadPromise;
      
      assert.strictEqual(result, true);
      assert.strictEqual(createWriteStreamStub.calledOnce, true);
      assert.strictEqual(mockDialog.showMessageBox.calledOnce, true);
    });
  });
  
  describe('Estado de actualización', function() {
    it('debería devolver el estado de actualización correctamente', function() {
      // Inicializar módulo
      const mockWindow = {
        webContents: {
          send: sinon.spy()
        }
      };
      
      autoUpdater.initialize({
        updateUrl: TEST_UPDATE_URL,
        autoDownload: false,
        autoInstall: false,
        channel: 'stable',
        mainWindow: mockWindow
      });
      
      const status = autoUpdater.getStatus();
      
      assert.strictEqual(typeof status, 'object');
      assert.strictEqual(typeof status.updateAvailable, 'boolean');
      assert.strictEqual(typeof status.updateDownloaded, 'boolean');
      assert.strictEqual(typeof status.autoDownload, 'boolean');
      assert.strictEqual(typeof status.autoInstall, 'boolean');
    });
  });
});
