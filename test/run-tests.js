const Mocha = require('mocha');
const path = require('path');
const fs = require('fs');

// Crear una instancia de Mocha
const mocha = new Mocha({
  timeout: 20000
});

// Obtener todos los archivos de prueba
const testDir = __dirname;
fs.readdirSync(testDir)
  .filter(file => file.endsWith('.test.js'))
  .forEach(file => {
    mocha.addFile(path.join(testDir, file));
  });

// Ejecutar las pruebas
mocha.run(failures => {
  process.exitCode = failures ? 1 : 0;
});
