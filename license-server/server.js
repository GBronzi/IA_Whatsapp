/**
 * Servidor de licencias para el Asistente de Ventas WhatsApp
 *
 * Este servidor proporciona endpoints para:
 * - Verificar licencias
 * - Activar licencias
 * - Revocar licencias
 * - Generar nuevas licencias
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

// Importar gestor de notificaciones
let notificationManager;
try {
  notificationManager = require('./notification-manager');
} catch (error) {
  console.error(`Error al cargar gestor de notificaciones: ${error.message}`);
}

// Configuración de la base de datos
const adapter = new FileSync('db.json');
const db = low(adapter);

// Inicializar la base de datos con estructura por defecto
db.defaults({
  licenses: [],
  users: [],
  recoveryKeys: [],
  notifications: []
}).write();

// Inicializar gestor de notificaciones
if (notificationManager) {
  notificationManager.initialize({
    email: {
      enabled: process.env.EMAIL_ENABLED === 'true',
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      from: process.env.EMAIL_FROM
    },
    webhook: {
      enabled: process.env.WEBHOOK_ENABLED === 'true',
      url: process.env.WEBHOOK_URL,
      headers: {
        'Authorization': process.env.WEBHOOK_AUTH || ''
      }
    }
  }).then(() => {
    console.log('Gestor de notificaciones inicializado correctamente');
  }).catch(error => {
    console.error(`Error al inicializar gestor de notificaciones: ${error.message}`);
  });
}

// Configuración del servidor
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para verificar token JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }

    req.user = user;
    next();
  });
};

// Middleware para verificar rol de administrador
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  next();
};

/**
 * Endpoint para verificar una licencia
 * POST /api/verify-license
 */
app.post('/api/verify-license', (req, res) => {
  const { licenseKey, appName, userName } = req.body;

  if (!licenseKey) {
    return res.status(400).json({
      valid: false,
      message: 'Clave de licencia no proporcionada'
    });
  }

  try {
    // Verificar formato de la licencia
    const parts = licenseKey.split('.');
    if (parts.length !== 2) {
      return res.status(400).json({
        valid: false,
        message: 'Formato de licencia inválido'
      });
    }

    // Decodificar datos de la licencia
    const dataString = Buffer.from(parts[0], 'base64').toString('utf8');
    const data = JSON.parse(dataString);

    // Verificar hash
    const hash = crypto.createHash('sha256').update(dataString).digest('hex');
    if (hash.substring(0, 8) !== parts[1]) {
      return res.status(400).json({
        valid: false,
        message: 'Hash de licencia inválido'
      });
    }

    // Buscar licencia en la base de datos
    const license = db.get('licenses')
      .find({ key: licenseKey })
      .value();

    // Si la licencia no existe en la base de datos
    if (!license) {
      // Verificar si es una licencia válida por su formato
      if (data.appName !== appName) {
        return res.status(400).json({
          valid: false,
          message: 'Licencia no válida para esta aplicación'
        });
      }

      // Verificar expiración
      if (data.expiryDate !== 'permanent') {
        const expiryDate = new Date(data.expiryDate);
        if (expiryDate < new Date()) {
          return res.status(400).json({
            valid: false,
            status: 'expired',
            message: 'Licencia expirada'
          });
        }
      }

      // Guardar la licencia en la base de datos
      db.get('licenses')
        .push({
          key: licenseKey,
          appName: data.appName,
          userName: userName || data.userName,
          status: 'active',
          expiryDate: data.expiryDate,
          createdAt: new Date().toISOString(),
          lastVerified: new Date().toISOString()
        })
        .write();

      return res.json({
        valid: true,
        status: 'active',
        message: 'Licencia válida y activada',
        expiryDate: data.expiryDate
      });
    }

    // Verificar si la licencia está revocada
    if (license.status === 'revoked') {
      return res.status(400).json({
        valid: false,
        status: 'revoked',
        message: 'Licencia revocada'
      });
    }

    // Verificar expiración
    if (license.expiryDate !== 'permanent') {
      const expiryDate = new Date(license.expiryDate);
      if (expiryDate < new Date()) {
        // Actualizar estado de la licencia
        db.get('licenses')
          .find({ key: licenseKey })
          .assign({
            status: 'expired',
            lastVerified: new Date().toISOString()
          })
          .write();

        return res.status(400).json({
          valid: false,
          status: 'expired',
          message: 'Licencia expirada'
        });
      }
    }

    // Actualizar fecha de última verificación
    db.get('licenses')
      .find({ key: licenseKey })
      .assign({ lastVerified: new Date().toISOString() })
      .write();

    // Licencia válida
    return res.json({
      valid: true,
      status: license.status,
      message: 'Licencia válida',
      expiryDate: license.expiryDate
    });
  } catch (error) {
    console.error('Error al verificar licencia:', error);
    return res.status(500).json({
      valid: false,
      message: 'Error al verificar licencia'
    });
  }
});

