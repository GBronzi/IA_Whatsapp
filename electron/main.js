/**
 * main.js - Archivo principal de Electron para la aplicación de asistente de ventas de WhatsApp
 */

const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, shell } = require('electron');
const path = require('path');
const url = require('url');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const log = require('electron-log');
const si = require('systeminformation');
const open = require('open');

// Importar gestor de autenticación
let authManager;
try {
  authManager = require('../auth-manager');
} catch (error) {
  log.error(`Error al cargar gestor de autenticación: ${error.message}`);
}

// Importar gestor de licencias
let licenseManager;
try {
  licenseManager = require('../license-manager');
} catch (error) {
  log.error(`Error al cargar gestor de licencias: ${error.message}`);
}

// Importar gestor de notificaciones
let notificationManager;
try {
  notificationManager = require('../notification-manager');
} catch (error) {
  log.error(`Error al cargar gestor de notificaciones: ${error.message}`);
}

// Importar gestor de backups
let backupManager;
try {
  backupManager = require('../backup-manager');
} catch (error) {
  log.error(`Error al cargar gestor de backups: ${error.message}`);
}

// Importar gestor de CRM
let crmManager;
try {
  crmManager = require('../crm-manager');
} catch (error) {
  log.error(`Error al cargar gestor de CRM: ${error.message}`);
}

// Configurar logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.info('Iniciando aplicación...');

// Variables globales
let mainWindow;
let loginWindow;
let logsWindow;
let reportsWindow;
let notificationsWindow;
let backupsWindow;
let crmSettingsWindow;
let tray;
let whatsappProcess;
let isRunning = false;
let resourceInterval;
let isLicenseValid = false;
let licenseInfo = null;
let notificationManager;
let backupManager;
let crmManager;

// Configuración de la aplicación
const appConfig = {
  name: 'Asistente de Ventas WhatsApp',
  icon: path.join(__dirname, 'assets', 'icon.png'),
  googleSheetsUrl: 'https://docs.google.com/spreadsheets/d/1PmLLazjuvBdHcMGqKY94ZH5IkkF6w5Axxt2cr2b_LXI/edit',
  // No hay URLs externas
  supportEmail: 'soporte@tuempresa.com',
  supportPhone: '+1234567890',
  supportWebsite: 'https://tuempresa.com/soporte',
  dbPath: path.join(app.getPath('userData'), 'database.sqlite')
};

// Asegurarse de que solo se ejecute una instancia de la aplicación
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log.warn('Ya hay una instancia de la aplicación en ejecución. Cerrando...');
  app.quit();
  return;
}

// Función para crear la ventana de configuración de CRM
function createCrmSettingsWindow() {
  log.info('Creando ventana de configuración de CRM...');

  // Crear la ventana de configuración de CRM
  crmSettingsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    icon: appConfig.icon,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false
  });

  // Cargar el archivo HTML de configuración de CRM
  crmSettingsWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'crm-settings.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Mostrar la ventana cuando esté lista
  crmSettingsWindow.once('ready-to-show', () => {
    crmSettingsWindow.show();
    crmSettingsWindow.focus();
  });

  // Emitir evento cuando la ventana se cierre
  crmSettingsWindow.on('closed', () => {
    crmSettingsWindow = null;
  });

  // Crear menú para la ventana de configuración de CRM
  const menu = Menu.buildFromTemplate([
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Guardar configuración',
          click: () => {
            if (crmSettingsWindow) {
              crmSettingsWindow.webContents.send('save-config');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Cerrar',
          click: () => {
            if (crmSettingsWindow) {
              crmSettingsWindow.close();
            }
          }
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        {
          label: 'Recargar',
          role: 'reload'
        },
        {
          label: 'Herramientas de Desarrollo',
          role: 'toggleDevTools'
        }
      ]
    }
  ]);

  crmSettingsWindow.setMenu(menu);
}

// Función para crear la ventana de backups
function createBackupsWindow() {
  log.info('Creando ventana de backups...');

  // Crear la ventana de backups
  backupsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    icon: appConfig.icon,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false
  });

  // Cargar el archivo HTML de backups
  backupsWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'backups.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Mostrar la ventana cuando esté lista
  backupsWindow.once('ready-to-show', () => {
    backupsWindow.show();
    backupsWindow.focus();
  });

  // Emitir evento cuando la ventana se cierre
  backupsWindow.on('closed', () => {
    backupsWindow = null;
  });

  // Crear menú para la ventana de backups
  const menu = Menu.buildFromTemplate([
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Crear backup',
          click: () => {
            if (backupsWindow) {
              backupsWindow.webContents.send('create-backup');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Cerrar',
          click: () => {
            if (backupsWindow) {
              backupsWindow.close();
            }
          }
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        {
          label: 'Actualizar',
          click: () => {
            if (backupsWindow) {
              backupsWindow.webContents.send('refresh-backups');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Recargar',
          role: 'reload'
        },
        {
          label: 'Herramientas de Desarrollo',
          role: 'toggleDevTools'
        }
      ]
    }
  ]);

  backupsWindow.setMenu(menu);
}

// Función para crear la ventana de notificaciones
function createNotificationsWindow() {
  log.info('Creando ventana de notificaciones...');

  // Crear la ventana de notificaciones
  notificationsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    icon: appConfig.icon,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false
  });

  // Cargar el archivo HTML de notificaciones
  notificationsWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'notifications.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Mostrar la ventana cuando esté lista
  notificationsWindow.once('ready-to-show', () => {
    notificationsWindow.show();
    notificationsWindow.focus();
  });

  // Emitir evento cuando la ventana se cierre
  notificationsWindow.on('closed', () => {
    notificationsWindow = null;
  });

  // Crear menú para la ventana de notificaciones
  const menu = Menu.buildFromTemplate([
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Marcar todas como leídas',
          click: () => {
            if (notificationsWindow) {
              notificationsWindow.webContents.send('mark-all-read');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Cerrar',
          click: () => {
            if (notificationsWindow) {
              notificationsWindow.close();
            }
          }
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        {
          label: 'Actualizar',
          click: () => {
            if (notificationsWindow) {
              notificationsWindow.webContents.send('refresh-notifications');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Recargar',
          role: 'reload'
        },
        {
          label: 'Herramientas de Desarrollo',
          role: 'toggleDevTools'
        }
      ]
    }
  ]);

  notificationsWindow.setMenu(menu);
}

// Función para crear la ventana de reportes
function createReportsWindow() {
  log.info('Creando ventana de reportes...');

  // Crear la ventana de reportes
  reportsWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 900,
    minHeight: 600,
    icon: appConfig.icon,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false
  });

  // Cargar el archivo HTML de reportes
  reportsWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'reports.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Mostrar la ventana cuando esté lista
  reportsWindow.once('ready-to-show', () => {
    reportsWindow.show();
    reportsWindow.focus();
  });

  // Emitir evento cuando la ventana se cierre
  reportsWindow.on('closed', () => {
    reportsWindow = null;
  });

  // Crear menú para la ventana de reportes
  const menu = Menu.buildFromTemplate([
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Exportar Reporte',
          click: () => {
            if (reportsWindow) {
              reportsWindow.webContents.send('export-report');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Cerrar',
          click: () => {
            if (reportsWindow) {
              reportsWindow.close();
            }
          }
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        {
          label: 'Actualizar',
          click: () => {
            if (reportsWindow) {
              reportsWindow.webContents.send('refresh-report');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Recargar',
          role: 'reload'
        },
        {
          label: 'Herramientas de Desarrollo',
          role: 'toggleDevTools'
        }
      ]
    }
  ]);

  reportsWindow.setMenu(menu);
}

// Función para crear la ventana de logs
function createLogsWindow() {
  log.info('Creando ventana de logs...');

  // Crear la ventana de logs
  logsWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    icon: appConfig.icon,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false
  });

  // Cargar el archivo HTML de logs
  logsWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'logs.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Mostrar la ventana cuando esté lista
  logsWindow.once('ready-to-show', () => {
    logsWindow.show();
    logsWindow.focus();
  });

  // Emitir evento cuando la ventana se cierre
  logsWindow.on('closed', () => {
    logsWindow = null;
  });

  // Crear menú para la ventana de logs
  const menu = Menu.buildFromTemplate([
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Exportar Logs',
          click: () => {
            if (logsWindow) {
              logsWindow.webContents.send('export-logs');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Cerrar',
          click: () => {
            if (logsWindow) {
              logsWindow.close();
            }
          }
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        {
          label: 'Actualizar',
          click: () => {
            if (logsWindow) {
              logsWindow.webContents.send('refresh-logs');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Recargar',
          role: 'reload'
        },
        {
          label: 'Herramientas de Desarrollo',
          role: 'toggleDevTools'
        }
      ]
    }
  ]);

  logsWindow.setMenu(menu);
}

// Función para crear la ventana de login
function createLoginWindow() {
  log.info('Creando ventana de login...');

  // Crear la ventana de login
  loginWindow = new BrowserWindow({
    width: 550,
    height: 700,
    minWidth: 500,
    minHeight: 650,
    icon: appConfig.icon,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    resizable: false,
    show: false,
    frame: true,
    autoHideMenuBar: true
  });

  // Cargar el archivo HTML de login
  loginWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'login.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Mostrar la ventana cuando esté lista
  loginWindow.once('ready-to-show', () => {
    loginWindow.show();
    loginWindow.focus();

    // Enviar datos de autenticación a la ventana de login
    if (authManager) {
      authManager.generateQRCode().then(qrCode => {
        loginWindow.webContents.send('auth-data', {
          qrCode,
          status: authManager.getStatus()
        });
      }).catch(error => {
        log.error(`Error al generar código QR: ${error.message}`);
      });
    }
  });

  // Emitir evento cuando la ventana se cierre
  loginWindow.on('closed', () => {
    loginWindow = null;

    // Si no hay licencia válida, cerrar la aplicación
    if (!authManager.getStatus().license.status === 'active' && !mainWindow) {
      app.quit();
    }
  });

  // Deshabilitar menú
  loginWindow.setMenu(null);
}

// Función para crear la ventana principal
function createWindow() {
  log.info('Creando ventana principal...');

  // Crear la ventana del navegador
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 800,
    minHeight: 500,
    icon: appConfig.icon,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false // No mostrar hasta que esté listo
  });

  // Cargar el archivo HTML de la aplicación
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }));

  // Mostrar la ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Emitir evento cuando la ventana se cierre
  mainWindow.on('closed', () => {
    mainWindow = null;
    clearInterval(resourceInterval);
  });

  // Crear menú
  const menu = Menu.buildFromTemplate([
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Iniciar Servicio',
          click: () => {
            if (!isRunning) {
              startWhatsAppService();
            }
          }
        },
        {
          label: 'Detener Servicio',
          click: () => {
            if (isRunning) {
              stopWhatsAppService();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Salir',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Herramientas',
      submenu: [
        {
          label: 'Abrir Google Sheets',
          click: () => {
            shell.openExternal(appConfig.googleSheetsUrl);
          }
        },
        {
          // No hay opciones de CRM externas
        },
        {
          label: 'Explorar Base de Datos',
          click: () => {
            openDatabaseViewer();
          }
        },
        {
          label: 'Editar Entrenamiento IA',
          click: () => {
            openTrainingEditor();
          }
        }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Soporte Técnico',
          click: () => {
            showSupportInfo();
          }
        },
        {
          label: 'Acerca de',
          click: () => {
            showAboutDialog();
          }
        }
      ]
    }
  ]);

  Menu.setApplicationMenu(menu);

  // Iniciar monitoreo de recursos
  startResourceMonitoring();

  log.info('Ventana principal creada.');
}

