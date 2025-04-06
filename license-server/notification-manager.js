/**
 * Gestor de notificaciones para el servidor de licencias
 * 
 * Este módulo proporciona funciones para enviar notificaciones
 * sobre eventos importantes como revocaciones de licencias.
 */

const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');

// Configuración por defecto
const DEFAULT_CONFIG = {
  email: {
    enabled: false,
    host: process.env.EMAIL_HOST || 'smtp.example.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || ''
    },
    from: process.env.EMAIL_FROM || 'noreply@example.com'
  },
  webhook: {
    enabled: false,
    url: process.env.WEBHOOK_URL || '',
    headers: {}
  },
  templates: {
    path: path.join(__dirname, 'templates')
  }
};

// Estado del gestor de notificaciones
let config = { ...DEFAULT_CONFIG };
let emailTransporter = null;

/**
 * Inicializa el gestor de notificaciones
 * @param {Object} customConfig - Configuración personalizada
 * @returns {Object} - Instancia del gestor de notificaciones
 */
async function initialize(customConfig = {}) {
  try {
    // Combinar configuración por defecto con la personalizada
    config = { ...DEFAULT_CONFIG, ...customConfig };
    
    // Inicializar transportador de correo electrónico
    if (config.email.enabled) {
      emailTransporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.auth.user,
          pass: config.email.auth.pass
        }
      });
      
      // Verificar conexión
      await emailTransporter.verify();
      console.log('Conexión SMTP verificada correctamente');
    }
    
    // Crear directorio de plantillas si no existe
    await fs.mkdir(config.templates.path, { recursive: true });
    
    // Crear plantillas por defecto si no existen
    await createDefaultTemplates();
    
    return module.exports;
  } catch (error) {
    console.error(`Error al inicializar gestor de notificaciones: ${error.message}`);
    return module.exports;
  }
}

/**
 * Crea las plantillas por defecto
 * @returns {Promise<void>}
 */
async function createDefaultTemplates() {
  const templates = {
    'license-revoked.html': `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Licencia revocada</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f44336; color: white; padding: 10px; text-align: center; }
    .content { padding: 20px; border: 1px solid #ddd; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Licencia revocada</h1>
    </div>
    <div class="content">
      <p>Estimado/a {{userName}},</p>
      <p>Le informamos que su licencia para <strong>{{appName}}</strong> ha sido revocada.</p>
      <p><strong>Motivo:</strong> {{reason}}</p>
      <p><strong>Fecha:</strong> {{date}}</p>
      <p>Si cree que esto es un error, por favor contacte con nuestro equipo de soporte.</p>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático, por favor no responda a este correo.</p>
    </div>
  </div>
</body>
</html>
    `,
    'license-expired.html': `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Licencia expirada</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #ff9800; color: white; padding: 10px; text-align: center; }
    .content { padding: 20px; border: 1px solid #ddd; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
    .button { display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Licencia expirada</h1>
    </div>
    <div class="content">
      <p>Estimado/a {{userName}},</p>
      <p>Le informamos que su licencia para <strong>{{appName}}</strong> ha expirado.</p>
      <p><strong>Fecha de expiración:</strong> {{expiryDate}}</p>
      <p>Para continuar utilizando la aplicación, por favor renueve su licencia.</p>
      <p style="text-align: center; margin-top: 20px;">
        <a href="{{renewUrl}}" class="button">Renovar licencia</a>
      </p>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático, por favor no responda a este correo.</p>
    </div>
  </div>
</body>
</html>
    `,
    'license-created.html': `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Licencia creada</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 10px; text-align: center; }
    .content { padding: 20px; border: 1px solid #ddd; }
    .license-key { background-color: #f5f5f5; padding: 10px; font-family: monospace; word-break: break-all; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #777; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Licencia creada</h1>
    </div>
    <div class="content">
      <p>Estimado/a {{userName}},</p>
      <p>Su licencia para <strong>{{appName}}</strong> ha sido creada correctamente.</p>
      <p><strong>Clave de licencia:</strong></p>
      <div class="license-key">{{licenseKey}}</div>
      <p><strong>Fecha de expiración:</strong> {{expiryDate}}</p>
      <p>Guarde esta clave en un lugar seguro. La necesitará para activar la aplicación.</p>
    </div>
    <div class="footer">
      <p>Este es un mensaje automático, por favor no responda a este correo.</p>
    </div>
  </div>
</body>
</html>
    `
  };
  
  // Crear cada plantilla si no existe
  for (const [name, content] of Object.entries(templates)) {
    const templatePath = path.join(config.templates.path, name);
    try {
      await fs.access(templatePath);
    } catch (error) {
      // El archivo no existe, crearlo
      await fs.writeFile(templatePath, content);
      console.log(`Plantilla ${name} creada correctamente`);
    }
  }
}

/**
 * Envía una notificación por correo electrónico
 * @param {Object} options - Opciones de la notificación
 * @returns {Promise<boolean>} - true si se envió correctamente
 */
