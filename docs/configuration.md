# Configuración de la Aplicación

Este documento describe las opciones de configuración disponibles en el Asistente de Ventas WhatsApp.

## Índice

1. [Interfaz de Configuración](#interfaz-de-configuración)
2. [Configuración de Licencia](#configuración-de-licencia)
3. [Configuración de Actualizaciones](#configuración-de-actualizaciones)
4. [Configuración General](#configuración-general)
5. [Configuración Avanzada](#configuración-avanzada)
6. [Archivos de Configuración](#archivos-de-configuración)
7. [Variables de Entorno](#variables-de-entorno)

## Interfaz de Configuración

La aplicación proporciona una interfaz gráfica para configurar sus opciones. Para acceder a ella:

1. Inicie la aplicación.
2. Haga clic en el menú "Archivo" > "Configuración".
3. O presione `Ctrl+,` (Windows/Linux) o `Cmd+,` (macOS).

La interfaz de configuración se divide en varias secciones:

- **Información de licencia**: Muestra información sobre la licencia actual y permite activar o revocar licencias.
- **Actualizaciones**: Permite configurar las opciones de actualización automática.
- **Configuración general**: Permite configurar opciones generales de la aplicación.
- **Diagnóstico**: Muestra información de diagnóstico y permite ejecutar herramientas de diagnóstico.

## Configuración de Licencia

### Información de Licencia

- **Estado de licencia**: Muestra el estado actual de la licencia (Activa, Inactiva, Expirada, Revocada).
- **Clave de licencia**: Muestra la clave de licencia actual (parcialmente oculta por seguridad).
- **Fecha de expiración**: Muestra la fecha de expiración de la licencia.

### Acciones de Licencia

- **Activar nueva licencia**: Permite activar una nueva licencia.
- **Revocar licencia**: Permite revocar la licencia actual.

## Configuración de Actualizaciones

### Información de Actualizaciones

- **Versión actual**: Muestra la versión actual de la aplicación.
- **Última verificación**: Muestra la fecha y hora de la última verificación de actualizaciones.
- **Estado**: Muestra el estado actual de las actualizaciones (Actualización disponible, No hay actualizaciones, etc.).
- **Nueva versión**: Muestra la versión de la actualización disponible.
- **Notas de la versión**: Muestra las notas de la versión de la actualización disponible.

### Opciones de Actualizaciones

- **Verificar actualizaciones automáticamente**: Activa o desactiva la verificación automática de actualizaciones.
- **Descargar actualizaciones automáticamente**: Activa o desactiva la descarga automática de actualizaciones.

### Acciones de Actualizaciones

- **Verificar actualizaciones**: Verifica manualmente si hay actualizaciones disponibles.
- **Descargar actualización**: Descarga la actualización disponible.
- **Instalar actualización**: Instala la actualización descargada.

## Configuración General

### Google Sheets

- **ID de Google Sheets**: Permite configurar el ID de la hoja de cálculo de Google Sheets que se utilizará como CRM.

### Notificaciones

- **Sonido de notificación**: Permite seleccionar el sonido que se reproducirá cuando se reciba una notificación.

### Inicio

- **Iniciar con Windows**: Activa o desactiva el inicio automático de la aplicación con Windows.
- **Minimizar a la bandeja del sistema**: Activa o desactiva la minimización de la aplicación a la bandeja del sistema en lugar de cerrarla.

### Acciones

- **Guardar configuración**: Guarda los cambios realizados en la configuración.
- **Restablecer**: Restablece la configuración a los valores predeterminados.

## Configuración Avanzada

La configuración avanzada no está disponible a través de la interfaz gráfica y debe modificarse directamente en los archivos de configuración.

### Opciones Avanzadas

- **Intervalo de verificación de actualizaciones**: Intervalo en milisegundos entre verificaciones automáticas de actualizaciones.
- **URL del servidor de licencias**: URL del servidor de licencias.
- **URL del servidor de actualizaciones**: URL del servidor de actualizaciones.
- **Modo offline**: Activa o desactiva el modo offline para la verificación de licencias.
- **Caducidad de caché**: Tiempo en milisegundos que se almacena en caché la verificación de licencias.

## Archivos de Configuración

La aplicación utiliza varios archivos de configuración:

### settings.json

Este archivo contiene la configuración general de la aplicación y se encuentra en:

- Windows: `%APPDATA%\Asistente de Ventas WhatsApp\settings.json`
- macOS: `~/Library/Application Support/Asistente de Ventas WhatsApp/settings.json`
- Linux: `~/.config/Asistente de Ventas WhatsApp/settings.json`

Ejemplo:

```json
{
  "sheetsId": "1a2b3c4d5e6f7g8h9i0j",
  "notificationSound": "default",
  "startWithWindows": false,
  "minimizeToTray": true,
  "autoCheckUpdates": true,
  "autoDownloadUpdates": false
}
```

### license.json

Este archivo contiene la información de la licencia y se encuentra en:

- Windows: `%APPDATA%\Asistente de Ventas WhatsApp\license.json`
- macOS: `~/Library/Application Support/Asistente de Ventas WhatsApp/license.json`
- Linux: `~/.config/Asistente de Ventas WhatsApp/license.json`

Ejemplo:

```json
{
  "key": "eyJhcHBOYW1lIjoiQXNpc3RlbnRlVmVudGFzV2hhdHNBcHAiLCJ1c2VyTmFtZSI6IlVzdWFyaW8iLCJzZWNyZXRLZXkiOiIxMjM0NTY3ODkwIiwidGltZXN0YW1wIjoxNjgwMDAwMDAwMDAwLCJleHBpcnlEYXRlIjoiMjAyNC0xMi0zMVQyMzo1OTo1OS45OTlaIn0=.abcd1234",
  "status": "active",
  "expiryDate": "2024-12-31T23:59:59.999Z",
  "userName": "Usuario",
  "recoveryKey": "0123456789abcdef"
}
```

### advanced.json

Este archivo contiene la configuración avanzada de la aplicación y se encuentra en:

- Windows: `%APPDATA%\Asistente de Ventas WhatsApp\advanced.json`
- macOS: `~/Library/Application Support/Asistente de Ventas WhatsApp/advanced.json`
- Linux: `~/.config/Asistente de Ventas WhatsApp/advanced.json`

Ejemplo:

```json
{
  "license": {
    "serverUrl": "https://example.com",
    "timeout": 5000,
    "retryCount": 3,
    "retryDelay": 1000,
    "offlineMode": false,
    "cacheExpiry": 86400000
  },
  "updates": {
    "updateUrl": "https://example.com/updates",
    "checkInterval": 3600000,
    "autoDownload": false,
    "autoInstall": false,
    "allowPrerelease": false,
    "channel": "stable"
  }
}
```

## Variables de Entorno

La aplicación también puede configurarse mediante variables de entorno:

### Variables de Licencia

- `LICENSE_SERVER_URL`: URL del servidor de licencias.
- `LICENSE_OFFLINE_MODE`: Activa o desactiva el modo offline para la verificación de licencias.
- `LICENSE_REQUEST_TIMEOUT`: Tiempo de espera en milisegundos para las solicitudes al servidor de licencias.
- `LICENSE_RETRY_COUNT`: Número de reintentos para las solicitudes al servidor de licencias.
- `LICENSE_RETRY_DELAY`: Tiempo de espera en milisegundos entre reintentos.
- `LICENSE_CACHE_EXPIRY`: Tiempo en milisegundos que se almacena en caché la verificación de licencias.

### Variables de Actualización

- `UPDATE_URL`: URL del servidor de actualizaciones.
- `UPDATE_CHECK_INTERVAL`: Intervalo en milisegundos entre verificaciones automáticas de actualizaciones.
- `UPDATE_AUTO_DOWNLOAD`: Activa o desactiva la descarga automática de actualizaciones.
- `UPDATE_AUTO_INSTALL`: Activa o desactiva la instalación automática de actualizaciones.
- `UPDATE_ALLOW_PRERELEASE`: Activa o desactiva la instalación de versiones preliminares.
- `UPDATE_CHANNEL`: Canal de actualización (stable, beta, alpha).

### Variables Generales

- `SHEETS_ID`: ID de la hoja de cálculo de Google Sheets.
- `NOTIFICATION_SOUND`: Sonido de notificación.
- `START_WITH_WINDOWS`: Activa o desactiva el inicio automático de la aplicación con Windows.
- `MINIMIZE_TO_TRAY`: Activa o desactiva la minimización de la aplicación a la bandeja del sistema.