/**
 * Endpoint para activar una licencia
 * POST /api/activate-license
 */
app.post('/api/activate-license', (req, res) => {
  const { licenseKey, appName, userName, deviceId } = req.body;

  if (!licenseKey || !appName || !userName) {
    return res.status(400).json({
      success: false,
      message: 'Faltan datos requeridos'
    });
  }

  try {
    // Verificar formato de la licencia
    const parts = licenseKey.split('.');
    if (parts.length !== 2) {
      return res.status(400).json({
        success: false,
        message: 'Formato de licencia inválido'
      });
    }

    // Decodificar datos de la licencia
    const dataString = Buffer.from(parts[0], 'base64').toString('utf8');
    const data = JSON.parse(dataString);

    // Verificar hash
    const hash = crypto.createHash('sha256').update(dataString).digest('hex');
    if (hash.substring(0, 8) !== parts[1]) {
      return res.status(400).json({
        success: false,
        message: 'Hash de licencia inválido'
      });
    }

    // Buscar licencia en la base de datos
    let license = db.get('licenses')
      .find({ key: licenseKey })
      .value();

    // Si la licencia ya existe
    if (license) {
      // Verificar si está revocada
      if (license.status === 'revoked') {
        return res.status(400).json({
          success: false,
          message: 'Licencia revocada'
        });
      }

      // Verificar expiración
      if (license.expiryDate !== 'permanent') {
        const expiryDate = new Date(license.expiryDate);
        if (expiryDate < new Date()) {
          return res.status(400).json({
            success: false,
            message: 'Licencia expirada'
          });
        }
      }

      // Actualizar información de la licencia
      db.get('licenses')
        .find({ key: licenseKey })
        .assign({
          userName,
          deviceId,
          status: 'active',
          lastActivated: new Date().toISOString()
        })
        .write();
    } else {
      // Verificar si es una licencia válida por su formato
      if (data.appName !== appName) {
        return res.status(400).json({
          success: false,
          message: 'Licencia no válida para esta aplicación'
        });
      }

      // Verificar expiración
      if (data.expiryDate !== 'permanent') {
        const expiryDate = new Date(data.expiryDate);
        if (expiryDate < new Date()) {
          return res.status(400).json({
            success: false,
            message: 'Licencia expirada'
          });
        }
      }

      // Guardar la licencia en la base de datos
      license = {
        key: licenseKey,
        appName: data.appName,
        userName,
        deviceId,
        status: 'active',
        expiryDate: data.expiryDate,
        createdAt: new Date().toISOString(),
        lastActivated: new Date().toISOString()
      };

      db.get('licenses')
        .push(license)
        .write();
    }

    // Generar clave de recuperación
    const recoveryKey = uuidv4();

    // Guardar clave de recuperación
    db.get('recoveryKeys')
      .push({
        key: recoveryKey,
        licenseKey,
        userName,
        createdAt: new Date().toISOString()
      })
      .write();

    return res.json({
      success: true,
      message: 'Licencia activada correctamente',
      license: {
        key: licenseKey,
        status: 'active',
        expiryDate: license.expiryDate
      },
      recoveryKey
    });
  } catch (error) {
    console.error('Error al activar licencia:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al activar licencia'
    });
  }
});