// Función para crear el icono en la bandeja del sistema
function createTray() {
  log.info('Creando icono en la bandeja del sistema...');

  tray = new Tray(appConfig.icon);
  tray.setToolTip(appConfig.name);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar Aplicación',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: isRunning ? 'Detener Servicio' : 'Iniciar Servicio',
      click: () => {
        if (isRunning) {
          stopWhatsAppService();
        } else {
          startWhatsAppService();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });

  log.info('Icono en la bandeja del sistema creado.');
}

// Función para iniciar el servicio de WhatsApp
function startWhatsAppService() {
  log.info('Iniciando servicio de WhatsApp...');

  if (isRunning) {
    log.warn('El servicio ya está en ejecución.');
    return;
  }

  try {
    // Ruta al script principal
    const scriptPath = path.join(app.getAppPath(), 'index.js');

    // Iniciar el proceso
    whatsappProcess = spawn('node', [scriptPath], {
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Manejar salida estándar
    whatsappProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      log.info(`[WhatsApp] ${output}`);

      // Enviar a la ventana principal
      if (mainWindow) {
        mainWindow.webContents.send('whatsapp-log', output);
      }

      // Detectar si se ha conectado
      if (output.includes('CONECTADO Y LISTO')) {
        updateServiceStatus(true, 'whatsapp', true);
      }

      // Detectar código QR
      if (output.includes('Escanea el código QR con tu WhatsApp')) {
        if (mainWindow) {
          mainWindow.webContents.send('show-qr-notification');
        }
      }
    });

    // Manejar errores
    whatsappProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      log.error(`[WhatsApp Error] ${error}`);

      // Enviar a la ventana principal
      if (mainWindow) {
        mainWindow.webContents.send('whatsapp-error', error);
      }
    });

    // Manejar cierre del proceso
    whatsappProcess.on('close', (code) => {
      log.info(`Proceso de WhatsApp cerrado con código ${code}`);
      updateServiceStatus(false, 'whatsapp', false);
      whatsappProcess = null;
      isRunning = false;

      // Actualizar menú de la bandeja
      updateTrayMenu();
    });

    isRunning = true;
    updateServiceStatus(true, 'whatsapp', false); // Conectando...

    // Actualizar menú de la bandeja
    updateTrayMenu();

    log.info('Servicio de WhatsApp iniciado.');
  } catch (error) {
    log.error(`Error al iniciar el servicio de WhatsApp: ${error.message}`);
    dialog.showErrorBox(
      'Error al iniciar servicio',
      `No se pudo iniciar el servicio de WhatsApp: ${error.message}`
    );
  }
}

// Función para detener el servicio de WhatsApp
function stopWhatsAppService() {
  log.info('Deteniendo servicio de WhatsApp...');

  if (!isRunning || !whatsappProcess) {
    log.warn('El servicio no está en ejecución.');
    return;
  }

  try {
    // En Windows, necesitamos usar taskkill para matar el proceso y sus hijos
    if (process.platform === 'win32') {
      exec(`taskkill /pid ${whatsappProcess.pid} /T /F`, (error) => {
        if (error) {
          log.error(`Error al detener el proceso: ${error.message}`);
        }
      });
    } else {
      // En otros sistemas, podemos usar kill
      process.kill(-whatsappProcess.pid);
    }

    updateServiceStatus(false, 'whatsapp', false);
    updateServiceStatus(false, 'ollama', false);
    isRunning = false;

    // Actualizar menú de la bandeja
    updateTrayMenu();

    log.info('Servicio de WhatsApp detenido.');
  } catch (error) {
    log.error(`Error al detener el servicio de WhatsApp: ${error.message}`);
    dialog.showErrorBox(
      'Error al detener servicio',
      `No se pudo detener el servicio de WhatsApp: ${error.message}`
    );
  }
}

// Función para actualizar el estado del servicio
function updateServiceStatus(running, service, connected) {
  if (mainWindow) {
    mainWindow.webContents.send('service-status', { running, service, connected });
  }
}

