# Asistente de Ventas para WhatsApp

Un asistente virtual para WhatsApp que utiliza IA (Ollama) para mantener conversaciones con clientes potenciales, recopilar información importante y almacenarla en Google Sheets o Bitrix24.

## Características

- 🤖 **Conversaciones con IA**: Utiliza Ollama (modelo llama3.2) para generar respuestas naturales
- 📱 **Integración con WhatsApp**: Conexión mediante WhatsApp Web.js
- 📊 **Integración con CRM**: Sincronización con Google Sheets (predeterminado) y Bitrix24 (opcional)
- 🔄 **Persistencia de datos**: Base de datos SQLite para almacenar historial de conversaciones
- 📷 **Manejo de medios**: Procesa imágenes, audio, video y documentos
- 🔒 **Seguridad mejorada**: Variables de entorno para configuración sensible
- 📝 **Logging avanzado**: Sistema de logs para facilitar depuración
- ⚡ **Sistema de colas**: Manejo eficiente de múltiples conversaciones simultáneas
- 🧪 **Tests automatizados**: Pruebas unitarias con Jest
- 📢 **Sistema de notificaciones**: Alertas visuales y sonoras cuando se requiere intervención humana
- 👁️ **Filtrado inteligente**: Responde solo a mensajes nuevos de chats individuales, ignorando grupos y estados
- 💻 **Interfaz gráfica**: Aplicación de escritorio con interfaz minimalista para gestionar el asistente

## Requisitos previos

- Node.js 14.x o superior
- Ollama instalado localmente con el modelo llama3.2
- Cuenta de Google y credenciales de API para Google Sheets
- WhatsApp en tu teléfono móvil

## Instalación

1. Clona este repositorio:
   ```
   git clone https://github.com/tu-usuario/asistente-ventas-whatsapp.git
   cd asistente-ventas-whatsapp
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Crea un archivo `.env` basado en `.env.example`:
   ```
   cp .env.example .env
   ```

4. Edita el archivo `.env` con tus configuraciones personales.

5. Coloca tu archivo de credenciales de Google (`credentials.json`) en la raíz del proyecto.

6. Crea un archivo `training-data.json` con ejemplos de conversación:
   ```json
   [
       {"prompt": "¿Qué cursos tienes?", "response": "Ofrecemos cursos de programación, diseño y marketing."},
       {"prompt": "¿Hay promociones?", "response": "Sí, 20% de descuento este mes."},
       {"prompt": "¿Cómo puedo pagar?", "response": "Aceptamos pagos en efectivo, tarjeta y transferencia."}
   ]
   ```

## Uso

### Modo consola

1. Inicia Ollama en tu máquina local:
   ```
   ollama serve
   ```

2. En otra terminal, inicia el asistente:
   ```
   npm start
   ```

3. Escanea el código QR que aparece en la terminal con tu WhatsApp.

4. ¡Listo! El asistente responderá a los mensajes que reciba.

### Modo interfaz gráfica

1. Inicia la aplicación Electron:
   ```
   npm run electron
   ```

2. En la ventana de la aplicación, haz clic en "Iniciar".

3. Escanea el código QR que aparece en la ventana con tu WhatsApp.

4. Puedes configurar el CRM haciendo clic en "Configurar CRM".

5. Para ver las notificaciones de mensajes que requieren atención humana, haz clic en "Notificaciones".

## Comandos disponibles

- `reiniciar`: Borra el historial de conversación y comienza de nuevo.

## Estructura del proyecto

```
asistente-ventas-whatsapp/
├── .env                  # Variables de entorno (no incluido en repo)
├── .env.example          # Plantilla de variables de entorno
├── config.js             # Configuración centralizada
├── index.js              # Punto de entrada principal
├── database.js           # Módulo de base de datos SQLite
├── ai-service.js         # Servicio de IA (Ollama)
├── crm-manager.js        # Gestor de integración con CRM
├── sentiment-analyzer.js  # Analizador de sentimiento
├── media-handler.js      # Manejo de archivos multimedia
├── message-queue.js      # Sistema de colas para mensajes
├── logger.js             # Sistema de logging
├── credentials.json      # Credenciales de Google (no incluido en repo)
├── training-data.json    # Ejemplos de entrenamiento
├── electron/              # Código de la aplicación Electron
│   ├── main.js           # Punto de entrada de Electron
│   ├── preload.js        # Script de precarga
│   └── renderer.js       # Código del renderizador
├── test/                 # Pruebas automatizadas
│   ├── app-launch.spec.js
│   ├── crm-settings.spec.js
│   ├── main-window.spec.js
│   └── manual-ui-tests.md
├── logs/                 # Archivos de log (generados automáticamente)
├── media/                # Archivos multimedia recibidos
└── sessions/             # Sesiones de WhatsApp
```

## Pruebas

### Pruebas unitarias

Para ejecutar las pruebas unitarias:

```
npm test
```

Para ejecutar las pruebas con cobertura:

```
npm run test:coverage
```

### Pruebas de interfaz gráfica

Para ejecutar las pruebas de interfaz gráfica:

```
npm run test:playwright
```

También puedes seguir la guía de pruebas manuales en `test/manual-ui-tests.md`.

## Contribuir

1. Haz un fork del repositorio
2. Crea una rama para tu característica (`git checkout -b feature/nueva-caracteristica`)
3. Haz commit de tus cambios (`git commit -am 'Añadir nueva característica'`)
4. Haz push a la rama (`git push origin feature/nueva-caracteristica`)
5. Crea un Pull Request

## Licencia

Este proyecto está licenciado bajo la Licencia ISC - ver el archivo LICENSE para más detalles.

## Configuración de CRM

### Google Sheets

1. Abre la aplicación
2. Haz clic en "Configurar CRM"
3. En la pestaña "Google Sheets", introduce el ID de la hoja de cálculo
4. Haz clic en "Probar conexión" para verificar que funciona correctamente
5. Haz clic en "Guardar configuración"

### Bitrix24 (opcional)

1. Abre la aplicación
2. Haz clic en "Configurar CRM"
3. En la pestaña "Bitrix24", marca la casilla "Habilitar Bitrix24"
4. Introduce la URL del webhook de Bitrix24
5. Haz clic en "Probar conexión" para verificar que funciona correctamente
6. Haz clic en "Guardar configuración"

## Contacto

Para preguntas o soporte, contacta a [tu-email@ejemplo.com](mailto:tu-email@ejemplo.com).
