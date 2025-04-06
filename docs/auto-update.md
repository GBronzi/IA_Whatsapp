# Sistema de Actualización Automática

Este documento describe el sistema de actualización automática implementado en el Asistente de Ventas WhatsApp.

## Índice

1. [Arquitectura](#arquitectura)
2. [Servidor de Actualizaciones](#servidor-de-actualizaciones)
3. [Cliente de Actualizaciones](#cliente-de-actualizaciones)
4. [Flujo de Actualización](#flujo-de-actualización)
5. [Gestión de Versiones](#gestión-de-versiones)
6. [Seguridad](#seguridad)
7. [Configuración](#configuración)
8. [Solución de Problemas](#solución-de-problemas)

## Arquitectura

El sistema de actualización automática consta de los siguientes componentes:

- **Servidor de Actualizaciones**: Servicio centralizado que gestiona la distribución de actualizaciones.
- **Cliente de Actualizaciones**: Módulo integrado en la aplicación que se comunica con el servidor para verificar, descargar e instalar actualizaciones.
- **Gestor de Actualizaciones**: Módulo local que gestiona el proceso de actualización.

### Diagrama de Arquitectura

```
+-------------------+      +-------------------+
|                   |      |                   |
|  Aplicación       |<---->|  Servidor de      |
|  Cliente          |      |  Actualizaciones  |
|                   |      |                   |
+-------------------+      +-------------------+
        |                          |
        |                          |
        v                          v
+-------------------+      +-------------------+
|                   |      |                   |
|  Gestor de        |      |  Repositorio de   |
|  Actualizaciones  |      |  Actualizaciones  |
|                   |      |                   |
+-------------------+      +-------------------+
```

## Servidor de Actualizaciones

El servidor de actualizaciones es un servicio REST que proporciona endpoints para gestionar y distribuir actualizaciones.

### Características

- Verificación de actualizaciones disponibles
- Descarga de actualizaciones
- Obtención de notas de versión
- Gestión de actualizaciones (añadir, eliminar, listar)
- Soporte para múltiples plataformas (Windows, macOS, Linux)
- Soporte para múltiples arquitecturas (x64, arm64)
- Soporte para múltiples canales (stable, beta)

### Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/updates/check` | GET | Verificar actualizaciones disponibles |
| `/api/updates/download/:version/:platform/:arch` | GET | Descargar actualización |
| `/api/updates/notes/:version` | GET | Obtener notas de versión |
| `/api/updates/add` | POST | Añadir una nueva actualización |
| `/api/updates/upload` | POST | Subir un archivo de actualización |
| `/api/updates/:version/:platform/:arch` | DELETE | Eliminar una actualización |
| `/api/updates` | GET | Listar todas las actualizaciones |

### Configuración

El servidor de actualizaciones se configura mediante variables de entorno en el archivo `.env`:

```
# Configuración del servidor
PORT=3001
NODE_ENV=development

# Directorios
UPDATES_DIR=./updates
LOG_DIR=./logs

# Seguridad
API_KEY=your-super-secret-api-key-change-this-in-production

# Logs
LOG_LEVEL=info
```

## Cliente de Actualizaciones

El cliente de actualizaciones es un módulo integrado en la aplicación que se comunica con el servidor para verificar, descargar e instalar actualizaciones.

### Características

- Verificación de actualizaciones disponibles
- Descarga de actualizaciones
- Instalación de actualizaciones
- Notificaciones de actualizaciones
- Configuración de actualizaciones automáticas

### Métodos

| Método | Descripción |
|--------|-------------|
| `initialize(config)` | Inicializa el cliente de actualizaciones |
| `checkForUpdates()` | Verifica si hay actualizaciones disponibles |
| `downloadUpdate()` | Descarga una actualización disponible |
| `quitAndInstall()` | Instala una actualización descargada |
| `updateFromFile(filePath)` | Actualiza desde un archivo local |
| `downloadFromUrl(url, version)` | Descarga una actualización desde una URL |
| `getStatus()` | Obtiene el estado actual de la actualización |

### Configuración

El cliente de actualizaciones se configura mediante un objeto de configuración:

```javascript
autoUpdater.initialize({
  updateUrl: 'https://example.com/updates',
  checkInterval: 3600000, // 1 hora
  autoDownload: false,
  autoInstall: false,
  allowPrerelease: false,
  channel: 'stable'
});
```

## Flujo de Actualización

### Verificación de Actualizaciones

1. La aplicación verifica periódicamente si hay actualizaciones disponibles.
2. La aplicación envía información sobre su versión actual, plataforma y arquitectura al servidor.
3. El servidor verifica si hay una versión más reciente disponible.
4. Si hay una actualización disponible, el servidor devuelve información sobre la nueva versión.
5. La aplicación notifica al usuario sobre la actualización disponible.

### Descarga de Actualizaciones

1. El usuario decide descargar la actualización.
2. La aplicación solicita la descarga de la actualización al servidor.
3. El servidor envía el archivo de actualización.
4. La aplicación muestra el progreso de la descarga.
5. Una vez completada la descarga, la aplicación verifica la integridad del archivo.
6. La aplicación notifica al usuario que la actualización está lista para instalar.

### Instalación de Actualizaciones

1. El usuario decide instalar la actualización.
2. La aplicación cierra todas las ventanas y procesos.
3. La aplicación ejecuta el instalador de la actualización.
4. El instalador reemplaza los archivos de la aplicación.
5. El instalador inicia la nueva versión de la aplicación.

## Gestión de Versiones

### Versionado Semántico

El sistema utiliza versionado semántico (SemVer) para gestionar las versiones de la aplicación:

- **Mayor (X.0.0)**: Cambios incompatibles con versiones anteriores.
- **Menor (0.X.0)**: Nuevas funcionalidades compatibles con versiones anteriores.
- **Parche (0.0.X)**: Correcciones de errores compatibles con versiones anteriores.

### Canales de Actualización

El sistema soporta múltiples canales de actualización:

- **stable**: Versiones estables para usuarios finales.
- **beta**: Versiones de prueba para usuarios avanzados.
- **alpha**: Versiones de desarrollo para pruebas internas.

### Formato de Actualizaciones

Las actualizaciones se almacenan en el servidor con la siguiente estructura:

```json
{
  "version": "1.0.0",
  "platform": "win32",
  "arch": "x64",
  "channel": "stable",
  "releaseDate": "2023-04-01T00:00:00.000Z",
  "releaseNotes": "Primera versión",
  "fileName": "asistente-ventas-1.0.0-win32-x64.exe",
  "sha256": "123abc...",
  "size": 12345678
}
```

## Seguridad

### Medidas de Seguridad

- **HTTPS**: Todas las comunicaciones entre el cliente y el servidor se realizan a través de HTTPS.
- **Verificación de Integridad**: Se verifica la integridad de los archivos de actualización mediante hashes SHA-256.
- **Limitación de Tasa**: Se limita el número de solicitudes para prevenir ataques de denegación de servicio.
- **Autenticación de API**: Se requiere una clave API para gestionar actualizaciones en el servidor.

### Firma de Actualizaciones

En un entorno de producción, las actualizaciones deberían estar firmadas digitalmente para garantizar su autenticidad:

1. El desarrollador firma el archivo de actualización con su clave privada.
2. El cliente verifica la firma con la clave pública del desarrollador.
3. Si la firma es válida, el cliente instala la actualización.

## Configuración

### Configuración del Servidor

Ver la sección [Configuración](#configuración) del Servidor de Actualizaciones.

### Configuración del Cliente

El cliente de actualizaciones se configura en el archivo `config.json` de la aplicación:

```json
{
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

También se puede configurar a través de la interfaz de usuario en la sección de configuración de la aplicación.

## Solución de Problemas

### Problemas Comunes

#### No se detectan actualizaciones

- Verificar que el servidor de actualizaciones esté en ejecución.
- Verificar la conectividad de red.
- Verificar que la aplicación esté configurada con la URL correcta del servidor de actualizaciones.
- Verificar que haya actualizaciones disponibles para la plataforma y arquitectura de la aplicación.

#### Error al descargar actualizaciones

- Verificar la conectividad de red.
- Verificar que el archivo de actualización exista en el servidor.
- Verificar que haya suficiente espacio en disco.

#### Error al instalar actualizaciones

- Verificar que la aplicación tenga permisos para instalar actualizaciones.
- Verificar que no haya procesos de la aplicación en ejecución.
- Verificar que el archivo de actualización no esté corrupto.

### Logs

Los logs del servidor se encuentran en el directorio `logs` del servidor:

- `combined.log`: Todos los logs.
- `error.log`: Solo logs de error.

Los logs del cliente se encuentran en el directorio de datos de la aplicación:

- Windows: `%APPDATA%\Asistente de Ventas WhatsApp\logs`
- macOS: `~/Library/Application Support/Asistente de Ventas WhatsApp/logs`
- Linux: `~/.config/Asistente de Ventas WhatsApp/logs`