// Función para actualizar el menú de la bandeja
function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Mostrar Aplicación',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: isRunning ? 'Detener Servicio' : 'Iniciar Servicio',
      click: () => {
        if (isRunning) {
          stopWhatsAppService();
        } else {
          startWhatsAppService();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

// Función para iniciar el monitoreo de recursos
function startResourceMonitoring() {
  log.info('Iniciando monitoreo de recursos...');

  // Monitorear cada 2 segundos
  resourceInterval = setInterval(async () => {
    try {
      // Obtener uso de CPU
      const cpuData = await si.currentLoad();

      // Obtener uso de memoria
      const memData = await si.mem();

      // Enviar datos a la ventana principal
      if (mainWindow) {
        mainWindow.webContents.send('resource-usage', {
          cpu: cpuData.currentLoad.toFixed(1),
          memory: {
            used: (memData.used / 1024 / 1024 / 1024).toFixed(2), // GB
            total: (memData.total / 1024 / 1024 / 1024).toFixed(2) // GB
          }
        });
      }
    } catch (error) {
      log.error(`Error al obtener información de recursos: ${error.message}`);
    }
  }, 2000);

  log.info('Monitoreo de recursos iniciado.');
}

// Función para abrir el visor de base de datos
function openDatabaseViewer() {
  log.info('Abriendo visor de base de datos...');

  // Verificar si la base de datos existe
  if (!fs.existsSync(appConfig.dbPath)) {
    dialog.showErrorBox(
      'Base de datos no encontrada',
      `No se encontró la base de datos en: ${appConfig.dbPath}`
    );
    return;
  }

  // Abrir la base de datos con una herramienta externa
  // Nota: En una aplicación real, podrías incluir un visor de SQLite en la aplicación
  try {
    // Intentar abrir con DB Browser for SQLite si está instalado
    if (process.platform === 'win32') {
      exec('where DB Browser for SQLite', (error) => {
        if (!error) {
          exec(`"DB Browser for SQLite" "${appConfig.dbPath}"`);
        } else {
          // Si no está instalado, mostrar mensaje
          dialog.showMessageBox({
            type: 'info',
            title: 'Visor de Base de Datos',
            message: 'Para ver la base de datos, necesitas instalar DB Browser for SQLite.',
            buttons: ['Descargar', 'Cancelar'],
            defaultId: 0
          }).then(result => {
            if (result.response === 0) {
              shell.openExternal('https://sqlitebrowser.org/dl/');
            }
          });
        }
      });
    } else {
      // En otros sistemas, intentar abrir con la aplicación predeterminada
      shell.openPath(appConfig.dbPath);
    }
  } catch (error) {
    log.error(`Error al abrir visor de base de datos: ${error.message}`);
    dialog.showErrorBox(
      'Error al abrir base de datos',
      `No se pudo abrir la base de datos: ${error.message}`
    );
  }
}

// Función para abrir el editor de entrenamiento de IA
function openTrainingEditor() {
  log.info('Abriendo editor de entrenamiento de IA...');

  // Ruta al archivo de entrenamiento
  const trainingPath = path.join(app.getAppPath(), 'training-data.json');

  // Verificar si el archivo existe
  if (!fs.existsSync(trainingPath)) {
    // Si no existe, crear uno vacío
    fs.writeFileSync(trainingPath, JSON.stringify([], null, 2));
  }

  // Abrir el archivo con la aplicación predeterminada
  shell.openPath(trainingPath);
}

// Función para mostrar información de soporte
function showSupportInfo() {
  log.info('Mostrando información de soporte...');

  dialog.showMessageBox({
    type: 'info',
    title: 'Soporte Técnico',
    message: 'Contacto para soporte técnico:',
    detail: `Email: ${appConfig.supportEmail}\nTeléfono: ${appConfig.supportPhone}\nSitio web: ${appConfig.supportWebsite}`,
    buttons: ['Enviar Email', 'Visitar Sitio Web', 'Cerrar'],
    defaultId: 2
  }).then(result => {
    if (result.response === 0) {
      shell.openExternal(`mailto:${appConfig.supportEmail}`);
    } else if (result.response === 1) {
      shell.openExternal(appConfig.supportWebsite);
    }
  });
}

// Función para mostrar diálogo "Acerca de"
function showAboutDialog() {
  log.info('Mostrando diálogo "Acerca de"...');

  dialog.showMessageBox({
    type: 'info',
    title: 'Acerca de',
    message: appConfig.name,
    detail: `Versión: ${app.getVersion()}\n\nUna aplicación para gestionar un asistente de ventas de WhatsApp con IA.\n\n© ${new Date().getFullYear()} Tu Empresa`
  });
}

// Función para verificar licencia e iniciar aplicación
async function checkLicenseAndStart() {
  try {
    // Inicializar gestor de autenticación
    if (authManager) {
      await authManager.initialize();
      log.info('Gestor de autenticación inicializado correctamente');

      // Verificar si hay una licencia activa
      const authStatus = authManager.getStatus();
      log.info(`Estado de autenticación: ${JSON.stringify(authStatus)}`);

      // Si no hay licencia activa o está expirada, mostrar ventana de login
      if (authStatus.license.status !== 'active') {
        log.info('No hay licencia activa. Mostrando ventana de login.');
        createLoginWindow();
        return;
      }
    } else {
      log.warn('Gestor de autenticación no disponible.');
    }

    // Inicializar gestor de notificaciones
    if (notificationManager) {
      await notificationManager.initialize();
      log.info('Gestor de notificaciones inicializado correctamente');

      // Configurar funciones globales para notificaciones
      global.notificationClick = (notification) => {
        log.info(`Notificación clickeada: ${notification.id}`);

        // Si la ventana principal está abierta, enviar evento
        if (mainWindow) {
          mainWindow.webContents.send('notification-clicked', notification);
        }
      };

      global.inAppNotification = (notification) => {
        // Si la ventana principal está abierta, enviar evento
        if (mainWindow) {
          mainWindow.webContents.send('new-notification', notification);
        }
      };

      global.playSound = (soundPath, volume = 0.8) => {
        // Si la ventana principal está abierta, enviar evento
        if (mainWindow) {
          mainWindow.webContents.send('play-sound', { soundPath, volume });
        }
      };
    } else {
      log.warn('Gestor de notificaciones no disponible.');
    }

    // Inicializar gestor de backups
    if (backupManager) {
      await backupManager.initialize();
      log.info('Gestor de backups inicializado correctamente');
    } else {
      log.warn('Gestor de backups no disponible.');
    }

    // Si no hay gestor de licencias, iniciar directamente
    if (!licenseManager) {
      log.warn('Gestor de licencias no disponible. Iniciando sin verificación de licencia.');
      isLicenseValid = true;
      createWindow();
      createTray();
      return;
    }

    // Inicializar gestor de licencias
    licenseInfo = await licenseManager.initialize();
    isLicenseValid = licenseInfo.isValid;

    log.info(`Estado de licencia: ${isLicenseValid ? 'Válida' : 'Inválida'}`);

    if (isLicenseValid) {
      // Si la licencia es válida, iniciar aplicación principal
      createWindow();
      createTray();

      // Cerrar ventana de login si está abierta
      if (loginWindow) {
        loginWindow.close();
      }
    } else {
      // Si la licencia no es válida, mostrar ventana de login
      createLoginWindow();
    }
  } catch (error) {
    log.error(`Error al verificar licencia: ${error.message}`);

    // En caso de error, mostrar ventana de login
    createLoginWindow();
  }
}

// Eventos de la aplicación
app.on('ready', () => {
  log.info('Aplicación lista.');
  checkLicenseAndStart();
});

app.on('window-all-closed', () => {
  log.info('Todas las ventanas cerradas.');
  if (process.platform !== 'darwin') {
    // En macOS es común que las aplicaciones permanezcan activas hasta que el usuario salga explícitamente
    app.quit();
  }
});

app.on('activate', () => {
  log.info('Aplicación activada.');
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  log.info('Aplicación cerrándose...');

  // Detener el servicio si está en ejecución
  if (isRunning && whatsappProcess) {
    stopWhatsAppService();
  }

  // Detener monitoreo de recursos
  if (resourceInterval) {
    clearInterval(resourceInterval);
  }
});

// Eventos IPC (comunicación entre procesos)
// --- Eventos de licencia ---
ipcMain.on('check-license', () => {
  if (loginWindow) {
    loginWindow.webContents.send('license-status', licenseInfo || { isValid: false });
  }
});

ipcMain.on('activate-license', async (event, activationCode) => {
  try {
    if (!licenseManager) {
      if (loginWindow) {
        loginWindow.webContents.send('activation-result', {
          success: false,
          message: 'Gestor de licencias no disponible'
        });
      }
      return;
    }

    // Activar licencia
    const result = await licenseManager.activateLicense(activationCode);

    // Enviar resultado a la ventana de login
    if (loginWindow) {
      loginWindow.webContents.send('activation-result', result);
    }

    // Si la activación fue exitosa, actualizar estado
    if (result.success) {
      isLicenseValid = true;
      licenseInfo = result.licenseInfo;
    }
  } catch (error) {
    log.error(`Error al activar licencia: ${error.message}`);

    if (loginWindow) {
      loginWindow.webContents.send('activation-result', {
        success: false,
        message: `Error al activar licencia: ${error.message}`
      });
    }
  }
});

ipcMain.on('deactivate-license', async () => {
  try {
    if (!licenseManager) {
      if (loginWindow) {
        loginWindow.webContents.send('deactivation-result', {
          success: false,
          message: 'Gestor de licencias no disponible'
        });
      }
      return;
    }

    // Desactivar licencia
    const result = await licenseManager.deactivateLicense();

    // Enviar resultado a la ventana de login
    if (loginWindow) {
      loginWindow.webContents.send('deactivation-result', result);
    }

    // Si la desactivación fue exitosa, actualizar estado
    if (result.success) {
      isLicenseValid = false;
      licenseInfo = null;
    }
  } catch (error) {
    log.error(`Error al desactivar licencia: ${error.message}`);

    if (loginWindow) {
      loginWindow.webContents.send('deactivation-result', {
        success: false,
        message: `Error al desactivar licencia: ${error.message}`
      });
    }
  }
});

ipcMain.on('continue-to-main', () => {
  // Si la licencia es válida, iniciar aplicación principal
  if (isLicenseValid) {
    createWindow();
    createTray();

    // Cerrar ventana de login
    if (loginWindow) {
      loginWindow.close();
    }
  }
});

// --- Eventos de la aplicación principal ---
ipcMain.on('start-service', () => {
  startWhatsAppService();
});

ipcMain.on('stop-service', () => {
  stopWhatsAppService();
});

ipcMain.on('open-google-sheets', () => {
  shell.openExternal(appConfig.googleSheetsUrl);
});

// No hay manejadores para CRMs externos

ipcMain.on('open-database-viewer', () => {
  openDatabaseViewer();
});

ipcMain.on('open-training-editor', () => {
  openTrainingEditor();
});

ipcMain.on('show-support-info', () => {
  showSupportInfo();
});

ipcMain.on('check-ollama-status', async () => {
  try {
    // Verificar si Ollama está en ejecución
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      updateServiceStatus(true, 'ollama', true);
    } else {
      updateServiceStatus(true, 'ollama', false);
    }
  } catch (error) {
    updateServiceStatus(false, 'ollama', false);
  }
});

// --- Eventos para el visor de logs ---
ipcMain.on('open-logs-window', () => {
  // Si la ventana ya existe, mostrarla
  if (logsWindow) {
    logsWindow.show();
    logsWindow.focus();
    return;
  }

  // Crear nueva ventana de logs
  createLogsWindow();
});

ipcMain.on('close-logs-window', () => {
  if (logsWindow) {
    logsWindow.close();
  }
});

// --- Eventos para el visor de reportes ---
ipcMain.on('open-reports-window', () => {
  // Si la ventana ya existe, mostrarla
  if (reportsWindow) {
    reportsWindow.show();
    reportsWindow.focus();
    return;
  }

  // Crear nueva ventana de reportes
  createReportsWindow();
});

ipcMain.on('close-reports-window', () => {
  if (reportsWindow) {
    reportsWindow.close();
  }
});

// --- Eventos para el centro de notificaciones ---
ipcMain.on('open-notifications-window', () => {
  // Si la ventana ya existe, mostrarla
  if (notificationsWindow) {
    notificationsWindow.show();
    notificationsWindow.focus();
    return;
  }

  // Crear nueva ventana de notificaciones
  createNotificationsWindow();
});

ipcMain.on('close-notifications-window', () => {
  if (notificationsWindow) {
    notificationsWindow.close();
  }
});

ipcMain.on('get-notifications', async (event, filters) => {
  try {
    // Verificar si el gestor de notificaciones está disponible
    if (!notificationManager) {
      if (notificationsWindow) {
        notificationsWindow.webContents.send('notifications-data', []);
      }
      return;
    }

    // Obtener notificaciones
    const notifications = notificationManager.getNotificationHistory(filters);

    // Enviar notificaciones a la ventana
    if (notificationsWindow) {
      notificationsWindow.webContents.send('notifications-data', notifications);
    }
  } catch (error) {
    log.error(`Error al obtener notificaciones: ${error.message}`);

    if (notificationsWindow) {
      notificationsWindow.webContents.send('notifications-data', []);
    }
  }
});

ipcMain.on('mark-notification-read', (event, notificationId) => {
  try {
    // Verificar si el gestor de notificaciones está disponible
    if (!notificationManager) return;

    // Marcar notificación como leída
    notificationManager.markAsRead(notificationId);
  } catch (error) {
    log.error(`Error al marcar notificación como leída: ${error.message}`);
  }
});

ipcMain.on('mark-all-notifications-read', () => {
  try {
    // Verificar si el gestor de notificaciones está disponible
    if (!notificationManager) return;

    // Marcar todas las notificaciones como leídas
    notificationManager.markAllAsRead();
  } catch (error) {
    log.error(`Error al marcar todas las notificaciones como leídas: ${error.message}`);
  }
});

ipcMain.on('get-notification-config', (event) => {
  try {
    // Verificar si el gestor de notificaciones está disponible
    if (!notificationManager) {
      if (notificationsWindow) {
        notificationsWindow.webContents.send('notification-config', {
          enableSounds: true,
          enableDesktopNotifications: true,
          soundVolume: 0.8,
          defaultSound: 'alert.mp3'
        });
      }
      return;
    }

    // Obtener configuración
    const config = notificationManager.getConfig ? notificationManager.getConfig() : {
      enableSounds: true,
      enableDesktopNotifications: true,
      soundVolume: 0.8,
      defaultSound: 'alert.mp3'
    };

    // Enviar configuración a la ventana
    if (notificationsWindow) {
      notificationsWindow.webContents.send('notification-config', config);
    }
  } catch (error) {
    log.error(`Error al obtener configuración de notificaciones: ${error.message}`);
  }
});

ipcMain.on('update-notification-config', (event, config) => {
  try {
    // Verificar si el gestor de notificaciones está disponible
    if (!notificationManager) return;

    // Actualizar configuración
    notificationManager.updateConfig(config);
  } catch (error) {
    log.error(`Error al actualizar configuración de notificaciones: ${error.message}`);
  }
});

ipcMain.on('notification-action', (event, data) => {
  try {
    const { actionId, notification } = data;

    // Manejar acción según su ID
    if (actionId === 'view') {
      // Abrir conversación
      log.info(`Abriendo conversación con ${notification.chatId}`);
      // Aquí iría la lógica para abrir la conversación
    } else if (actionId === 'respond') {
      // Responder al cliente
      log.info(`Respondiendo a ${notification.chatId}`);
      // Aquí iría la lógica para responder al cliente
    }
  } catch (error) {
    log.error(`Error al manejar acción de notificación: ${error.message}`);
  }
});

ipcMain.on('test-notification', () => {
  try {
    // Verificar si el gestor de notificaciones está disponible
    if (!notificationManager) return;

    // Enviar notificación de prueba
    notificationManager.sendNotification({
      title: 'Notificación de prueba',
      body: 'Esta es una notificación de prueba para verificar que el sistema funciona correctamente.',
      priority: 'medium',
      requiresHumanAttention: false,
      actions: [
        {
          id: 'dismiss',
          label: 'Descartar'
        }
      ]
    });
  } catch (error) {
    log.error(`Error al enviar notificación de prueba: ${error.message}`);
  }
});

// --- Eventos para la gestión de backups ---
ipcMain.on('open-backups-window', () => {
  // Si la ventana ya existe, mostrarla
  if (backupsWindow) {
    backupsWindow.show();
    backupsWindow.focus();
    return;
  }

  // Crear nueva ventana de backups
  createBackupsWindow();
});

ipcMain.on('close-backups-window', () => {
  if (backupsWindow) {
    backupsWindow.close();
  }
});

ipcMain.on('get-backups', async () => {
  try {
    // Verificar si el gestor de backups está disponible
    if (!backupManager) {
      if (backupsWindow) {
        backupsWindow.webContents.send('backups-list', []);
      }
      return;
    }

    // Obtener lista de backups
    const backups = await backupManager.getBackupsList();

    // Enviar lista a la ventana
    if (backupsWindow) {
      backupsWindow.webContents.send('backups-list', backups);
    }
  } catch (error) {
    log.error(`Error al obtener lista de backups: ${error.message}`);

    if (backupsWindow) {
      backupsWindow.webContents.send('backups-list', []);
    }
  }
});

ipcMain.on('get-backup-config', () => {
  try {
    // Verificar si el gestor de backups está disponible
    if (!backupManager) {
      if (backupsWindow) {
        backupsWindow.webContents.send('backup-config', {
          enabled: true,
          interval: 24,
          maxBackups: 10,
          backupOnStart: true,
          backupOnExit: true,
          includeAttachments: true,
          compressionLevel: 9
        });
      }
      return;
    }

    // Obtener configuración
    const config = backupManager.getConfig ? backupManager.getConfig() : {
      enabled: true,
      interval: 24,
      maxBackups: 10,
      backupOnStart: true,
      backupOnExit: true,
      includeAttachments: true,
      compressionLevel: 9
    };

    // Enviar configuración a la ventana
    if (backupsWindow) {
      backupsWindow.webContents.send('backup-config', config);
    }
  } catch (error) {
    log.error(`Error al obtener configuración de backups: ${error.message}`);
  }
});

ipcMain.on('update-backup-config', async (event, config) => {
  try {
    // Verificar si el gestor de backups está disponible
    if (!backupManager) return;

    // Actualizar configuración
    await backupManager.updateConfig(config);

    log.info('Configuración de backups actualizada correctamente');
  } catch (error) {
    log.error(`Error al actualizar configuración de backups: ${error.message}`);
  }
});

ipcMain.on('create-backup', async (event, description) => {
  try {
    // Verificar si el gestor de backups está disponible
    if (!backupManager) {
      if (backupsWindow) {
        backupsWindow.webContents.send('backup-operation-result', {
          success: false,
          message: 'Gestor de backups no disponible'
        });
      }
      return;
    }

    // Crear backup
    await backupManager.createBackup(description);

    // Enviar resultado a la ventana
    if (backupsWindow) {
      backupsWindow.webContents.send('backup-operation-result', {
        success: true,
        message: 'Backup creado correctamente'
      });
    }

    log.info(`Backup creado correctamente: ${description}`);
  } catch (error) {
    log.error(`Error al crear backup: ${error.message}`);

    if (backupsWindow) {
      backupsWindow.webContents.send('backup-operation-result', {
        success: false,
        message: `Error al crear backup: ${error.message}`
      });
    }
  }
});

ipcMain.on('restore-backup', async (event, backupPath) => {
  try {
    // Verificar si el gestor de backups está disponible
    if (!backupManager) {
      if (backupsWindow) {
        backupsWindow.webContents.send('backup-operation-result', {
          success: false,
          message: 'Gestor de backups no disponible'
        });
      }
      return;
    }

    // Restaurar backup
    const result = await backupManager.restoreBackup(backupPath);

    // Enviar resultado a la ventana
    if (backupsWindow) {
      backupsWindow.webContents.send('backup-operation-result', {
        success: result,
        message: result ? 'Backup restaurado correctamente. La aplicación se reiniciará.' : 'Error al restaurar backup'
      });
    }

    if (result) {
      log.info(`Backup restaurado correctamente: ${backupPath}`);

      // Reiniciar aplicación
      setTimeout(() => {
        app.relaunch();
        app.exit();
      }, 3000);
    }
  } catch (error) {
    log.error(`Error al restaurar backup: ${error.message}`);

    if (backupsWindow) {
      backupsWindow.webContents.send('backup-operation-result', {
        success: false,
        message: `Error al restaurar backup: ${error.message}`
      });
    }
  }
});

ipcMain.on('delete-backup', async (event, backupPath) => {
  try {
    // Verificar si el gestor de backups está disponible
    if (!backupManager) {
      if (backupsWindow) {
        backupsWindow.webContents.send('backup-operation-result', {
          success: false,
          message: 'Gestor de backups no disponible'
        });
      }
      return;
    }

    // Eliminar backup
    const result = await backupManager.deleteBackup(backupPath);

    // Enviar resultado a la ventana
    if (backupsWindow) {
      backupsWindow.webContents.send('backup-operation-result', {
        success: result,
        message: result ? 'Backup eliminado correctamente' : 'Error al eliminar backup'
      });
    }

    if (result) {
      log.info(`Backup eliminado correctamente: ${backupPath}`);
    }
  } catch (error) {
    log.error(`Error al eliminar backup: ${error.message}`);

    if (backupsWindow) {
      backupsWindow.webContents.send('backup-operation-result', {
        success: false,
        message: `Error al eliminar backup: ${error.message}`
      });
    }
  }
});

ipcMain.on('download-backup', async (event, backupPath) => {
  try {
    // Mostrar diálogo para guardar archivo
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Guardar backup',
      defaultPath: path.join(app.getPath('documents'), path.basename(backupPath)),
      filters: [
        { name: 'Archivos ZIP', extensions: ['zip'] }
      ]
    });

    if (canceled || !filePath) return;

    // Copiar archivo
    await fs.promises.copyFile(backupPath, filePath);

    // Enviar resultado a la ventana
    if (backupsWindow) {
      backupsWindow.webContents.send('backup-operation-result', {
        success: true,
        message: 'Backup descargado correctamente'
      });
    }

    log.info(`Backup descargado correctamente: ${backupPath} -> ${filePath}`);
  } catch (error) {
    log.error(`Error al descargar backup: ${error.message}`);

    if (backupsWindow) {
      backupsWindow.webContents.send('backup-operation-result', {
        success: false,
        message: `Error al descargar backup: ${error.message}`
      });
    }
  }
});