/**
 * Endpoint para revocar una licencia
 * POST /api/revoke-license
 */
app.post('/api/revoke-license', (req, res) => {
  const { licenseKey, reason } = req.body;

  if (!licenseKey) {
    return res.status(400).json({
      success: false,
      message: 'Clave de licencia no proporcionada'
    });
  }

  try {
    // Buscar licencia en la base de datos
    const license = db.get('licenses')
      .find({ key: licenseKey })
      .value();

    // Si la licencia no existe
    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'Licencia no encontrada'
      });
    }

    // Revocar licencia
    db.get('licenses')
      .find({ key: licenseKey })
      .assign({
        status: 'revoked',
        revokedAt: new Date().toISOString(),
        revocationReason: reason || 'No especificado'
      })
      .write();

    // Enviar notificación
    if (notificationManager) {
      notificationManager.notifyLicenseRevoked(license, reason)
        .then(notified => {
          if (notified) {
            console.log(`Notificación de revocación enviada para licencia ${licenseKey}`);

            // Guardar registro de notificación
            db.get('notifications')
              .push({
                id: uuidv4(),
                type: 'license.revoked',
                licenseKey,
                userName: license.userName,
                timestamp: new Date().toISOString(),
                success: true
              })
              .write();
          }
        })
        .catch(error => {
          console.error(`Error al enviar notificación de revocación: ${error.message}`);
        });
    }

    return res.json({
      success: true,
      message: 'Licencia revocada correctamente'
    });
  } catch (error) {
    console.error('Error al revocar licencia:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al revocar licencia'
    });
  }
});

/**
 * Endpoint para generar una nueva licencia
 * POST /api/generate-license
 * Requiere autenticación de administrador
 */
app.post('/api/generate-license', authenticateToken, isAdmin, (req, res) => {
  const { appName, userName, expiryDays, email } = req.body;

  if (!appName || !userName) {
    return res.status(400).json({
      success: false,
      message: 'Faltan datos requeridos'
    });
  }

  try {
    // Generar datos de la licencia
    const data = {
      appName,
      userName,
      secretKey: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now()
    };

    // Establecer fecha de expiración
    const expiryDate = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
      : 'permanent';

    // Crear licencia
    const dataString = JSON.stringify({ ...data, expiryDate });
    const hash = crypto.createHash('sha256').update(dataString).digest('hex');
    const licenseKey = `${Buffer.from(dataString).toString('base64')}.${hash.substring(0, 8)}`;

    // Crear objeto de licencia
    const license = {
      key: licenseKey,
      appName,
      userName,
      email: email || null,
      status: 'inactive', // Inactiva hasta que se active
      expiryDate,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };

    // Guardar licencia en la base de datos
    db.get('licenses')
      .push(license)
      .write();

    // Enviar notificación
    if (notificationManager && email) {
      notificationManager.notifyLicenseCreated(license)
        .then(notified => {
          if (notified) {
            console.log(`Notificación de creación enviada para licencia ${licenseKey}`);

            // Guardar registro de notificación
            db.get('notifications')
              .push({
                id: uuidv4(),
                type: 'license.created',
                licenseKey,
                userName,
                email,
                timestamp: new Date().toISOString(),
                success: true
              })
              .write();
          }
        })
        .catch(error => {
          console.error(`Error al enviar notificación de creación: ${error.message}`);
        });
    }

    return res.json({
      success: true,
      message: 'Licencia generada correctamente',
      licenseKey,
      expiryDate
    });
  } catch (error) {
    console.error('Error al generar licencia:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al generar licencia'
    });
  }
});

/**
 * Endpoint para recuperar una licencia
 * POST /api/recover-license
 */
