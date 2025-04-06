const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');

test.describe('Prueba de la ventana de configuración de CRM', () => {
  let electronApp;
  let mainWindow;
  let crmWindow;

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
    mainWindow = await electronApp.firstWindow();
    await mainWindow.waitForLoadState('domcontentloaded');

    // Hacer clic en el botón de configuración de CRM
    const crmButton = await mainWindow.locator('#view-crm-settings');
    await crmButton.click();

    // Esperar a que la ventana de configuración de CRM se abra
    await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar a que la ventana se abra
    const windows = await electronApp.windows();
    expect(windows.length).toBeGreaterThan(1);
    crmWindow = windows[1]; // La segunda ventana debería ser la de configuración de CRM
    await crmWindow.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    // Cerrar la aplicación Electron
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('Debe cargar la ventana de configuración de CRM correctamente', async () => {
    // Verificar el título de la ventana
    const title = await crmWindow.title();
    expect(title).toContain('Configuración de CRM');

    // Verificar que la ventana está visible
    const isVisible = await crmWindow.isVisible();
    expect(isVisible).toBeTruthy();
  });

  test('Debe mostrar los elementos principales de la interfaz de configuración de CRM', async () => {
    // Verificar que la opción de Google Sheets está presente
    const googleSheetsOption = await crmWindow.locator('#google-sheets');
    await expect(googleSheetsOption).toBeVisible();

    // Verificar que la opción de Bitrix24 está presente
    const bitrix24Option = await crmWindow.locator('#bitrix24');
    await expect(bitrix24Option).toBeVisible();

    // Verificar que el campo de ID de Google Sheets está presente
    const googleSheetIdField = await crmWindow.locator('#google-sheet-id');
    await expect(googleSheetIdField).toBeVisible();

    // Verificar que el botón de guardar configuración está presente
    const saveButton = await crmWindow.locator('#save-config-btn');
    await expect(saveButton).toBeVisible();
  });

  test('Debe permitir introducir un ID de Google Sheets', async () => {
    // Hacer clic en la pestaña de Google Sheets
    const googleSheetsTab = await crmWindow.locator('.tab[data-tab="google-sheets"]');
    await googleSheetsTab.click();

    // Introducir un ID de Google Sheets
    const googleSheetIdField = await crmWindow.locator('#google-sheet-id');
    await googleSheetIdField.fill('1PmLLazjuvBdHcMGqKY94ZH5IkkF6w5Axxt2cr2b_LXI');

    // Verificar que el valor se ha introducido correctamente
    const value = await googleSheetIdField.inputValue();
    expect(value).toBe('1PmLLazjuvBdHcMGqKY94ZH5IkkF6w5Axxt2cr2b_LXI');
  });
});