// --- Eventos para la configuración de CRM ---
ipcMain.on('open-crm-settings-window', () => {
  // Si la ventana ya existe, mostrarla
  if (crmSettingsWindow) {
    crmSettingsWindow.show();
    crmSettingsWindow.focus();
    return;
  }

  // Crear nueva ventana de configuración de CRM
  createCrmSettingsWindow();
});

ipcMain.on('close-crm-settings-window', () => {
  if (crmSettingsWindow) {
    crmSettingsWindow.close();
  }
});

ipcMain.on('get-crm-config', async (event) => {
  try {
    // Verificar si el gestor de CRM está disponible
    if (!crmManager) {
      if (crmSettingsWindow) {
        crmSettingsWindow.webContents.send('crm-config', {
          activeCrm: 'googleSheets',
          googleSheets: {
            docId: '',
            sheetIndex: 0,
            credentials: null
          },
          // Solo Google Sheets como CRM,
          syncInterval: 5,
          autoSync: true,
          syncOnStart: true,
          status: {
            googleSheets: { connected: false, message: 'No inicializado' },
            // Solo Google Sheets como CRM
          }
        });
      }
      return;
    }

    // Obtener configuración
    const config = await crmManager.getConfig();

    // Obtener estado de conexión
    const status = await crmManager.getCrmStatus();

    // Enviar configuración a la ventana
    if (crmSettingsWindow) {
      crmSettingsWindow.webContents.send('crm-config', {
        ...config,
        status
      });
    }
  } catch (error) {
    log.error(`Error al obtener configuración de CRM: ${error.message}`);

    if (crmSettingsWindow) {
      crmSettingsWindow.webContents.send('crm-config', {
        activeCrm: 'googleSheets',
        googleSheets: {
          docId: '',
          sheetIndex: 0,
          credentials: null
        },
        // Solo Google Sheets como CRM
        syncInterval: 5,
        autoSync: true,
        syncOnStart: true,
        status: {
          googleSheets: { connected: false, message: `Error: ${error.message}` },
          // Solo Google Sheets como CRM
        }
      });
    }
  }
});

