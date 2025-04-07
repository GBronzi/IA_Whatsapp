const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');

/**
 * Pruebas para la ventana principal de la aplicación
 */
test.describe('Ventana principal', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    // Lanzar la aplicación Electron
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../index.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_ENABLE_LOGGING: 'true',
        ELECTRON_ENABLE_STACK_DUMPING: 'true',
      },
    });

    // Esperar a que la aplicación esté lista
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    // Cerrar la aplicación
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('Debe mostrar la ventana principal', async () => {
    // Verificar que la ventana principal se muestra correctamente
    const title = await window.title();
    expect(title).toContain('Asistente de Ventas WhatsApp');
  });

  test('Debe mostrar el formulario de inicio de sesión', async () => {
    // Verificar que se muestra el formulario de inicio de sesión
    const loginForm = await window.locator('#login-form');
    await expect(loginForm).toBeVisible();
  });

  test('Debe mostrar mensaje de error con credenciales incorrectas', async () => {
    // Intentar iniciar sesión con credenciales incorrectas
    await window.locator('#username').fill('usuario_incorrecto');
    await window.locator('#password').fill('contraseña_incorrecta');
    await window.locator('#login-button').click();

    // Verificar que se muestra un mensaje de error
    const errorMessage = await window.locator('.error-message');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('credenciales');
  });
});
