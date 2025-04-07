/**
 * Pruebas para el módulo de seguridad
 */

const securityManager = require('../security-manager');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Configuración para pruebas
const TEST_PASSWORD = 'test-password-123';
const TEST_DATA = { foo: 'bar', baz: 123 };
const TEST_STRING = 'Texto de prueba para encriptar';

describe('Módulo de seguridad', () => {
  beforeAll(async () => {
    // Inicializar gestor de seguridad con contraseña de prueba
    await securityManager.initialize(TEST_PASSWORD);
  });

  test('Debe inicializarse correctamente', () => {
    expect(securityManager.initialized).toBe(true);
  });

  test('Debe encriptar y desencriptar datos correctamente', () => {
    // Encriptar datos
    const encrypted = securityManager.encrypt(TEST_DATA);
    expect(encrypted).toBeTruthy();
    expect(typeof encrypted).toBe('string');

    // Desencriptar datos
    const decrypted = securityManager.decrypt(encrypted, 'json');
    expect(decrypted).toEqual(TEST_DATA);
  });

  test('Debe encriptar y desencriptar texto correctamente', () => {
    // Encriptar texto
    const encrypted = securityManager.encrypt(TEST_STRING);
    expect(encrypted).toBeTruthy();
    expect(typeof encrypted).toBe('string');

    // Desencriptar texto
    const decrypted = securityManager.decrypt(encrypted);
    expect(decrypted).toBe(TEST_STRING);
  });

  test('Debe generar y verificar hash de contraseña', async () => {
    // Generar hash
    const hash = await securityManager.hashPassword('my-secure-password');
    expect(hash).toBeTruthy();
    expect(typeof hash).toBe('string');
    expect(hash.split(':')).toHaveLength(3);

    // Verificar contraseña correcta
    const isValid = await securityManager.verifyPassword('my-secure-password', hash);
    expect(isValid).toBe(true);

    // Verificar contraseña incorrecta
    const isInvalid = await securityManager.verifyPassword('wrong-password', hash);
    expect(isInvalid).toBe(false);
  });

  test('Debe generar y verificar tokens JWT', () => {
    // Generar token
    const payload = { userId: '123', role: 'admin' };
    const token = securityManager.generateToken(payload, { expiresIn: '1h' });
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    // Verificar token
    const result = securityManager.verifyToken(token);
    expect(result.valid).toBe(true);
    expect(result.payload.userId).toBe(payload.userId);
    expect(result.payload.role).toBe(payload.role);
  });

  test('Debe rechazar tokens expirados', () => {
    // Generar token con expiración inmediata
    const payload = { userId: '123', role: 'admin' };
    const token = securityManager.generateToken(payload, { expiresIn: '0s' });

    // Esperar a que expire
    setTimeout(() => {
      // Verificar token
      const result = securityManager.verifyToken(token);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expirado');
    }, 100);
  });

  test('Debe generar IDs únicos', () => {
    // Generar varios IDs
    const id1 = securityManager.generateId('test');
    const id2 = securityManager.generateId('test');
    const id3 = securityManager.generateId('test');

    // Verificar que son únicos
    expect(id1).not.toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id2).not.toBe(id3);

    // Verificar formato
    expect(id1.startsWith('test')).toBe(true);
    expect(id2.startsWith('test')).toBe(true);
    expect(id3.startsWith('test')).toBe(true);
  });

  test('Debe validar datos contra esquemas', () => {
    // Esquema de validación
    const schema = {
      required: ['name', 'age'],
      properties: {
        name: { type: 'string', minLength: 3 },
        age: { type: 'integer', minimum: 18 },
        email: { type: 'string', pattern: '^[^@]+@[^@]+\\.[^@]+$' }
      }
    };

    // Datos válidos
    const validData = {
      name: 'John Doe',
      age: 25,
      email: 'john@example.com'
    };

    // Datos inválidos
    const invalidData = {
      name: 'Jo',
      age: 16,
      email: 'invalid-email'
    };

    // Validar datos válidos
    const validResult = securityManager.validateData(validData, schema);
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);

    // Validar datos inválidos
    const invalidResult = securityManager.validateData(invalidData, schema);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });
});