async function sendEmailNotification(options) {
  try {
    if (!config.email.enabled || !emailTransporter) {
      console.warn('Notificaciones por correo electrónico deshabilitadas');
      return false;
    }
    
    const { to, subject, template, data } = options;
    
    if (!to || !subject || !template) {
      throw new Error('Faltan parámetros requeridos');
    }
    
    // Cargar plantilla
    const templatePath = path.join(config.templates.path, `${template}.html`);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    
    // Compilar plantilla
    const compiledTemplate = handlebars.compile(templateContent);
    const html = compiledTemplate(data);
    
    // Enviar correo
    const result = await emailTransporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html
    });
    
    console.log(`Correo enviado: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error(`Error al enviar notificación por correo: ${error.message}`);
    return false;
  }
}

/**
 * Envía una notificación por webhook
 * @param {Object} options - Opciones de la notificación
 * @returns {Promise<boolean>} - true si se envió correctamente
 */
async function sendWebhookNotification(options) {
  try {
    if (!config.webhook.enabled || !config.webhook.url) {
      console.warn('Notificaciones por webhook deshabilitadas');
      return false;
    }
    
    const { event, data } = options;
    
    if (!event || !data) {
      throw new Error('Faltan parámetros requeridos');
    }
    
    // Enviar webhook
    const response = await axios.post(config.webhook.url, {
      event,
      data,
      timestamp: Date.now()
    }, {
      headers: config.webhook.headers
    });
    
    console.log(`Webhook enviado: ${response.status}`);
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.error(`Error al enviar notificación por webhook: ${error.message}`);
    return false;
  }
}

/**
 * Notifica la revocación de una licencia
 * @param {Object} license - Datos de la licencia
 * @param {string} reason - Motivo de la revocación
 * @returns {Promise<boolean>} - true si se notificó correctamente
 */
async function notifyLicenseRevoked(license, reason) {
  try {
    const results = {
      email: false,
      webhook: false
    };
    
    // Notificar por correo electrónico
    if (license.email) {
      results.email = await sendEmailNotification({
        to: license.email,
        subject: 'Licencia revocada',
        template: 'license-revoked',
        data: {
          userName: license.userName,
          appName: license.appName,
          reason: reason || 'No especificado',
          date: new Date().toLocaleDateString()
        }
      });
    }
    
    // Notificar por webhook
    results.webhook = await sendWebhookNotification({
      event: 'license.revoked',
      data: {
        licenseKey: license.key,
        userName: license.userName,
        appName: license.appName,
        reason: reason || 'No especificado',
        date: new Date().toISOString()
      }
    });
    
    return results.email || results.webhook;
  } catch (error) {
    console.error(`Error al notificar revocación de licencia: ${error.message}`);
    return false;
  }
}

/**
 * Notifica la expiración de una licencia
 * @param {Object} license - Datos de la licencia
 * @returns {Promise<boolean>} - true si se notificó correctamente
 */
async function notifyLicenseExpired(license) {
  try {
    const results = {
      email: false,
      webhook: false
    };
    
    // Notificar por correo electrónico
    if (license.email) {
      results.email = await sendEmailNotification({
        to: license.email,
        subject: 'Licencia expirada',
        template: 'license-expired',
        data: {
          userName: license.userName,
          appName: license.appName,
          expiryDate: new Date(license.expiryDate).toLocaleDateString(),
          renewUrl: `${process.env.CLIENT_URL || 'http://localhost:8080'}/renew?key=${license.key}`
        }
      });
    }
    
    // Notificar por webhook
    results.webhook = await sendWebhookNotification({
      event: 'license.expired',
      data: {
        licenseKey: license.key,
        userName: license.userName,
        appName: license.appName,
        expiryDate: license.expiryDate
      }
    });
    
    return results.email || results.webhook;
  } catch (error) {
    console.error(`Error al notificar expiración de licencia: ${error.message}`);
    return false;
  }
}

/**
 * Notifica la creación de una licencia
 * @param {Object} license - Datos de la licencia
 * @returns {Promise<boolean>} - true si se notificó correctamente
 */
async function notifyLicenseCreated(license) {
  try {
    const results = {
      email: false,
      webhook: false
    };
    
    // Notificar por correo electrónico
    if (license.email) {
      results.email = await sendEmailNotification({
        to: license.email,
        subject: 'Licencia creada',
        template: 'license-created',
        data: {
          userName: license.userName,
          appName: license.appName,
          licenseKey: license.key,
          expiryDate: license.expiryDate === 'permanent' ? 'Permanente' : new Date(license.expiryDate).toLocaleDateString()
        }
      });
    }
    
    // Notificar por webhook
    results.webhook = await sendWebhookNotification({
      event: 'license.created',
      data: {
        licenseKey: license.key,
        userName: license.userName,
        appName: license.appName,
        expiryDate: license.expiryDate
      }
    });
    
    return results.email || results.webhook;
  } catch (error) {
    console.error(`Error al notificar creación de licencia: ${error.message}`);
    return false;
  }
}

module.exports = {
  initialize,
  sendEmailNotification,
  sendWebhookNotification,
  notifyLicenseRevoked,
  notifyLicenseExpired,
  notifyLicenseCreated
};
