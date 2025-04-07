/**
 * Pruebas para el gestor de autenticación
 */

const authManager = require('../auth-manager');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Directorio temporal para pruebas
const TEST_DIR = path.join(os.tmpdir(), 'auth-test-' + Date.now());

// Datos de prueba
const TEST_USER = {
  username: 'testuser',
  password: 'Test@123',
  fullName: 'Test User',
  email: 'test@example.com',
  role: 'admin'
};

describe('Gestor de autenticación', () => {
  beforeAll(async () => {
    // Crear directorio temporal
    await fs.mkdir(TEST_DIR, { recursive: true });
    
    // Configurar gestor de autenticación para pruebas
    authManager.options.authDir = TEST_DIR;
    authManager.options.usersFile = 'users-test.json';
    
    // Inicializar gestor de autenticación
    await authManager.initialize();
  });
  
  afterAll(async () => {
    // Eliminar directorio temporal
    try {
      await fs.rm(TEST_DIR, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Error al eliminar directorio temporal: ${error.message}`);
    }
  });
  
  test('Debe inicializarse correctamente', () => {
    expect(authManager.initialized).toBe(true);
  });
  
  test('Debe crear un usuario correctamente', async () => {
    // Crear usuario
    const user = await authManager.createUser(TEST_USER);
    
    // Verificar información del usuario
    expect(user.id).toBeDefined();
    expect(user.username).toBe(TEST_USER.username);
    expect(user.fullName).toBe(TEST_USER.fullName);
    expect(user.email).toBe(TEST_USER.email);
    expect(user.role).toBe(TEST_USER.role);
    expect(user.passwordHash).toBeUndefined(); // No debe incluir datos sensibles
  });
  
  test('Debe autenticar un usuario correctamente', async () => {
    // Autenticar usuario
    const result = await authManager.authenticateUser(TEST_USER.username, TEST_USER.password);
    
    // Verificar resultado
    expect(result.success).toBe(true);
    expect(result.message).toContain('correcta');
    expect(result.token).toBeDefined();
    expect(result.user).toBeDefined();
    expect(result.user.username).toBe(TEST_USER.username);
    expect(result.user.role).toBe(TEST_USER.role);
  });
  
  test('Debe rechazar credenciales incorrectas', async () => {
    // Autenticar con contraseña incorrecta
    const result = await authManager.authenticateUser(TEST_USER.username, 'wrong-password');
    
    // Verificar resultado
    expect(result.success).toBe(false);
    expect(result.message).toContain('incorrectos');
    expect(result.token).toBeUndefined();
  });
  
  test('Debe actualizar un usuario correctamente', async () => {
    // Actualizar usuario
    const updatedUser = await authManager.updateUser(TEST_USER.username, {
      fullName: 'Updated Name',
      email: 'updated@example.com'
    });
    
    // Verificar información actualizada
    expect(updatedUser.fullName).toBe('Updated Name');
    expect(updatedUser.email).toBe('updated@example.com');
    expect(updatedUser.role).toBe(TEST_USER.role); // No debe cambiar
  });
  
  test('Debe obtener un usuario correctamente', () => {
    // Obtener usuario
    const user = authManager.getUser(TEST_USER.username);
    
    // Verificar información
    expect(user).toBeDefined();
    expect(user.username).toBe(TEST_USER.username);
    expect(user.fullName).toBe('Updated Name'); // Nombre actualizado
    expect(user.email).toBe('updated@example.com'); // Email actualizado
    expect(user.passwordHash).toBeUndefined(); // No debe incluir datos sensibles
  });
  
  test('Debe obtener todos los usuarios correctamente', () => {
    // Obtener todos los usuarios
    const users = authManager.getAllUsers();
    
    // Verificar que hay al menos un usuario
    expect(users.length).toBeGreaterThan(0);
    
    // Verificar que el usuario de prueba está en la lista
    const testUser = users.find(u => u.username === TEST_USER.username);
    expect(testUser).toBeDefined();
    expect(testUser.passwordHash).toBeUndefined(); // No debe incluir datos sensibles
  });
  
  test('Debe habilitar y verificar autenticación de dos factores', async () => {
    // Habilitar autenticación de dos factores
    const twoFactorSetup = await authManager.enableTwoFactor(TEST_USER.username);
    
    // Verificar resultado
    expect(twoFactorSetup.success).toBe(true);
    expect(twoFactorSetup.secret).toBeDefined();
    expect(twoFactorSetup.qrCode).toBeDefined();
    
    // Generar código de verificación
    const code = generateTOTP(twoFactorSetup.secret);
    
    // Confirmar autenticación de dos factores
    const confirmed = await authManager.confirmTwoFactor(TEST_USER.username, code);
    expect(confirmed.success).toBe(true);
    
    // Verificar que se habilitó
    const user = authManager.getUser(TEST_USER.username, true);
    expect(user.twoFactorEnabled).toBe(true);
    
    // Autenticar con dos factores
    const authResult = await authManager.authenticateUser(TEST_USER.username, TEST_USER.password);
    expect(authResult.success).toBe(true);
    expect(authResult.requiresTwoFactor).toBe(true);
    expect(authResult.token).toBeUndefined(); // No debe generar token aún
    
    // Verificar código de dos factores
    const verifyResult = await authManager.verifyTwoFactorCode(TEST_USER.username, code);
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.token).toBeDefined(); // Ahora sí debe generar token
  });
  
  test('Debe deshabilitar autenticación de dos factores', async () => {
    // Deshabilitar autenticación de dos factores
    const result = await authManager.disableTwoFactor(TEST_USER.username);
    
    // Verificar resultado
    expect(result.success).toBe(true);
    
    // Verificar que se deshabilitó
    const user = authManager.getUser(TEST_USER.username, true);
    expect(user.twoFactorEnabled).toBe(false);
    expect(user.twoFactorSecret).toBeNull();
    
    // Autenticar sin dos factores
    const authResult = await authManager.authenticateUser(TEST_USER.username, TEST_USER.password);
    expect(authResult.success).toBe(true);
    expect(authResult.requiresTwoFactor).toBe(false);
    expect(authResult.token).toBeDefined(); // Debe generar token directamente
  });
  
  test('Debe eliminar un usuario correctamente', async () => {
    // Eliminar usuario
    const deleted = await authManager.deleteUser(TEST_USER.username);
    expect(deleted).toBe(true);
    
    // Verificar que no existe
    const user = authManager.getUser(TEST_USER.username);
    expect(user).toBeNull();
    
    // Verificar que no se puede autenticar
    const authResult = await authManager.authenticateUser(TEST_USER.username, TEST_USER.password);
    expect(authResult.success).toBe(false);
  });
});

/**
 * Genera un código TOTP para pruebas
 * @param {string} secret - Secreto en formato base32
 * @returns {string} - Código TOTP
 */
function generateTOTP(secret) {
  const speakeasy = require('speakeasy');
  return speakeasy.totp({
    secret: secret,
    encoding: 'base32'
  });
}
