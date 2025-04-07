/**
 * Pruebas para el panel de administración
 */

const request = require('supertest');
const app = require('../admin-panel/server');
const authManager = require('../auth-manager');

describe('Panel de administración', () => {
  let authToken;
  
  beforeAll(async () => {
    // Inicializar gestor de autenticación
    await authManager.initialize();
    
    // Crear usuario de prueba si no existe
    const users = authManager.getAllUsers();
    const testUser = users.find(u => u.username === 'testuser');
    
    if (!testUser) {
      await authManager.createUser({
        username: 'testuser',
        password: 'Test@123',
        fullName: 'Test User',
        email: 'test@example.com',
        role: 'admin'
      });
    }
  });
  
  test('Debe redirigir a la página de login si no está autenticado', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/login');
  });
  
  test('Debe mostrar la página de login', async () => {
    const response = await request(app).get('/login');
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('Iniciar sesión');
  });
  
  test('Debe rechazar credenciales incorrectas', async () => {
    const response = await request(app)
      .post('/login')
      .send({
        username: 'testuser',
        password: 'wrong-password'
      });
    
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain('/login?error=');
  });
  
  test('Debe autenticar con credenciales correctas', async () => {
    const agent = request.agent(app);
    
    const response = await agent
      .post('/login')
      .send({
        username: 'testuser',
        password: 'Test@123'
      });
    
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/dashboard');
    
    // Verificar que se puede acceder al dashboard
    const dashboardResponse = await agent.get('/dashboard');
    expect(dashboardResponse.statusCode).toBe(200);
    expect(dashboardResponse.text).toContain('Panel de control');
  });
  
  test('Debe acceder a la API con autenticación', async () => {
    const agent = request.agent(app);
    
    // Iniciar sesión
    await agent
      .post('/login')
      .send({
        username: 'testuser',
        password: 'Test@123'
      });
    
    // Acceder a la API
    const response = await agent.get('/api/status');
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });
  
  test('Debe rechazar acceso a la API sin autenticación', async () => {
    const response = await request(app).get('/api/status');
    expect(response.statusCode).toBe(401);
    expect(response.body.success).toBe(false);
  });
  
  test('Debe acceder a la página de análisis predictivo', async () => {
    const agent = request.agent(app);
    
    // Iniciar sesión
    await agent
      .post('/login')
      .send({
        username: 'testuser',
        password: 'Test@123'
      });
    
    // Acceder a la página de análisis predictivo
    const response = await agent.get('/predictive');
    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('Análisis Predictivo');
  });
  
  test('Debe acceder a la API de análisis predictivo', async () => {
    const agent = request.agent(app);
    
    // Iniciar sesión
    await agent
      .post('/login')
      .send({
        username: 'testuser',
        password: 'Test@123'
      });
    
    // Acceder a la API de análisis predictivo
    const response = await agent.get('/predictive/api/client-behavior');
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });
  
  test('Debe cerrar sesión correctamente', async () => {
    const agent = request.agent(app);
    
    // Iniciar sesión
    await agent
      .post('/login')
      .send({
        username: 'testuser',
        password: 'Test@123'
      });
    
    // Cerrar sesión
    const response = await agent.get('/logout');
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/login');
    
    // Verificar que no se puede acceder al dashboard
    const dashboardResponse = await agent.get('/dashboard');
    expect(dashboardResponse.statusCode).toBe(302);
    expect(dashboardResponse.headers.location).toBe('/login');
  });
});
