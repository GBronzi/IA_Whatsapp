/**
 * Pruebas para el módulo de configuración
 */

// Simular variables de entorno antes de importar config
process.env.CLIENT_ID = 'test-bot';
process.env.OLLAMA_MODEL = 'test-model';
process.env.SPREADSHEET_ID = 'test-spreadsheet-id';

const config = require('../config');

describe('Módulo de configuración', () => {
    test('Debe cargar valores de variables de entorno', () => {
        expect(config.CLIENT_ID).toBe('test-bot');
        expect(config.OLLAMA_MODEL).toBe('test-model');
        expect(config.SPREADSHEET_ID).toBe('test-spreadsheet-id');
    });

    test('Debe tener valores por defecto para variables no definidas', () => {
        // Estas variables no fueron definidas en el entorno de prueba
        expect(config.OLLAMA_TIMEOUT).toBe(60000);
        expect(config.LOG_LEVEL).toBe('info');
    });
});
