# Sistema de Autenticación y Gestión de Licencias

Este documento describe el sistema de autenticación y gestión de licencias implementado en el Asistente de Ventas WhatsApp.

## Índice

1. [Arquitectura](#arquitectura)
2. [Servidor de Licencias](#servidor-de-licencias)
3. [Cliente de Licencias](#cliente-de-licencias)
4. [Flujo de Autenticación](#flujo-de-autenticación)
5. [Gestión de Licencias](#gestión-de-licencias)
6. [Seguridad](#seguridad)
7. [Monitorización](#monitorización)
8. [Configuración](#configuración)
9. [Solución de Problemas](#solución-de-problemas)

## Arquitectura

El sistema de autenticación y gestión de licencias consta de los siguientes componentes:

- **Servidor de Licencias**: Servicio centralizado que gestiona la creación, activación, verificación y revocación de licencias.
- **Cliente de Licencias**: Módulo integrado en la aplicación que se comunica con el servidor para verificar y activar licencias.
- **Gestor de Autenticación**: Módulo local que gestiona la autenticación del usuario y el almacenamiento seguro de la licencia.
- **Panel de Administración**: Interfaz web para administradores que permite gestionar licencias y usuarios.

### Diagrama de Arquitectura

```
+-------------------+      +-------------------+      +-------------------+
|                   |      |                   |      |                   |
|  Aplicación       |<---->|  Servidor de      |<---->|  Panel de         |
|  Cliente          |      |  Licencias        |      |  Administración   |
|                   |      |                   |      |                   |
+-------------------+      +-------------------+      +-------------------+
        |                          |
        |                          |
        v                          v
+-------------------+      +-------------------+
|                   |      |                   |
|  Almacenamiento   |      |  Base de Datos    |
|  Local            |      |  de Licencias     |
|                   |      |                   |
+-------------------+      +-------------------+
```

## Servidor de Licencias

El servidor de licencias es un servicio REST que proporciona endpoints para gestionar licencias y usuarios.

### Características

- Creación y gestión de licencias
- Activación y verificación de licencias
- Revocación de licencias
- Gestión de usuarios y permisos
- Notificaciones por correo electrónico y webhook
- Monitorización y logs
- Seguridad mejorada (HTTPS, limitación de tasa, etc.)

### Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/login` | POST | Iniciar sesión como administrador |
| `/api/verify-token` | GET | Verificar token JWT |
| `/api/generate-license` | POST | Generar una nueva licencia |
| `/api/verify-license` | POST | Verificar una licencia |
| `/api/activate-license` | POST | Activar una licencia |
| `/api/revoke-license` | POST | Revocar una licencia |
| `/api/recover-license` | POST | Recuperar una licencia |
| `/api/licenses` | GET | Obtener lista de licencias |
| `/api/users` | GET | Obtener lista de usuarios |
| `/api/metrics` | GET | Obtener métricas del sistema |

### Configuración

El servidor de licencias se configura mediante variables de entorno en el archivo `.env`:

```
# Configuración del servidor
PORT=3000
NODE_ENV=development

# Configuración SSL
SSL_ENABLED=true
SSL_CERT_PATH=./ssl/cert.pem
SSL_KEY_PATH=./ssl/key.pem

# Clave secreta para JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Clave para crear usuario administrador
ADMIN_KEY=admin-setup-key-change-this-in-production

# URL de la aplicación cliente
CLIENT_URL=http://localhost:8080

# Configuración de notificaciones por correo electrónico
EMAIL_ENABLED=true
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=AsistenteVentasWhatsApp <your-email@gmail.com>

# Configuración de notificaciones por webhook
WEBHOOK_ENABLED=false
WEBHOOK_URL=https://example.com/webhook
WEBHOOK_AUTH=Bearer your-webhook-auth-token

# Configuración de logs y monitorización
LOG_LEVEL=info
LOG_DIR=./logs
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
LOG_CONSOLE=true

# Configuración de alertas
ALERTS_ENABLED=true
ALERT_EMAIL=admin@example.com
ALERT_WEBHOOK=https://example.com/alert-webhook
ALERT_CPU_THRESHOLD=80
ALERT_MEMORY_THRESHOLD=80
ALERT_DISK_THRESHOLD=90
ALERT_ERRORS_THRESHOLD=10

# Configuración de seguridad
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
CORS_ORIGIN=*
ACCESS_TOKEN_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=7d
```

## Cliente de Licencias

El cliente de licencias es un módulo integrado en la aplicación que se comunica con el servidor para verificar y activar licencias.

### Características

- Verificación de licencias con el servidor
- Activación de licencias
- Recuperación de licencias
- Modo offline
- Caché de licencias

### Métodos

| Método | Descripción |
|--------|-------------|
| `initialize(config)` | Inicializa el cliente de licencias |
| `verifyLicense(licenseKey, options)` | Verifica una licencia con el servidor |
| `activateLicense(licenseKey, options)` | Activa una licencia |
| `recoverLicense(recoveryKey, userName)` | Recupera una licencia |
| `generateDeviceId()` | Genera un ID único para el dispositivo |

### Configuración

El cliente de licencias se configura mediante un objeto de configuración:

```javascript
licenseClient.initialize({
  serverUrl: 'https://example.com',
  timeout: 5000,
  retryCount: 3,
  retryDelay: 1000,
  offlineMode: false,
  cacheExpiry: 86400000 // 24 horas
});
```

## Flujo de Autenticación

### Activación de Licencia

1. El usuario inicia la aplicación por primera vez.
2. La aplicación muestra la pantalla de activación de licencia.
3. El usuario ingresa su clave de licencia.
4. La aplicación envía la clave de licencia al servidor para activarla.
5. El servidor verifica la clave de licencia y la activa si es válida.
6. El servidor devuelve una clave de recuperación.
7. La aplicación almacena la licencia y la clave de recuperación localmente.
8. La aplicación muestra la pantalla principal.

### Verificación de Licencia

1. El usuario inicia la aplicación.
2. La aplicación verifica la licencia almacenada localmente.
3. La aplicación envía la licencia al servidor para verificarla.
4. El servidor verifica la licencia y devuelve su estado.
5. Si la licencia es válida, la aplicación muestra la pantalla principal.
6. Si la licencia no es válida, la aplicación muestra la pantalla de activación de licencia.
7. Si no hay conexión con el servidor, la aplicación verifica la licencia localmente.

### Recuperación de Licencia

1. El usuario inicia la aplicación en un nuevo dispositivo.
2. La aplicación muestra la pantalla de activación de licencia.
3. El usuario selecciona la opción de recuperar licencia.
4. El usuario ingresa su nombre de usuario y clave de recuperación.
5. La aplicación envía la información al servidor para recuperar la licencia.
6. El servidor verifica la información y devuelve la licencia si es válida.
7. La aplicación almacena la licencia localmente.
8. La aplicación muestra la pantalla principal.

## Gestión de Licencias

### Tipos de Licencias

- **Activa**: Licencia válida y en uso.
- **Inactiva**: Licencia válida pero no activada.
- **Expirada**: Licencia que ha superado su fecha de expiración.
- **Revocada**: Licencia que ha sido revocada por un administrador.

### Estados de Licencia

| Estado | Descripción |
|--------|-------------|
| `active` | Licencia activa y válida |
| `inactive` | Licencia no activada |
| `expired` | Licencia expirada |
| `revoked` | Licencia revocada |

### Formato de Licencia

Las licencias se generan en formato Base64 con un hash SHA-256 para verificar su integridad:

```
eyJhcHBOYW1lIjoiQXNpc3RlbnRlVmVudGFzV2hhdHNBcHAiLCJ1c2VyTmFtZSI6IlVzdWFyaW8iLCJzZWNyZXRLZXkiOiIxMjM0NTY3ODkwIiwidGltZXN0YW1wIjoxNjgwMDAwMDAwMDAwLCJleHBpcnlEYXRlIjoiMjAyNC0xMi0zMVQyMzo1OTo1OS45OTlaIn0=.abcd1234
```

La parte Base64 decodificada contiene un objeto JSON con la siguiente estructura:

```json
{
  "appName": "AsistenteVentasWhatsApp",
  "userName": "Usuario",
  "secretKey": "1234567890",
  "timestamp": 1680000000000,
  "expiryDate": "2024-12-31T23:59:59.999Z"
}
```

## Seguridad

### Medidas de Seguridad

- **HTTPS**: Todas las comunicaciones entre el cliente y el servidor se realizan a través de HTTPS.
- **JWT**: Se utilizan tokens JWT para la autenticación de administradores.
- **Limitación de Tasa**: Se limita el número de solicitudes para prevenir ataques de fuerza bruta.
- **Protección contra XSS**: Se sanitizan las entradas para prevenir ataques de cross-site scripting.
- **Protección contra CSRF**: Se implementan medidas para prevenir ataques de falsificación de solicitudes.
- **Cifrado**: Se utiliza cifrado AES-256 para proteger datos sensibles.
- **Validación de Contraseñas**: Se valida la fortaleza de las contraseñas.

### Almacenamiento Seguro

Las licencias y claves de recuperación se almacenan de forma segura en el dispositivo del usuario:

- En Windows: En el registro de Windows o en un archivo cifrado en AppData.
- En macOS: En el Keychain o en un archivo cifrado en Application Support.
- En Linux: En un archivo cifrado en ~/.config.

## Monitorización

### Logs

El sistema genera logs detallados para facilitar la depuración y el análisis:

- **Logs de Servidor**: Se registran todas las solicitudes, respuestas y errores del servidor.
- **Logs de Cliente**: Se registran todas las operaciones de verificación, activación y recuperación de licencias.
- **Logs de Autenticación**: Se registran todos los intentos de autenticación y sus resultados.

### Métricas

El sistema recopila métricas para monitorizar su rendimiento y uso:

- **Métricas de Servidor**: CPU, memoria, disco, solicitudes, errores.
- **Métricas de Licencias**: Licencias activas, inactivas, expiradas, revocadas.
- **Métricas de Usuarios**: Usuarios activos, inactivos.

### Alertas

El sistema puede enviar alertas cuando se detectan problemas:

- **Alertas de Rendimiento**: CPU, memoria, disco.
- **Alertas de Errores**: Número de errores.
- **Alertas de Licencias**: Licencias revocadas, expiradas.

## Configuración

### Configuración del Servidor

Ver la sección [Configuración](#configuración) del Servidor de Licencias.

### Configuración del Cliente

El cliente de licencias se configura en el archivo `config.json` de la aplicación:

```json
{
  "license": {
    "serverUrl": "https://example.com",
    "timeout": 5000,
    "retryCount": 3,
    "retryDelay": 1000,
    "offlineMode": false,
    "cacheExpiry": 86400000
  }
}
```

## Solución de Problemas

### Problemas Comunes

#### El servidor no responde

- Verificar que el servidor esté en ejecución.
- Verificar la conectividad de red.
- Verificar la configuración de firewall.

#### La licencia no se activa

- Verificar que la clave de licencia sea válida.
- Verificar que la licencia no esté ya activada en otro dispositivo.
- Verificar que la licencia no esté revocada o expirada.

#### La licencia no se verifica

- Verificar que la licencia esté activada.
- Verificar que la licencia no esté revocada o expirada.
- Verificar la conectividad con el servidor.

#### No se puede recuperar la licencia

- Verificar que la clave de recuperación sea correcta.
- Verificar que el nombre de usuario sea correcto.
- Verificar la conectividad con el servidor.

### Logs

Los logs del servidor se encuentran en el directorio `logs` del servidor:

- `combined.log`: Todos los logs.
- `error.log`: Solo logs de error.

Los logs del cliente se encuentran en el directorio de datos de la aplicación:

- Windows: `%APPDATA%\Asistente de Ventas WhatsApp\logs`
- macOS: `~/Library/Application Support/Asistente de Ventas WhatsApp/logs`
- Linux: `~/.config/Asistente de Ventas WhatsApp/logs`
