/**
 * build.js - Script para construir la aplicación ejecutable
 * 
 * Este script realiza las siguientes acciones:
 * 1. Verifica que todas las dependencias estén instaladas
 * 2. Copia los archivos necesarios a la carpeta de construcción
 * 3. Construye la aplicación ejecutable con electron-builder
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Configuración
const BUILD_DIR = path.join(__dirname, 'build');
const ELECTRON_DIR = path.join(__dirname, 'electron');
const ICON_PATH = path.join(ELECTRON_DIR, 'assets', 'icon.png');

/**
 * Función principal
 */
async function main() {
    try {
        logger.info('=== Iniciando proceso de construcción ===');
        
        // 1. Verificar dependencias
        logger.info('Verificando dependencias...');
        checkDependencies();
        
        // 2. Crear directorio de construcción si no existe
        if (!fs.existsSync(BUILD_DIR)) {
            fs.mkdirSync(BUILD_DIR, { recursive: true });
        }
        
        // 3. Verificar que exista el directorio de electron
        if (!fs.existsSync(ELECTRON_DIR)) {
            throw new Error('No se encontró el directorio electron. Asegúrate de que existe.');
        }
        
        // 4. Verificar que exista el icono
        if (!fs.existsSync(ICON_PATH)) {
            logger.warn('No se encontró el icono. Se usará un icono predeterminado.');
            
            // Crear directorio de assets si no existe
            const assetsDir = path.join(ELECTRON_DIR, 'assets');
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }
            
            // Crear un icono predeterminado (un archivo vacío)
            fs.writeFileSync(ICON_PATH, '');
        }
        
        // 5. Construir la aplicación
        logger.info('Construyendo aplicación...');
        execSync('npm run build', { stdio: 'inherit' });
        
        logger.info('=== Construcción completada con éxito ===');
        logger.info('La aplicación ejecutable se encuentra en la carpeta dist/');
    } catch (error) {
        logger.error(`Error durante la construcción: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Verifica que todas las dependencias necesarias estén instaladas
 */
function checkDependencies() {
    const requiredDependencies = [
        'electron',
        'electron-builder',
        'electron-log',
        'systeminformation',
        'chart.js'
    ];
    
    const missingDependencies = [];
    
    // Leer package.json
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // Verificar dependencias
    requiredDependencies.forEach(dep => {
        if (!dependencies[dep]) {
            missingDependencies.push(dep);
        }
    });
    
    // Si faltan dependencias, instalarlas
    if (missingDependencies.length > 0) {
        logger.warn(`Faltan las siguientes dependencias: ${missingDependencies.join(', ')}`);
        logger.info('Instalando dependencias faltantes...');
        
        execSync(`npm install --save-dev ${missingDependencies.join(' ')}`, { stdio: 'inherit' });
    }
}

// Ejecutar la función principal
main().catch(error => {
    logger.error(`Error fatal: ${error.message}`);
    process.exit(1);
});
