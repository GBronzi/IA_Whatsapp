# Asistente de Ventas para WhatsApp

Un asistente virtual para WhatsApp que utiliza IA (Ollama) para mantener conversaciones con clientes potenciales, recopilar información importante y almacenarla en Google Sheets.

## Características

- 🤖 **Conversaciones con IA**: Utiliza Ollama (modelo llama3.2) para generar respuestas naturales
- 📱 **Integración con WhatsApp**: Conexión mediante WhatsApp Web.js
- 📊 **Integración con CRM**: Sincronización con Google Sheets
- 🔄 **Persistencia de datos**: Base de datos SQLite para almacenar historial de conversaciones
- 📷 **Manejo de medios**: Procesa imágenes, audio, video y documentos
- 🔒 **Seguridad mejorada**: Variables de entorno para configuración sensible
- 📝 **Logging avanzado**: Sistema de logs para facilitar depuración
- ⚡ **Sistema de colas**: Manejo eficiente de múltiples conversaciones simultáneas
- 🧪 **Tests automatizados**: Pruebas unitarias con Jest
- 📢 **Sistema de notificaciones**: Alertas visuales y sonoras cuando se requiere intervención humana
- 👁️ **Filtrado inteligente**: Responde solo a mensajes nuevos de chats individuales, ignorando grupos y estados
- 💻 **Interfaz gráfica**: Aplicación de escritorio con interfaz minimalista para gestionar el asistente
- 🔥 **Sistema de caché**: Optimización de rendimiento mediante caché multinivel
- 🤖 **Detección avanzada de asistencia humana**: Algoritmos de NLP para identificar cuándo un cliente necesita hablar con un humano

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
├── cache-manager.js      # Gestor de caché para optimización
├── human-assistance-detector.js # Detector avanzado de asistencia humana
├── notification-manager.js # Gestor de notificaciones
├── cleanup.js            # Script para limpiar archivos obsoletos
├── credentials.json      # Credenciales de Google (no incluido en repo)
├── training-data.json    # Ejemplos de entrenamiento
├── electron/              # Código de la aplicación Electron
│   ├── main.js           # Punto de entrada de Electron
│   ├── preload.js        # Script de precarga
│   └── renderer.js       # Código del renderizador
├── tests/                # Pruebas automatizadas
│   ├── integration/       # Pruebas de integración
│   │   ├── communication-test.js
│   │   ├── storage-test.js
│   │   ├── google-sheets-test.js
│   │   └── notification-test.js
│   ├── ui/                # Pruebas de interfaz gráfica
│   │   ├── main-window.spec.js
│   │   └── crm-settings.spec.js
│   ├── database.test.js
│   ├── license-client.test.js
│   └── auto-updater.test.js
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

### Pruebas de integración

Para ejecutar todas las pruebas de integración:

```
npm run test:integration-all
```

O puedes ejecutar pruebas específicas:

```
npm run test:communication  # Pruebas de comunicación y sincronización
npm run test:storage        # Pruebas de almacenamiento
npm run test:sheets         # Pruebas de integración con Google Sheets
npm run test:notifications  # Pruebas del sistema de notificaciones
```

### Pruebas de interfaz gráfica

Para ejecutar las pruebas de interfaz gráfica:

```
npm run test:ui
```

Para ejecutar las pruebas en modo visual (con navegador visible):

```
npm run test:ui:headed
```

Para ejecutar las pruebas en modo depuración:

```
npm run test:ui:debug
```

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

## Contacto

Para preguntas o soporte, contacta a [g.bronzi91@gmail.com](mailto:g.bronzi91@gmail.com).