ipcMain.on('save-crm-config', async (event, config) => {
  try {
    // Verificar si el gestor de CRM está disponible
    if (!crmManager) {
      if (crmSettingsWindow) {
        crmSettingsWindow.webContents.send('save-crm-config-result', {
          success: false,
          message: 'Gestor de CRM no disponible'
        });
      }
      return;
    }

    // Guardar configuración
    const result = await crmManager.updateConfig(config);

    // Obtener configuración actualizada
    const updatedConfig = await crmManager.getConfig();

    // Obtener estado de conexión
    const status = await crmManager.getCrmStatus();

    // Enviar resultado a la ventana
    if (crmSettingsWindow) {
      crmSettingsWindow.webContents.send('save-crm-config-result', {
        success: result,
        message: result ? 'Configuración guardada correctamente' : 'Error al guardar configuración',
        config: {
          ...updatedConfig,
          status
        }
      });
    }
  } catch (error) {
    log.error(`Error al guardar configuración de CRM: ${error.message}`);

    if (crmSettingsWindow) {
      crmSettingsWindow.webContents.send('save-crm-config-result', {
        success: false,
        message: `Error al guardar configuración: ${error.message}`
      });
    }
  }
});

ipcMain.on('test-crm-connection', async (event) => {
  try {
    // Verificar si el gestor de CRM está disponible
    if (!crmManager) {
      if (crmSettingsWindow) {
        crmSettingsWindow.webContents.send('test-crm-connection-result', {
          success: false,
          message: 'Gestor de CRM no disponible',
          status: {
            googleSheets: { connected: false, message: 'No inicializado' },
            // Solo Google Sheets como CRM
          }
        });
      }
      return;
    }

    // Probar conexión
    const result = await crmManager.testConnection();

    // Obtener estado de conexión
    const status = await crmManager.getCrmStatus();

    // Enviar resultado a la ventana
    if (crmSettingsWindow) {
      crmSettingsWindow.webContents.send('test-crm-connection-result', {
        success: result.success,
        message: result.message,
        status
      });
    }
  } catch (error) {
    log.error(`Error al probar conexión con CRM: ${error.message}`);

    if (crmSettingsWindow) {
      crmSettingsWindow.webContents.send('test-crm-connection-result', {
        success: false,
        message: `Error al probar conexión: ${error.message}`,
        status: {
          googleSheets: { connected: false, message: `Error: ${error.message}` },
          // Solo Google Sheets como CRM
        }
      });
    }
  }
});

