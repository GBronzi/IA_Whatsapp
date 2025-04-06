/**
 * Módulo para crear el menú de la aplicación
 */

const { app, Menu, dialog, shell } = require('electron');
const path = require('path');
const url = require('url');
const log = require('electron-log');

/**
 * Crea el menú de la aplicación
 * @param {BrowserWindow} mainWindow - Ventana principal
 * @param {Object} autoUpdater - Gestor de actualizaciones
 * @returns {Menu} - Menú de la aplicación
 */
function createMenu(mainWindow, autoUpdater) {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Configuración',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            if (mainWindow) {
              mainWindow.loadURL(url.format({
                pathname: path.join(__dirname, 'settings.html'),
                protocol: 'file:',
                slashes: true
              }));
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Salir',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'delete', label: 'Eliminar' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'forceReload', label: 'Forzar recarga' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Restablecer zoom' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    },
    {
      label: 'Herramientas',
      submenu: [
        {
          label: 'Verificar actualizaciones',
          click: () => {
            if (autoUpdater) {
              autoUpdater.checkForUpdates().then(updateAvailable => {
                if (!updateAvailable) {
                  dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'Actualizaciones',
                    message: 'No hay actualizaciones disponibles',
                    detail: 'Estás utilizando la última versión de la aplicación.'
                  });
                }
              }).catch(error => {
                dialog.showMessageBox(mainWindow, {
                  type: 'error',
                  title: 'Error',
                  message: 'Error al verificar actualizaciones',
                  detail: error.message
                });
              });
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Error',
                message: 'Gestor de actualizaciones no disponible',
                detail: 'No se pudo verificar actualizaciones.'
              });
            }
          }
        },
        {
          label: 'Ejecutar diagnóstico',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('run-diagnostics');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Ver registros',
          click: () => {
            const logPath = log.transports.file.getFile().path;
            shell.openPath(logPath).catch(error => {
              dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Error',
                message: 'Error al abrir archivo de registros',
                detail: error.message
              });
            });
          }
        }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Documentación',
          click: () => {
            shell.openExternal('https://github.com/GBronzi/IA_Whatsapp/wiki').catch(error => {
              dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Error',
                message: 'Error al abrir documentación',
                detail: error.message
              });
            });
          }
        },
        {
          label: 'Reportar problema',
          click: () => {
            shell.openExternal('https://github.com/GBronzi/IA_Whatsapp/issues').catch(error => {
              dialog.showMessageBox(mainWindow, {
                type: 'error',
                title: 'Error',
                message: 'Error al abrir página de problemas',
                detail: error.message
              });
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Acerca de',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Acerca de',
              message: 'Asistente de Ventas WhatsApp',
              detail: `Versión: ${app.getVersion()}\nDesarrollado por: Tu Empresa`
            });
          }
        }
      ]
    }
  ];
  
  return Menu.buildFromTemplate(template);
}

module.exports = { createMenu };
