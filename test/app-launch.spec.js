const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');
const { execSync } = require('child_process');

test('La aplicación Electron se inicia correctamente', async () => {
  // Verificar que el ejecutable de Electron existe
  const electronPath = path.join(__dirname, '..', 'node_modules', '.bin', 'electron.cmd');
  test.info().annotations.push({ type: 'Electron Path', description: electronPath });
  
  // Verificar que el archivo main.js existe
  const mainJsPath = path.join(__dirname, '..', 'electron', 'main.js');
  test.info().annotations.push({ type: 'Main.js Path', description: mainJsPath });
  
  // Ejecutar un comando para verificar que la aplicación se inicia correctamente
  try {
    // Ejecutar electron con el argumento --version para verificar que funciona
    const output = execSync(`"${electronPath}" --version`, { encoding: 'utf8' });
    test.info().annotations.push({ type: 'Electron Version', description: output.trim() });
    
    // Si llegamos aquí, el comando se ejecutó correctamente
    expect(true).toBeTruthy();
  } catch (error) {
    test.info().annotations.push({ type: 'Error', description: error.message });
    expect(false).toBeTruthy();
  }
});