ipcMain.on('get-logs', async (event, filters) => {
  try {
    // Obtener logs del archivo
    const logs = await getLogs(filters);

    // Enviar logs a la ventana
    if (logsWindow) {
      logsWindow.webContents.send('logs-data', logs);
    }
  } catch (error) {
    log.error(`Error al obtener logs: ${error.message}`);

    if (logsWindow) {
      logsWindow.webContents.send('logs-data', []);
    }
  }
});

ipcMain.on('export-logs', async (event, data) => {
  try {
    // Mostrar diálogo para guardar archivo
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar Logs',
      defaultPath: path.join(app.getPath('documents'), 'whatsapp-assistant-logs.csv'),
      filters: [
        { name: 'CSV', extensions: ['csv'] },
        { name: 'Texto', extensions: ['txt'] }
      ]
    });

    if (canceled || !filePath) return;

    // Exportar logs
    await exportLogsToFile(data.logs, filePath);

    // Mostrar mensaje de éxito
    dialog.showMessageBox({
      type: 'info',
      title: 'Exportación Completada',
      message: 'Los logs se han exportado correctamente.',
      buttons: ['OK']
    });
  } catch (error) {
    log.error(`Error al exportar logs: ${error.message}`);

    dialog.showErrorBox(
      'Error al exportar logs',
      `No se pudieron exportar los logs: ${error.message}`
    );
  }
});

// --- Eventos para reportes ---
ipcMain.on('generate-report', async (event, filters) => {
  try {
    // Generar reporte
    const reportData = await generateReport(filters);

    // Enviar datos a la ventana
    if (reportsWindow) {
      reportsWindow.webContents.send('report-data', reportData);
    }
  } catch (error) {
    log.error(`Error al generar reporte: ${error.message}`);

    if (reportsWindow) {
      reportsWindow.webContents.send('report-data', {
        stats: {},
        charts: {},
        details: [],
        summary: `Error al generar reporte: ${error.message}`
      });
    }
  }
});

ipcMain.on('export-report', async (event, filters) => {
  try {
    // Mostrar diálogo para guardar archivo
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Exportar Reporte',
      defaultPath: path.join(app.getPath('documents'), 'whatsapp-assistant-report.xlsx'),
      filters: [
        { name: 'Excel', extensions: ['xlsx'] },
        { name: 'CSV', extensions: ['csv'] }
      ]
    });

    if (canceled || !filePath) return;

    // Generar reporte
    const reportData = await generateReport(filters);

    // Exportar reporte
    await exportReportToFile(reportData, filePath);

    // Mostrar mensaje de éxito
    dialog.showMessageBox({
      type: 'info',
      title: 'Exportación Completada',
      message: 'El reporte se ha exportado correctamente.',
      buttons: ['OK']
    });
  } catch (error) {
    log.error(`Error al exportar reporte: ${error.message}`);

    dialog.showErrorBox(
      'Error al exportar reporte',
      `No se pudo exportar el reporte: ${error.message}`
    );
  }
});

