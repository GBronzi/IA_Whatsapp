# Servidor de Actualizaciones para Asistente de Ventas WhatsApp

Este servidor proporciona endpoints para gestionar las actualizaciones de la aplicación Asistente de Ventas WhatsApp.

## Características

- Verificación de actualizaciones disponibles
- Descarga de actualizaciones
- Obtención de notas de versión
- Gestión de actualizaciones (añadir, eliminar, listar)
- Soporte para múltiples plataformas (Windows, macOS, Linux)
- Soporte para múltiples arquitecturas (x64, arm64)
- Soporte para múltiples canales (stable, beta)

## Requisitos

- Node.js 14.x o superior
- npm 6.x o superior

## Instalación

1. Clona este repositorio:
   ```
   git clone https://github.com/GBronzi/IA_Whatsapp.git
   cd IA_Whatsapp/update-server
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Copia el archivo `.env.example` a `.env` y configura las variables de entorno:
   ```
   cp .env.example .env
   ```

4. Crea los directorios necesarios:
   ```
   mkdir -p updates logs
   ```

5. Inicia el servidor:
   ```
   npm start
   ```

## Estructura de directorios

- `updates/`: Directorio donde se almacenan los archivos de actualización
- `logs/`: Directorio donde se almacenan los registros del servidor
- `updates.json`: Archivo que contiene la información de las actualizaciones disponibles

## API

### Verificar actualizaciones

```
GET /api/updates/check
```

Parámetros de consulta:
- `platform`: Plataforma (win32, darwin, linux)
- `arch`: Arquitectura (x64, arm64)
- `version`: Versión actual
- `channel`: Canal (stable, beta) (opcional, por defecto: stable)

### Descargar actualización

```
GET /api/updates/download/:version/:platform/:arch
```

Parámetros de ruta:
- `version`: Versión de la actualización
- `platform`: Plataforma (win32, darwin, linux)
- `arch`: Arquitectura (x64, arm64)

Parámetros de consulta:
- `channel`: Canal (stable, beta) (opcional, por defecto: stable)

### Obtener notas de versión

```
GET /api/updates/notes/:version
```

Parámetros de ruta:
- `version`: Versión de la actualización

### Añadir actualización (requiere API key)

```
POST /api/updates/add
```

Cabeceras:
- `x-api-key`: Clave API

Cuerpo de la solicitud:
```json
{
  "version": "1.0.0",
  "platform": "win32",
  "arch": "x64",
  "channel": "stable",
  "releaseDate": "2023-04-01T00:00:00.000Z",
  "releaseNotes": "Primera versión",
  "fileName": "asistente-ventas-1.0.0-win32-x64.exe"
}
```

### Eliminar actualización (requiere API key)

```
DELETE /api/updates/:version/:platform/:arch
```

Cabeceras:
- `x-api-key`: Clave API

Parámetros de ruta:
- `version`: Versión de la actualización
- `platform`: Plataforma (win32, darwin, linux)
- `arch`: Arquitectura (x64, arm64)

Parámetros de consulta:
- `channel`: Canal (stable, beta) (opcional, por defecto: stable)

### Listar actualizaciones (requiere API key)

```
GET /api/updates
```

Cabeceras:
- `x-api-key`: Clave API

## Formato de updates.json

```json
[
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
]
```

## Licencia

MIT
