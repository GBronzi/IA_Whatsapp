const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');

/**
 * Pruebas para la configuración del CRM (Google Sheets)
 */
test.describe('Configuración del CRM', () => {
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

    // Iniciar sesión (simulado para pruebas)
    await window.evaluate(() => {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('username', 'test_user');
      window.location.reload();
    });

    // Esperar a que se cargue la interfaz principal
    await window.waitForSelector('#main-interface');
  });

  test.afterAll(async () => {
    // Cerrar la aplicación
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('Debe mostrar la sección de configuración del CRM', async () => {
    // Navegar a la sección de configuración
    await window.locator('#settings-button').click();
    
    // Verificar que se muestra la sección de configuración del CRM
    const crmSection = await window.locator('#crm-settings');
    await expect(crmSection).toBeVisible();
  });

  test('Debe permitir configurar el ID de Google Sheets', async () => {
    // Navegar a la sección de configuración si no estamos ya en ella
    if (!await window.locator('#crm-settings').isVisible()) {
      await window.locator('#settings-button').click();
    }
    
    // Ingresar un ID de Google Sheets
    const testSheetId = '1abc123xyz456789';
    await window.locator('#google-sheet-id').fill(testSheetId);
    await window.locator('#save-crm-settings').click();
    
    // Verificar que se muestra un mensaje de éxito
    const successMessage = await window.locator('.success-message');
    await expect(successMessage).toBeVisible();
    await expect(successMessage).toContainText('guardada');
    
    // Verificar que el ID se guardó correctamente
    await window.reload();
    await window.waitForSelector('#crm-settings');
    const savedId = await window.locator('#google-sheet-id').inputValue();
    expect(savedId).toBe(testSheetId);
  });

  test('Debe mostrar error con ID de Google Sheets inválido', async () => {
    // Navegar a la sección de configuración si no estamos ya en ella
    if (!await window.locator('#crm-settings').isVisible()) {
      await window.locator('#settings-button').click();
    }
    
    // Ingresar un ID de Google Sheets inválido
    await window.locator('#google-sheet-id').fill('invalid-id');
    await window.locator('#save-crm-settings').click();
    
    // Verificar que se muestra un mensaje de error
    const errorMessage = await window.locator('.error-message');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('inválido');
  });
});