// Función para obtener logs del archivo
async function getLogs(filters = {}) {
  try {
    // Ruta al archivo de logs
    const logFilePath = log.transports.file.getFile().path;

    // Verificar si el archivo existe
    try {
      await fs.promises.access(logFilePath);
    } catch (error) {
      return [];
    }

    // Leer archivo de logs
    const content = await fs.promises.readFile(logFilePath, 'utf8');

    // Parsear logs
    const logs = [];
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        // Formato esperado: [TIMESTAMP] [LEVEL] mensaje
        const match = line.match(/\[(.*?)\]\s+\[(.*?)\]\s+(.*)/);

        if (match) {
          const timestamp = match[1];
          const level = match[2].toLowerCase();
          const message = match[3];

          // Filtrar por fecha si se especifica
          if (filters.startDate || filters.endDate) {
            const logDate = new Date(timestamp);

            if (filters.startDate) {
              const startDate = new Date(filters.startDate);
              startDate.setHours(0, 0, 0, 0);

              if (logDate < startDate) continue;
            }

            if (filters.endDate) {
              const endDate = new Date(filters.endDate);
              endDate.setHours(23, 59, 59, 999);

              if (logDate > endDate) continue;
            }
          }

          logs.push({
            timestamp,
            level,
            message
          });
        }
      } catch (error) {
        // Ignorar líneas que no se pueden parsear
      }
    }

    return logs;
  } catch (error) {
    log.error(`Error al obtener logs: ${error.message}`);
    return [];
  }
}

// Función para generar reportes
async function generateReport(filters = {}) {
  try {
    // Obtener datos de la base de datos
    const dbPath = path.join(app.getAppPath(), 'database.sqlite');

    // Verificar si la base de datos existe
    try {
      await fs.promises.access(dbPath);
    } catch (error) {
      return {
        stats: {},
        charts: {},
        details: [],
        summary: 'No se encontró la base de datos.'
      };
    }

    // Conectar a la base de datos
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(dbPath);

    // Convertir a promesas
    const dbAll = (query, params = []) => {
      return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };

    // Preparar filtros de fecha
    let dateFilter = '';
    const dateParams = [];

    if (filters.startDate) {
      dateFilter += ' AND timestamp >= ?';
      dateParams.push(new Date(filters.startDate).toISOString());
    }

    if (filters.endDate) {
      dateFilter += ' AND timestamp <= ?';
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      dateParams.push(endDate.toISOString());
    }

    // Obtener estadísticas generales
    const stats = {};

    // Total de conversaciones (chats únicos)
    const conversationsQuery = `
      SELECT COUNT(DISTINCT chat_id) as count
      FROM messages
      WHERE 1=1 ${dateFilter}
    `;
    const conversationsResult = await dbAll(conversationsQuery, dateParams);
    stats.totalConversations = conversationsResult[0]?.count || 0;

    // Total de mensajes
    const messagesQuery = `
      SELECT COUNT(*) as count
      FROM messages
      WHERE 1=1 ${dateFilter}
    `;
    const messagesResult = await dbAll(messagesQuery, dateParams);
    stats.totalMessages = messagesResult[0]?.count || 0;

    // Total de clientes
    const clientsQuery = `
      SELECT COUNT(*) as count
      FROM clients
      WHERE 1=1 ${dateFilter}
    `;
    const clientsResult = await dbAll(clientsQuery, dateParams);
    stats.totalClients = clientsResult[0]?.count || 0;

    // Análisis de sentimiento
    // Nota: Esto es una aproximación, ya que no tenemos sentimiento almacenado directamente
    stats.sentimentPositive = 70; // Valor de ejemplo
    stats.sentimentNeutral = 20;  // Valor de ejemplo
    stats.sentimentNegative = 10; // Valor de ejemplo

    // Preparar datos para gráficos
    const charts = {};

    // Obtener fechas para el rango
    const startDate = filters.startDate ? new Date(filters.startDate) : new Date();
    startDate.setDate(startDate.getDate() - 30); // Por defecto, 30 días atrás

    const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
    endDate.setHours(23, 59, 59, 999);

    // Generar array de fechas
    const dateLabels = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dateLabels.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Mensajes por día
    const messagesByDayQuery = `
      SELECT
        date(timestamp) as day,
        COUNT(*) as count,
        role
      FROM messages
      WHERE 1=1 ${dateFilter}
      GROUP BY day, role
      ORDER BY day
    `;
    const messagesByDayResult = await dbAll(messagesByDayQuery, dateParams);

    // Preparar datos para gráfico de mensajes
    const messagesReceived = Array(dateLabels.length).fill(0);
    const messagesSent = Array(dateLabels.length).fill(0);

    messagesByDayResult.forEach(row => {
      const index = dateLabels.indexOf(row.day);
      if (index !== -1) {
        if (row.role === 'user') {
          messagesReceived[index] = row.count;
        } else {
          messagesSent[index] = row.count;
        }
      }
    });

    charts.daily = {
      labels: dateLabels,
      messages: messagesReceived.map((val, i) => val + messagesSent[i])
    };

    charts.messages = {
      labels: dateLabels,
      received: messagesReceived,
      sent: messagesSent
    };

    // Clientes nuevos por día
    const clientsByDayQuery = `
      SELECT
        date(timestamp) as day,
        COUNT(*) as count
      FROM clients
      WHERE 1=1 ${dateFilter}
      GROUP BY day
      ORDER BY day
    `;
    const clientsByDayResult = await dbAll(clientsByDayQuery, dateParams);

    // Preparar datos para gráfico de clientes
    const newClients = Array(dateLabels.length).fill(0);

    clientsByDayResult.forEach(row => {
      const index = dateLabels.indexOf(row.day);
      if (index !== -1) {
        newClients[index] = row.count;
      }
    });

    charts.clients = {
      labels: dateLabels,
      new: newClients
    };

    // Datos de sentimiento (ejemplo)
    charts.sentiment = {
      positive: stats.sentimentPositive,
      neutral: stats.sentimentNeutral,
      negative: stats.sentimentNegative
    };

    // Detalles por conversación
    const detailsQuery = `
      SELECT
        c.chat_id,
        c.nombre as client_name,
        COUNT(m.id) as message_count,
        c.correo,
        c.telefono,
        c.curso,
        c.pago,
        MAX(m.timestamp) as last_message
      FROM clients c
      LEFT JOIN messages m ON c.chat_id = m.chat_id
      WHERE 1=1 ${dateFilter}
      GROUP BY c.chat_id
      ORDER BY last_message DESC
      LIMIT 100
    `;
    const detailsResult = await dbAll(detailsQuery, dateParams);

    // Preparar detalles
    const details = detailsResult.map(row => ({
      client: row.client_name || 'Desconocido',
      messages: row.message_count || 0,
      date: row.last_message,
      sentiment: Math.random() * 2 - 1, // Valor aleatorio entre -1 y 1 (ejemplo)
      data: {
        nombre: row.client_name,
        correo: row.correo,
        telefono: row.telefono,
        curso: row.curso,
        pago: row.pago
      }
    }));

    // Generar resumen
    const summary = `En el período seleccionado, se han registrado ${stats.totalConversations} conversaciones con ${stats.totalMessages} mensajes. Se han recopilado datos de ${stats.totalClients} clientes. El sentimiento general ha sido ${stats.sentimentPositive > 50 ? 'positivo' : 'neutral'}.`;

    // Cerrar base de datos
    db.close();

    return {
      stats,
      charts,
      details,
      summary
    };
  } catch (error) {
    log.error(`Error al generar reporte: ${error.message}`);
    throw error;
  }
}