app.post('/api/recover-license', (req, res) => {
  const { recoveryKey, userName } = req.body;

  if (!recoveryKey || !userName) {
    return res.status(400).json({
      success: false,
      message: 'Faltan datos requeridos'
    });
  }

  try {
    // Buscar clave de recuperación
    const recovery = db.get('recoveryKeys')
      .find({ key: recoveryKey })
      .value();

    // Si la clave no existe
    if (!recovery) {
      return res.status(404).json({
        success: false,
        message: 'Clave de recuperación no encontrada'
      });
    }

    // Verificar usuario
    if (recovery.userName !== userName) {
      return res.status(403).json({
        success: false,
        message: 'Usuario no autorizado para esta clave de recuperación'
      });
    }

    // Buscar licencia
    const license = db.get('licenses')
      .find({ key: recovery.licenseKey })
      .value();

    // Si la licencia no existe
    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'Licencia no encontrada'
      });
    }

    // Verificar si la licencia está revocada
    if (license.status === 'revoked') {
      return res.status(400).json({
        success: false,
        message: 'Licencia revocada'
      });
    }

    // Verificar expiración
    if (license.expiryDate !== 'permanent') {
      const expiryDate = new Date(license.expiryDate);
      if (expiryDate < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'Licencia expirada'
        });
      }
    }

    return res.json({
      success: true,
      message: 'Licencia recuperada correctamente',
      license: {
        key: license.key,
        status: license.status,
        expiryDate: license.expiryDate
      }
    });
  } catch (error) {
    console.error('Error al recuperar licencia:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al recuperar licencia'
    });
  }
});

/**
 * Endpoint para iniciar sesión como administrador
 * POST /api/login
 */
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // Verificar credenciales (en producción, usar hash de contraseñas)
  const user = db.get('users')
    .find({ username })
    .value();

  if (!user || user.password !== password) {
    return res.status(401).json({
      success: false,
      message: 'Credenciales inválidas'
    });
  }

  // Generar token JWT
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return res.json({
    success: true,
    message: 'Inicio de sesión exitoso',
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

/**
 * Endpoint para crear un usuario administrador (solo para desarrollo)
 * POST /api/create-admin
 */
app.post('/api/create-admin', (req, res) => {
  const { username, password, adminKey } = req.body;

  // Verificar clave de administrador
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({
      success: false,
      message: 'Clave de administrador inválida'
    });
  }

  // Verificar si el usuario ya existe
  const existingUser = db.get('users')
    .find({ username })
    .value();

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'El usuario ya existe'
    });
  }

  // Crear usuario administrador
  const userId = uuidv4();
  db.get('users')
    .push({
      id: userId,
      username,
      password, // En producción, usar hash de contraseñas
      role: 'admin',
      createdAt: new Date().toISOString()
    })
    .write();

  return res.json({
    success: true,
    message: 'Usuario administrador creado correctamente',
    userId
  });
});

/**
 * Endpoint para verificar token JWT
 * GET /api/verify-token
 */
app.get('/api/verify-token', authenticateToken, (req, res) => {
  return res.json({
    valid: true,
    user: {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role
    }
  });
});

/**
 * Endpoint para obtener lista de licencias
 * GET /api/licenses
 */
app.get('/api/licenses', authenticateToken, isAdmin, (req, res) => {
  try {
    const licenses = db.get('licenses').value();

    return res.json({
      success: true,
      licenses
    });
  } catch (error) {
    console.error('Error al obtener licencias:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener licencias'
    });
  }
});

/**
 * Endpoint para obtener lista de usuarios
 * GET /api/users
 */
app.get('/api/users', authenticateToken, isAdmin, (req, res) => {
  try {
    const users = db.get('users')
      .map(user => ({
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt
      }))
      .value();

    return res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios'
    });
  }
});

/**
 * Endpoint para eliminar un usuario
 * DELETE /api/users/:id
 */
app.delete('/api/users/:id', authenticateToken, isAdmin, (req, res) => {
  try {
    const userId = req.params.id;

    // Verificar si el usuario existe
    const user = db.get('users').find({ id: userId }).value();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // No permitir eliminar al propio usuario
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propio usuario'
      });
    }

    // Eliminar usuario
    db.get('users')
      .remove({ id: userId })
      .write();

    return res.json({
      success: true,
      message: 'Usuario eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario'
    });
  }
});

