/**
 * electron-start.js - Script para iniciar la aplicación Electron
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Verificar si estamos en modo desarrollo o producción
const isDev = process.env.NODE_ENV === 'development';

// Función principal
async function main() {
    try {
        logger.info('Iniciando aplicación Electron...');
        
        // Verificar que existe el directorio electron
        const electronDir = path.join(__dirname, 'electron');
        if (!fs.existsSync(electronDir)) {
            throw new Error('No se encontró el directorio electron. Asegúrate de que existe.');
        }
        
        // Verificar que existe el archivo main.js
        const mainJsPath = path.join(electronDir, 'main.js');
        if (!fs.existsSync(mainJsPath)) {
            throw new Error('No se encontró el archivo main.js en el directorio electron.');
        }
        
        // Iniciar Electron
        const electronProcess = spawn(
            isDev ? 'npx' : path.join(__dirname, 'node_modules', '.bin', 'electron'),
            [isDev ? 'electron' : '.', mainJsPath],
            {
                stdio: 'inherit',
                shell: true
            }
        );
        
        // Manejar eventos del proceso
        electronProcess.on('close', (code) => {
            logger.info(`Proceso Electron cerrado con código ${code}`);
            process.exit(code);
        });
        
        electronProcess.on('error', (error) => {
            logger.error(`Error al iniciar Electron: ${error.message}`);
            process.exit(1);
        });
    } catch (error) {
        logger.error(`Error al iniciar aplicación Electron: ${error.message}`);
        process.exit(1);
    }
}

// Ejecutar la función principal
main().catch(error => {
    logger.error(`Error fatal: ${error.message}`);
    process.exit(1);
});
