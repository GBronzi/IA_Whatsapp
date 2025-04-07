/**
 * Pruebas para el gestor de respaldos
 */

const backupManager = require('../backup-manager');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Directorio temporal para pruebas
const TEST_DIR = path.join(os.tmpdir(), 'backup-test-' + Date.now());
const TEST_FILES_DIR = path.join(TEST_DIR, 'files');
const TEST_BACKUP_DIR = path.join(TEST_DIR, 'backups');

// Archivos de prueba
const TEST_FILES = [
  { name: 'test1.txt', content: 'Contenido de prueba 1' },
  { name: 'test2.json', content: JSON.stringify({ test: 'data', number: 123 }) },
  { name: 'test3.db', content: Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]) }
];

describe('Gestor de respaldos', () => {
  beforeAll(async () => {
    // Crear directorios de prueba
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(TEST_FILES_DIR, { recursive: true });
    await fs.mkdir(TEST_BACKUP_DIR, { recursive: true });
    
    // Crear archivos de prueba
    for (const file of TEST_FILES) {
      await fs.writeFile(path.join(TEST_FILES_DIR, file.name), file.content);
    }
    
    // Configurar gestor de respaldos para pruebas
    backupManager.options.backupDir = TEST_BACKUP_DIR;
    backupManager.options.backupInterval = 0; // Desactivar respaldo automático
    backupManager.options.maxBackups = 3;
    backupManager.options.filesToBackup = TEST_FILES.map(file => ({
      path: path.join(TEST_FILES_DIR, file.name),
      required: true
    }));
    backupManager.options.dirsToBackup = [];
    
    // Inicializar gestor de respaldos
    await backupManager.initialize();
  });
  
  afterAll(async () => {
    // Detener respaldo automático
    backupManager.stopAutoBackup();
    
    // Eliminar directorio temporal
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Error al eliminar directorio temporal: ${error.message}`);
    }
  });
  
  test('Debe inicializarse correctamente', () => {
    expect(backupManager.initialized).toBe(true);
  });
  
  test('Debe crear un respaldo correctamente', async () => {
    // Crear respaldo
    const backup = await backupManager.createBackup('test-backup');
    
    // Verificar información del respaldo
    expect(backup.id).toBeDefined();
    expect(backup.id).toContain('backup-');
    expect(backup.id).toContain('-test-backup');
    expect(backup.path).toBeDefined();
    expect(backup.timestamp).toBeDefined();
    expect(backup.fileCount).toBe(TEST_FILES.length);
    
    // Verificar que se creó el archivo
    const exists = await fileExists(backup.path);
    expect(exists).toBe(true);
    
    // Verificar contenido del archivo
    const backupContent = await fs.readFile(backup.path, 'utf8');
    const backupData = JSON.parse(backupContent);
    
    expect(backupData.id).toBe(backup.id);
    expect(backupData.timestamp).toBe(backup.timestamp);
    expect(backupData.label).toBe('test-backup');
    expect(backupData.files).toHaveLength(TEST_FILES.length);
    
    // Guardar ID para pruebas posteriores
    backupId = backup.id;
  });
  
  test('Debe listar respaldos correctamente', async () => {
    // Obtener lista de respaldos
    const backups = await backupManager.getBackups();
    
    // Verificar que hay al menos un respaldo
    expect(backups.length).toBeGreaterThan(0);
    
    // Verificar información del respaldo
    const backup = backups[0];
    expect(backup.id).toBeDefined();
    expect(backup.timestamp).toBeDefined();
    expect(backup.fileCount).toBe(TEST_FILES.length);
  });
  
  test('Debe restaurar un respaldo correctamente', async () => {
    // Crear directorio temporal para restauración
    const restoreDir = path.join(TEST_DIR, 'restore');
    await fs.mkdir(restoreDir, { recursive: true });
    
    // Modificar rutas de archivos para restaurar en el directorio temporal
    const originalFilesToBackup = [...backupManager.options.filesToBackup];
    backupManager.options.filesToBackup = TEST_FILES.map(file => ({
      path: path.join(restoreDir, file.name),
      required: true
    }));
    
    // Obtener lista de respaldos
    const backups = await backupManager.getBackups();
    
    // Verificar que hay al menos un respaldo
    expect(backups.length).toBeGreaterThan(0);
    
    // Restaurar el primer respaldo
    const restored = await backupManager.restoreBackup(backups[0].id);
    expect(restored).toBe(true);
    
    // Verificar que se restauraron los archivos
    for (const file of TEST_FILES) {
      const filePath = path.join(restoreDir, file.name);
      const exists = await fileExists(filePath);
      expect(exists).toBe(true);
      
      // Verificar contenido
      const content = await fs.readFile(filePath, file.name.endsWith('.db') ? null : 'utf8');
      if (file.name.endsWith('.db')) {
        expect(Buffer.isBuffer(content)).toBe(true);
      } else {
        expect(content).toBe(file.content);
      }
    }
    
    // Restaurar configuración original
    backupManager.options.filesToBackup = originalFilesToBackup;
  });
  
  test('Debe limpiar respaldos antiguos', async () => {
    // Crear varios respaldos
    for (let i = 0; i < 5; i++) {
      await backupManager.createBackup(`test-${i}`);
    }
    
    // Limpiar respaldos antiguos
    await backupManager.cleanupOldBackups();
    
    // Verificar que solo quedan los respaldos más recientes
    const backups = await backupManager.getBackups();
    expect(backups.length).toBeLessThanOrEqual(backupManager.options.maxBackups);
  });
  
  test('Debe eliminar un respaldo correctamente', async () => {
    // Obtener lista de respaldos
    const backups = await backupManager.getBackups();
    
    // Verificar que hay al menos un respaldo
    expect(backups.length).toBeGreaterThan(0);
    
    // Eliminar el primer respaldo
    const deleted = await backupManager.deleteBackup(backups[0].id);
    expect(deleted).toBe(true);
    
    // Verificar que se eliminó
    const backupsAfter = await backupManager.getBackups();
    expect(backupsAfter.length).toBe(backups.length - 1);
    
    // Verificar que no existe el archivo
    const exists = await fileExists(path.join(TEST_BACKUP_DIR, `${backups[0].id}.json`));
    expect(exists).toBe(false);
  });
});

/**
 * Verifica si un archivo existe
 * @param {string} filePath - Ruta del archivo
 * @returns {Promise<boolean>} - true si existe
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}