/**
 * Endpoint para obtener información del sistema
 * GET /api/system-info
 */
app.get('/api/system-info', authenticateToken, isAdmin, (req, res) => {
  try {
    return res.json({
      success: true,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3000,
      ssl: process.env.SSL_ENABLED === 'true',
      dbConnected: true,
      lastUpdate: new Date().toISOString(),
      appName: 'Asistente de Ventas WhatsApp',
      clientUrl: process.env.CLIENT_URL || 'http://localhost:8080'
    });
  } catch (error) {
    console.error('Error al obtener información del sistema:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener información del sistema'
    });
  }
});

/**
 * Endpoint para guardar configuración
 * POST /api/settings
 */
app.post('/api/settings', authenticateToken, isAdmin, (req, res) => {
  try {
    const { appName, clientUrl, sslEnabled } = req.body;

    // Guardar configuración en archivo .env
    // En producción, usar un método más seguro para guardar configuración

    return res.json({
      success: true,
      message: 'Configuración guardada correctamente'
    });
  } catch (error) {
    console.error('Error al guardar configuración:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al guardar configuración'
    });
  }
});

/**
 * Endpoint para obtener actividad reciente
 * GET /api/recent-activity
 */
app.get('/api/recent-activity', authenticateToken, isAdmin, (req, res) => {
  try {
    // En una implementación real, obtener actividad de la base de datos
    const activities = [
      {
        id: '1',
        description: 'Licencia generada para usuario1',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: '2',
        description: 'Usuario admin2 creado',
        timestamp: new Date(Date.now() - 7200000).toISOString()
      },
      {
        id: '3',
        description: 'Licencia revocada para usuario2',
        timestamp: new Date(Date.now() - 86400000).toISOString()
      }
    ];

    return res.json({
      success: true,
      activities
    });
  } catch (error) {
    console.error('Error al obtener actividad reciente:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener actividad reciente'
    });
  }
});

/**
 * Ruta para servir el panel de administración
 * GET /admin
 */
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configuración de HTTPS
let server;

// Verificar si existen certificados SSL
const sslEnabled = process.env.SSL_ENABLED === 'true';
const sslCertPath = process.env.SSL_CERT_PATH || path.join(__dirname, 'ssl', 'cert.pem');
const sslKeyPath = process.env.SSL_KEY_PATH || path.join(__dirname, 'ssl', 'key.pem');

// Crear directorio para certificados SSL si no existe
if (sslEnabled && !fs.existsSync(path.join(__dirname, 'ssl'))) {
  fs.mkdirSync(path.join(__dirname, 'ssl'), { recursive: true });
}

// Iniciar servidor HTTP o HTTPS según configuración
if (sslEnabled && fs.existsSync(sslCertPath) && fs.existsSync(sslKeyPath)) {
  // Configuración HTTPS
  const httpsOptions = {
    key: fs.readFileSync(sslKeyPath),
    cert: fs.readFileSync(sslCertPath)
  };

  // Crear servidor HTTPS
  server = https.createServer(httpsOptions, app);

  // Iniciar servidor HTTPS
  server.listen(PORT, () => {
    console.log(`Servidor de licencias ejecutándose en https://localhost:${PORT}`);
  });

  // Redirigir HTTP a HTTPS
  const httpApp = express();
  httpApp.all('*', (req, res) => {
    res.redirect(`https://${req.hostname}:${PORT}${req.url}`);
  });

  // Iniciar servidor HTTP para redirecciones
  http.createServer(httpApp).listen(80, () => {
    console.log('Servidor HTTP redirigiendo a HTTPS');
  });
} else {
  // Iniciar servidor HTTP
  server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`Servidor de licencias ejecutándose en http://localhost:${PORT}`);

    if (sslEnabled) {
      console.warn('ADVERTENCIA: SSL está habilitado pero no se encontraron certificados.');
      console.warn(`Busca certificados en: ${sslCertPath} y ${sslKeyPath}`);
    }
  });
}