// Función para exportar reportes a un archivo
async function exportReportToFile(reportData, filePath) {
  try {
    // Determinar formato de exportación según extensión
    const isExcel = filePath.toLowerCase().endsWith('.xlsx');

    if (isExcel) {
      // Exportar a Excel (requiere instalar módulo adicional)
      // Aquí se usaría una librería como ExcelJS
      throw new Error('Exportación a Excel no implementada aún.');
    } else {
      // Exportar a CSV
      let content = '';

      // Cabecera CSV
      content = 'Fecha,Cliente,Mensajes,Sentimiento,Datos Recolectados\n';

      // Contenido CSV
      for (const item of reportData.details) {
        // Formatear fecha
        const date = new Date(item.date).toLocaleDateString();

        // Formatear sentimiento
        let sentimentText = 'Neutral';
        if (item.sentiment > 0.2) sentimentText = 'Positivo';
        else if (item.sentiment < -0.2) sentimentText = 'Negativo';

        // Formatear datos recolectados
        const collectedData = [];
        if (item.data) {
          if (item.data.nombre) collectedData.push('Nombre');
          if (item.data.correo) collectedData.push('Correo');
          if (item.data.telefono) collectedData.push('Teléfono');
          if (item.data.curso) collectedData.push('Curso');
          if (item.data.pago) collectedData.push('Pago');
        }

        // Escapar comillas en los campos
        const clientName = (item.client || 'Desconocido').replace(/"/g, '""');

        content += `"${date}","${clientName}","${item.messages}","${sentimentText}","${collectedData.join(', ')}"\n`;
      }

      // Guardar archivo
      await fs.promises.writeFile(filePath, content, 'utf8');
    }

    return true;
  } catch (error) {
    log.error(`Error al exportar reporte: ${error.message}`);
    throw error;
  }
}

// Función para exportar logs a un archivo
async function exportLogsToFile(logs, filePath) {
  try {
    // Determinar formato de exportación según extensión
    const isCSV = filePath.toLowerCase().endsWith('.csv');

    let content = '';

    if (isCSV) {
      // Cabecera CSV
      content = 'Fecha,Nivel,Mensaje\n';

      // Contenido CSV
      for (const log of logs) {
        // Escapar comillas en el mensaje
        const escapedMessage = log.message.replace(/"/g, '""');

        content += `"${log.timestamp}","${log.level}","${escapedMessage}"\n`;
      }
    } else {
      // Formato de texto plano
      for (const log of logs) {
        content += `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}\n`;
      }
    }

    // Guardar archivo
    await fs.promises.writeFile(filePath, content, 'utf8');

    return true;
  } catch (error) {
    log.error(`Error al exportar logs: ${error.message}`);
    throw error;
  }
}

log.info('Archivo main.js cargado.');

// --- Eventos para la autenticación ---

// Evento para verificar código OTP
ipcMain.on('verify-otp', (event, token) => {
  if (!authManager) {
    event.reply('verify-otp-result', {
      success: false,
      message: 'Gestor de autenticación no disponible'
    });
    return;
  }

  const isValid = authManager.authenticate(token);

  if (isValid) {
    log.info('Autenticación exitosa');

    // Generar códigos de recuperación si no existen
    if (!authManager.getStatus().backupCodes || authManager.getStatus().backupCodes.length === 0) {
      authManager.generateRecoveryCodes().then(codes => {
        log.info(`Generados ${codes.length} códigos de recuperación`);

        // Mostrar códigos al usuario
        dialog.showMessageBox(loginWindow, {
          type: 'info',
          title: 'Códigos de recuperación',
          message: 'Guarda estos códigos de recuperación en un lugar seguro. Los necesitarás si pierdes acceso a Google Authenticator.',
          detail: codes.join('\n'),
          buttons: ['Copiar al portapapeles', 'Entendido'],
          defaultId: 1,
          cancelId: 1
        }).then(result => {
          if (result.response === 0) {
            // Copiar al portapapeles
            require('electron').clipboard.writeText(codes.join('\n'));
          }
        });
      });
    }

    // Cerrar ventana de login
    if (loginWindow) {
      loginWindow.close();
    }

    // Crear ventana principal
    createWindow();
    createTray();

    event.reply('verify-otp-result', {
      success: true,
      message: 'Autenticación exitosa'
    });
  } else {
    log.warn('Autenticación fallida');

    event.reply('verify-otp-result', {
      success: false,
      message: 'Código OTP inválido'
    });
  }
});

// Evento para activar licencia
ipcMain.on('activate-license', async (event, licenseKey) => {
  if (!authManager) {
    event.reply('activate-license-result', {
      success: false,
      message: 'Gestor de autenticación no disponible'
    });
    return;
  }

  const result = await authManager.activateLicense(licenseKey);

  if (result) {
    log.info('Licencia activada correctamente');

    event.reply('activate-license-result', {
      success: true,
      message: 'Licencia activada correctamente',
      status: authManager.getStatus()
    });
  } else {
    log.warn('Error al activar licencia');

    event.reply('activate-license-result', {
      success: false,
      message: 'Error al activar licencia',
      status: authManager.getStatus()
    });
  }
});

// Evento para generar licencia (solo para desarrollo)
ipcMain.on('generate-license', (event, expiryDays) => {
  if (!authManager) {
    event.reply('generate-license-result', {
      success: false,
      message: 'Gestor de autenticación no disponible'
    });
    return;
  }

  const licenseKey = authManager.generateLicenseKey(expiryDays);

  event.reply('generate-license-result', {
    success: true,
    licenseKey
  });
});

// Evento para verificar estado de autenticación
ipcMain.on('check-auth-status', (event) => {
  if (!authManager) {
    event.reply('auth-status', {
      authenticated: false,
      license: {
        status: 'inactive',
        expiry: null
      }
    });
    return;
  }

  event.reply('auth-status', authManager.getStatus());
});

// Evento para cerrar sesión
ipcMain.on('logout', (event) => {
  if (!authManager) {
    return;
  }

  authManager.logout();

  // Cerrar ventana principal
  if (mainWindow) {
    mainWindow.close();
  }

  // Mostrar ventana de login
  createLoginWindow();
});

// Evento para verificar código de recuperación
ipcMain.on('verify-recovery-code', async (event, code) => {
  if (!authManager) {
    event.reply('verify-recovery-code-result', {
      success: false,
      message: 'Gestor de autenticación no disponible'
    });
    return;
  }

  const isValid = await authManager.verifyRecoveryCode(code);

  if (isValid) {
    log.info('Código de recuperación verificado correctamente');

    // Contar códigos restantes
    const status = authManager.getStatus();
    const remainingCodes = status.backupCodes ? status.backupCodes.filter(c => !c.used).length : 0;

    // Cerrar ventana de login
    if (loginWindow) {
      loginWindow.close();
    }

    // Crear ventana principal
    createWindow();
    createTray();

    event.reply('verify-recovery-code-result', {
      success: true,
      message: 'Código de recuperación verificado correctamente',
      remainingCodes
    });
  } else {
    log.warn('Verificación de código de recuperación fallida');

    event.reply('verify-recovery-code-result', {
      success: false,
      message: 'Código de recuperación inválido o ya utilizado'
    });
  }
});

// Evento para recuperar licencia
ipcMain.on('recover-license', async (event, userName) => {
  if (!authManager) {
    event.reply('recover-license-result', {
      success: false,
      message: 'Gestor de autenticación no disponible'
    });
    return;
  }

  const result = await authManager.recoverLicense(userName);

  if (result) {
    log.info('Licencia recuperada correctamente');

    event.reply('recover-license-result', {
      success: true,
      message: 'Licencia recuperada correctamente',
      status: authManager.getStatus()
    });
  } else {
    log.warn('Recuperación de licencia fallida');

    event.reply('recover-license-result', {
      success: false,
      message: 'No se pudo recuperar la licencia. Verifica tu nombre de usuario o contacta con soporte.'
    });
  }
});

// Evento para revocar licencia
ipcMain.on('revoke-license', async (event) => {
  if (!authManager) {
    return;
  }

  const result = await authManager.revokeLicense();

  if (result) {
    log.info('Licencia revocada correctamente');

    // Cerrar ventana principal
    if (mainWindow) {
      mainWindow.close();
    }

    // Mostrar ventana de login
    createLoginWindow();
  } else {
    log.warn('Error al revocar licencia');

    dialog.showMessageBox(mainWindow || null, {
      type: 'error',
      title: 'Error',
      message: 'Error al revocar licencia',
      detail: 'No se pudo revocar la licencia. Inténtalo de nuevo más tarde.'
    });
  }
});
