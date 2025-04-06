const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');

test.describe('Prueba de la ventana principal', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    // Lanzar la aplicación Electron
    electronApp = await electron.launch({
      args: [path.join(__dirname, '..', 'electron', 'main.js')],
      executablePath: path.join(__dirname, '..', 'node_modules', '.bin', 'electron.cmd'),
      env: {
        NODE_ENV: 'test',
        ELECTRON_ENABLE_LOGGING: 'true',
        ELECTRON_ENABLE_STACK_DUMPING: 'true'
      },
      timeout: 60000
    });

    // Esperar a que la ventana principal se cargue
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    // Cerrar la aplicación Electron
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('Debe cargar la ventana principal correctamente', async () => {
    // Verificar el título de la ventana
    const title = await window.title();
    expect(title).toContain('Asistente de Ventas WhatsApp');

    // Verificar que la ventana está visible
    const isVisible = await window.isVisible();
    expect(isVisible).toBeTruthy();
  });

  test('Debe mostrar los elementos principales de la interfaz', async () => {
    // Verificar que el botón de inicio está presente
    const startButton = await window.locator('#start-button');
    await expect(startButton).toBeVisible();

    // Verificar que el botón de detener está presente
    const stopButton = await window.locator('#stop-button');
    await expect(stopButton).toBeVisible();

    // Verificar que el área de logs está presente
    const logsContainer = await window.locator('#logs-container');
    await expect(logsContainer).toBeVisible();
  });

  test('Debe mostrar el botón de configuración de CRM', async () => {
    // Verificar que el botón de configuración de CRM está presente
    const crmButton = await window.locator('#view-crm-settings');
    await expect(crmButton).toBeVisible();
  });
});
