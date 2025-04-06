/**
 * update-all.js - Script para actualizar el proyecto a la nueva versión con todas las mejoras
 * 
 * Este script realiza las siguientes acciones:
 * 1. Hace una copia de seguridad de los archivos originales
 * 2. Reemplaza los archivos con las nuevas versiones
 * 3. Ejecuta la migración de datos
 * 4. Instala las dependencias necesarias
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Configuración
const BACKUP_DIR = path.join(__dirname, 'backup-' + new Date().toISOString().replace(/[:.]/g, '-'));
const FILES_TO_UPDATE = [
    { source: 'index.js.new', target: 'index.js' },
    { source: 'ai-service.js.new', target: 'ai-service.js' }
];

/**
 * Función principal
 */
async function main() {
    try {
        console.log('=== Iniciando actualización completa del asistente de ventas de WhatsApp ===');
        
        // 1. Crear directorio de backup
        console.log(`Creando directorio de backup: ${BACKUP_DIR}`);
        await fs.mkdir(BACKUP_DIR, { recursive: true });
        
        // 2. Hacer backup de archivos existentes
        console.log('Haciendo backup de archivos existentes...');
        for (const file of FILES_TO_UPDATE) {
            try {
                if (await fileExists(file.target)) {
                    await fs.copyFile(
                        path.join(__dirname, file.target),
                        path.join(BACKUP_DIR, file.target)
                    );
                    console.log(`  Backup de ${file.target} creado.`);
                }
            } catch (error) {
                console.error(`  Error al hacer backup de ${file.target}: ${error.message}`);
            }
        }
        
        // 3. Reemplazar archivos
        console.log('Reemplazando archivos con nuevas versiones...');
        for (const file of FILES_TO_UPDATE) {
            try {
                if (await fileExists(file.source)) {
                    await fs.rename(
                        path.join(__dirname, file.source),
                        path.join(__dirname, file.target)
                    );
                    console.log(`  ${file.target} actualizado.`);
                } else {
                    console.warn(`  Archivo fuente ${file.source} no encontrado. No se actualizará ${file.target}.`);
                }
            } catch (error) {
                console.error(`  Error al reemplazar ${file.target}: ${error.message}`);
            }
        }
        
        // 4. Instalar dependencias
        console.log('Instalando dependencias necesarias...');
        try {
            execSync('npm install systeminformation chart.js open electron-log', { stdio: 'inherit' });
            console.log('  Dependencias instaladas correctamente.');
        } catch (error) {
            console.error(`  Error al instalar dependencias: ${error.message}`);
        }
        
        // 5. Ejecutar migración de datos
        console.log('Ejecutando migración de datos...');
        try {
            execSync('node migrate.js', { stdio: 'inherit' });
            console.log('  Migración completada correctamente.');
        } catch (error) {
            console.error(`  Error durante la migración: ${error.message}`);
        }
        
        console.log('=== Actualización completada ===');
        console.log('Puedes iniciar el asistente con el comando: npm start');
        console.log('O iniciar la interfaz gráfica con: npm run electron:start');
        
    } catch (error) {
        console.error(`Error durante la actualización: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Verifica si un archivo existe
 * @param {string} filePath - Ruta al archivo
 * @returns {Promise<boolean>} - true si el archivo existe
 */
async function fileExists(filePath) {
    try {
        await fs.access(path.join(__dirname, filePath));
        return true;
    } catch (error) {
        return false;
    }
}

// Ejecutar la función principal
main().catch(error => {
    console.error(`Error fatal: ${error.message}`);
    process.exit(1);
});
