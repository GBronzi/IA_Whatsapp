# Guía de pruebas manuales de la interfaz gráfica

Esta guía describe los pasos para realizar pruebas manuales de la interfaz gráfica de la aplicación Asistente de Ventas WhatsApp.

## Prueba 1: Ventana principal

### Objetivo
Verificar que la ventana principal se carga correctamente y muestra todos los elementos necesarios.

### Pasos
1. Iniciar la aplicación con `npm run electron`
2. Verificar que la ventana principal se muestra correctamente
3. Verificar que el título de la ventana es "Asistente de Ventas WhatsApp"
4. Verificar que los siguientes elementos están presentes:
   - Botón de inicio
   - Botón de detener
   - Área de logs
   - Botón de configuración de CRM
   - Botón de visualización de logs
   - Botón de visualización de reportes
   - Botón de visualización de notificaciones
   - Botón de visualización de backups

### Resultado esperado
- La ventana principal se muestra correctamente
- Todos los elementos están presentes y son visibles

## Prueba 2: Ventana de configuración de CRM

### Objetivo
Verificar que la ventana de configuración de CRM se carga correctamente y permite configurar Google Sheets.

### Pasos
1. Iniciar la aplicación con `npm run electron`
2. Hacer clic en el botón "Configurar CRM"
3. Verificar que la ventana de configuración de CRM se muestra correctamente
4. Verificar que el título de la ventana incluye "Configuración de CRM"
5. Verificar que los siguientes elementos están presentes:
   - Opción de Google Sheets
   - Opción de Bitrix24
   - Campo de ID de Google Sheets
   - Botón de guardar configuración
   - Botón de probar conexión
   - Botón de volver
6. Introducir un ID de Google Sheets válido en el campo correspondiente
7. Hacer clic en el botón "Probar conexión"
8. Verificar que se muestra un mensaje de éxito o error
9. Hacer clic en el botón "Guardar configuración"
10. Verificar que se muestra un mensaje de éxito o error
11. Hacer clic en el botón "Volver"
12. Verificar que la ventana de configuración de CRM se cierra

### Resultado esperado
- La ventana de configuración de CRM se muestra correctamente
- Todos los elementos están presentes y son visibles
- Se puede introducir un ID de Google Sheets
- Se puede probar la conexión con Google Sheets
- Se puede guardar la configuración
- Se puede volver a la ventana principal

## Prueba 3: Filtrado de mensajes

### Objetivo
Verificar que la aplicación filtra correctamente los mensajes de grupos, estados y mensajes antiguos.

### Pasos
1. Iniciar la aplicación con `npm start`
2. Esperar a que la aplicación se conecte a WhatsApp Web
3. Enviar un mensaje a un grupo
4. Verificar que el mensaje no se procesa (no aparece en los logs)
5. Enviar un mensaje a un estado
6. Verificar que el mensaje no se procesa (no aparece en los logs)
7. Enviar un mensaje a un chat individual
8. Verificar que el mensaje se procesa (aparece en los logs)

### Resultado esperado
- Los mensajes de grupos no se procesan
- Los mensajes de estados no se procesan
- Los mensajes de chats individuales se procesan

## Prueba 4: Integración con Google Sheets

### Objetivo
Verificar que la aplicación guarda correctamente los datos en Google Sheets.

### Pasos
1. Iniciar la aplicación con `npm start`
2. Esperar a que la aplicación se conecte a WhatsApp Web
3. Enviar un mensaje a un chat individual con datos estructurados (por ejemplo, "Mi nombre es Juan Pérez, mi correo es juan@ejemplo.com y mi teléfono es 123456789")
4. Verificar que los datos se guardan correctamente en Google Sheets
5. Abrir la hoja de cálculo en Google Sheets
6. Verificar que los datos aparecen en la hoja "Datos"

### Resultado esperado
- Los datos se guardan correctamente en Google Sheets
- Los datos aparecen en la hoja "Datos" con el formato correcto

## Prueba 5: Sistema de notificaciones

### Objetivo
Verificar que la aplicación muestra notificaciones cuando se detecta que un cliente necesita asistencia humana.

### Pasos
1. Iniciar la aplicación con `npm start`
2. Esperar a que la aplicación se conecte a WhatsApp Web
3. Enviar un mensaje a un chat individual con sentimiento negativo (por ejemplo, "Estoy muy molesto con el servicio, necesito hablar con un supervisor urgentemente")
4. Verificar que se muestra una notificación
5. Hacer clic en el botón "Notificaciones"
6. Verificar que el mensaje aparece en la lista de notificaciones

### Resultado esperado
- Se muestra una notificación cuando se detecta un mensaje con sentimiento negativo
- El mensaje aparece en la lista de notificaciones
