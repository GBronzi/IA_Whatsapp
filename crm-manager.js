/**
 * crm-manager.js - Módulo para gestionar la integración con Google Sheets
 *
 * Este módulo proporciona una interfaz para interactuar con Google Sheets como CRM.
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// Configuración por defecto
const DEFAULT_CONFIG = {
    googleSheets: {
        docId: process.env.SPREADSHEET_ID || '',
        credentials: null,
        sheetIndex: 0,
        dataSheetIndex: 1 // Índice de la hoja de datos de clientes (segunda hoja)
    },
    configFile: path.join(__dirname, 'crm-config.json')
};

// Estado del CRM
let crmConfig = { ...DEFAULT_CONFIG };
let googleSheet = null;

/**
 * Inicializa el gestor de CRM con Google Sheets
 * @param {Object} config - Configuración personalizada
 * @returns {Promise<Object>} - Instancia del gestor de CRM
 */
async function initialize(config = {}) {
    try {
        // Depuración: Mostrar la configuración recibida
        logger.info(`CRM Manager: Configuración recibida: ${JSON.stringify(config)}`);
        logger.info(`CRM Manager: SPREADSHEET_ID en .env: ${process.env.SPREADSHEET_ID}`);

        // Combinar configuración por defecto con la personalizada
        if (config.googleSheets) {
            crmConfig.googleSheets = { ...DEFAULT_CONFIG.googleSheets, ...config.googleSheets };
        }

        // Asegurarse de que se use SPREADSHEET_ID si está disponible
        if (process.env.SPREADSHEET_ID && (!crmConfig.googleSheets.docId || crmConfig.googleSheets.docId === '')) {
            crmConfig.googleSheets.docId = process.env.SPREADSHEET_ID;
            logger.info(`CRM Manager: Usando SPREADSHEET_ID del archivo .env: ${process.env.SPREADSHEET_ID}`);
        }

        // Cargar configuración desde archivo
        await loadConfig();

        // Inicializar Google Sheets
        await initializeGoogleSheets();

        return module.exports;
    } catch (error) {
        logger.error(`CRM Manager: Error al inicializar: ${error.message}`);
        return module.exports;
    }
}

/**
 * Carga la configuración desde un archivo
 * @returns {Promise<void>}
 */
async function loadConfig() {
    try {
        // Verificar si existe el archivo de configuración
        try {
            await fs.access(crmConfig.configFile);
        } catch (error) {
            // Si no existe, crear uno con valores por defecto
            await saveConfig();
            return;
        }

        // Leer archivo de configuración
        const data = await fs.readFile(crmConfig.configFile, 'utf8');
        const config = JSON.parse(data);

        // Actualizar configuración
        crmConfig = {
            ...crmConfig,
            ...config
        };

        logger.info('CRM Manager: Configuración cargada correctamente');
    } catch (error) {
        logger.error(`CRM Manager: Error al cargar configuración: ${error.message}`);
    }
}

/**
 * Guarda la configuración en un archivo
 * @returns {Promise<void>}
 */
async function saveConfig() {
    try {
        await fs.writeFile(crmConfig.configFile, JSON.stringify(crmConfig, null, 2));
        logger.info('CRM Manager: Configuración guardada correctamente');
    } catch (error) {
        logger.error(`CRM Manager: Error al guardar configuración: ${error.message}`);
    }
}

/**
 * Inicializa la integración con Google Sheets
 * @returns {Promise<boolean>} - true si la inicialización fue exitosa
 */
async function initializeGoogleSheets() {
    try {
        // Depuración: Mostrar el ID del documento
        logger.info(`CRM Manager: ID del documento configurado: "${crmConfig.googleSheets.docId}"`);
        logger.info(`CRM Manager: Variables de entorno: SPREADSHEET_ID="${process.env.SPREADSHEET_ID}", GOOGLE_SHEET_ID="${process.env.GOOGLE_SHEET_ID}"`);

        // Usar SPREADSHEET_ID directamente si está disponible
        const docId = process.env.SPREADSHEET_ID || crmConfig.googleSheets.docId;

        // Verificar ID del documento
        if (!docId) {
            logger.warn('CRM Manager: No se ha configurado el ID del documento de Google Sheets');
            logger.warn('Por favor, configura GOOGLE_SHEET_ID en el archivo .env o en la interfaz de configuración de CRM');
            return false;
        }

        // Actualizar la configuración con el ID correcto
        crmConfig.googleSheets.docId = docId;
        logger.info(`CRM Manager: Usando ID de documento: ${docId}`);

        // Intentar autenticar con credenciales
        let authSuccess = false;
        let authMethod = '';
        let serviceAccountAuth = null;

        // 1. Intentar con credenciales proporcionadas en la configuración
        if (crmConfig.googleSheets.credentials) {
            try {
                serviceAccountAuth = new JWT({
                    email: crmConfig.googleSheets.credentials.client_email,
                    key: crmConfig.googleSheets.credentials.private_key,
                    scopes: ['https://www.googleapis.com/auth/spreadsheets']
                });
                authSuccess = true;
                authMethod = 'credenciales en configuración';
            } catch (authError) {
                logger.warn(`CRM Manager: Error al autenticar con credenciales en configuración: ${authError.message}`);
            }
        }

        // 2. Intentar con variables de entorno si el método anterior falló
        if (!authSuccess && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
            try {
                serviceAccountAuth = new JWT({
                    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                    scopes: ['https://www.googleapis.com/auth/spreadsheets']
                });
                authSuccess = true;
                authMethod = 'variables de entorno';
            } catch (authError) {
                logger.warn(`CRM Manager: Error al autenticar con variables de entorno: ${authError.message}`);
            }
        }

        // 3. Intentar con archivo de credenciales
        if (!authSuccess) {
            try {
                const fs = require('fs');
                const path = require('path');
                const credentialsPath = path.resolve(process.env.CREDENTIALS_PATH || './credentials.json');

                // Verificar si existe el archivo
                if (fs.existsSync(credentialsPath)) {
                    const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
                    const credentials = JSON.parse(credentialsContent);

                    // Verificar que el archivo tiene el formato correcto
                    if (credentials.type === 'service_account' && credentials.client_email && credentials.private_key) {
                        serviceAccountAuth = new JWT({
                            email: credentials.client_email,
                            key: credentials.private_key,
                            scopes: ['https://www.googleapis.com/auth/spreadsheets']
                        });
                        authSuccess = true;
                        authMethod = `archivo de credenciales (${credentialsPath})`;
                    } else {
                        logger.warn(`CRM Manager: El archivo de credenciales no tiene el formato correcto. Debe ser un archivo de cuenta de servicio.`);
                    }
                } else {
                    logger.warn(`CRM Manager: No se encontró el archivo de credenciales en ${credentialsPath}`);
                }
            } catch (authError) {
                logger.warn(`CRM Manager: Error al autenticar con archivo de credenciales: ${authError.message}`);
            }
        }

        // Crear instancia de Google Sheets con la autenticación
        if (authSuccess && serviceAccountAuth) {
            googleSheet = new GoogleSpreadsheet(crmConfig.googleSheets.docId, serviceAccountAuth);
        } else {
            logger.error('CRM Manager: No se pudo crear la instancia de Google Sheets porque no se pudo autenticar');
            return false;
        }

        // Cargar información del documento
        try {
            // En la versión 4 de google-spreadsheet, necesitamos llamar a loadInfo() para cargar la información del documento
            await googleSheet.loadInfo();
            logger.info(`CRM Manager: Google Sheets inicializado correctamente. Documento: ${googleSheet.title}`);
            logger.info(`CRM Manager: Autenticado con ${authMethod}`);

            // Verificar si existen las hojas necesarias
            let sheetsInfo = 'Hojas disponibles: ';
            googleSheet.sheetsByIndex.forEach((sheet, index) => {
                sheetsInfo += `${index}: ${sheet.title}, `;
            });
            logger.info(sheetsInfo.slice(0, -2));

            return true;
        } catch (loadError) {
            logger.error(`CRM Manager: Error al cargar información del documento: ${loadError.message}`);
            logger.error('Posibles causas:');
            logger.error('1. El ID del documento es incorrecto');
            logger.error('2. La cuenta de servicio no tiene permisos para acceder al documento');
            logger.error('3. El documento no existe');

            googleSheet = null;
            return false;
        }
    } catch (error) {
        logger.error(`CRM Manager: Error al inicializar Google Sheets: ${error.message}`);
        googleSheet = null;
        return false;
    }
}

/**
 * Guarda un mensaje en Google Sheets
 * @param {Object} data - Datos del mensaje
 * @returns {Promise<boolean>} - true si se guardó correctamente
 */
async function saveMessageToSheet(data) {
    try {
        // Verificar si Google Sheets está inicializado
        if (!googleSheet) {
            logger.warn('CRM Manager: Google Sheets no está inicializado');
            logger.warn('Intenta reiniciar la aplicación o verificar la configuración de Google Sheets');
            return false;
        }

        // Obtener hoja de cálculo
        let sheet;
        try {
            sheet = googleSheet.sheetsByIndex[crmConfig.googleSheets.sheetIndex];
            if (!sheet) {
                throw new Error(`No se encontró la hoja en el índice ${crmConfig.googleSheets.sheetIndex}`);
            }
        } catch (sheetError) {
            // Intentar crear la hoja si no existe
            try {
                logger.warn(`CRM Manager: No se encontró la hoja de mensajes. Intentando crear una nueva...`);
                sheet = await googleSheet.addSheet({
                    title: 'Mensajes',
                    headerValues: ['Timestamp', 'ChatId', 'Nombre', 'Mensaje', 'Tipo', 'Sentimiento']
                });
                logger.info(`CRM Manager: Hoja 'Mensajes' creada correctamente`);
            } catch (createError) {
                logger.error(`CRM Manager: Error al crear hoja de mensajes: ${createError.message}`);
                return false;
            }
        }

        // Preparar datos
        const row = {
            Timestamp: new Date().toISOString(),
            ChatId: data.chatId || '',
            Nombre: data.nombre || '',
            Mensaje: data.mensaje || '',
            Tipo: data.tipo || ''
        };

        // Añadir sentimiento si está disponible
        if (data.sentimentInfo) {
            row.Sentimiento = `${data.sentimentInfo.sentiment} (${data.sentimentInfo.score})`;
        }

        // Añadir fila
        try {
            await sheet.addRow(row);
            logger.info(`CRM Manager: Mensaje guardado en Google Sheets (hoja: ${sheet.title})`);
            return true;
        } catch (addRowError) {
            // Verificar si es un error de permisos
            if (addRowError.message.includes('permission') || addRowError.message.includes('access')) {
                logger.error(`CRM Manager: Error de permisos al guardar mensaje en Google Sheets. Asegúrate de que la cuenta de servicio tiene permisos de edición.`);
            } else {
                logger.error(`CRM Manager: Error al añadir fila a Google Sheets: ${addRowError.message}`);
            }
            return false;
        }
    } catch (error) {
        logger.error(`CRM Manager: Error al guardar mensaje en Google Sheets: ${error.message}`);
        return false;
    }
}

/**
 * Sincroniza los datos de un cliente con Google Sheets
 * @param {Object} clientData - Datos del cliente
 * @returns {Promise<Object>} - Resultado de la sincronización
 */
async function syncClientData(clientData) {
    try {
        const results = {
            success: false,
            googleSheets: null
        };

        // Sincronizar con Google Sheets
        try {
            const sheetResult = await saveClientToSheet(clientData);
            results.googleSheets = {
                success: sheetResult,
                message: sheetResult ? 'Datos guardados en Google Sheets' : 'Error al guardar en Google Sheets'
            };

            if (sheetResult) {
                results.success = true;
            }
        } catch (error) {
            results.googleSheets = {
                success: false,
                message: `Error: ${error.message}`
            };
        }

        return results;
    } catch (error) {
        logger.error(`CRM Manager: Error al sincronizar datos del cliente: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Guarda los datos de un cliente en Google Sheets
 * @param {Object} clientData - Datos del cliente
 * @returns {Promise<boolean>} - true si se guardó correctamente
 */
async function saveClientToSheet(clientData) {
    try {
        // Verificar si Google Sheets está inicializado
        if (!googleSheet) {
            logger.warn('CRM Manager: Google Sheets no está inicializado');
            logger.warn('Intenta reiniciar la aplicación o verificar la configuración de Google Sheets');
            return false;
        }

        // Obtener hoja de cálculo para datos de clientes (segunda hoja, índice 1)
        let sheet;
        const dataSheetIndex = crmConfig.googleSheets.dataSheetIndex || 1; // Por defecto, usar la segunda hoja

        try {
            // Intentar obtener la hoja de datos (segunda hoja)
            if (googleSheet.sheetsByIndex.length > dataSheetIndex) {
                sheet = googleSheet.sheetsByIndex[dataSheetIndex];
            } else if (googleSheet.sheetsByIndex.length > 0) {
                // Si no hay segunda hoja pero hay al menos una, usar la primera
                sheet = googleSheet.sheetsByIndex[0];
                logger.warn(`CRM Manager: No se encontró la hoja de datos en el índice ${dataSheetIndex}, usando la hoja principal`);
            } else {
                throw new Error('No hay hojas disponibles en el documento');
            }
        } catch (sheetError) {
            // Intentar crear la hoja si no existe
            try {
                logger.warn(`CRM Manager: No se encontró la hoja de datos de clientes. Intentando crear una nueva...`);
                sheet = await googleSheet.addSheet({
                    title: 'Datos',
                    headerValues: [
                        'Timestamp', 'ChatId', 'Nombre', 'Apellido', 'Telefono',
                        'Correo', 'Curso', 'Producto', 'Monto', 'Comentarios'
                    ]
                });
                logger.info(`CRM Manager: Hoja 'Datos' creada correctamente`);
            } catch (createError) {
                logger.error(`CRM Manager: Error al crear hoja de datos: ${createError.message}`);

                // Intentar usar la primera hoja como último recurso
                if (googleSheet.sheetsByIndex.length > 0) {
                    sheet = googleSheet.sheetsByIndex[0];
                    logger.warn(`CRM Manager: Usando la primera hoja disponible como alternativa`);
                } else {
                    return false;
                }
            }
        }

        // Preparar datos
        const row = {
            Timestamp: new Date().toISOString(),
            ChatId: clientData.chatId || clientData.telefono || '',
            Nombre: clientData.nombre || '',
            Apellido: clientData.apellido || '',
            Telefono: clientData.telefono || '',
            Correo: clientData.correo || '',
            Curso: clientData.curso || '',
            Producto: clientData.producto || '',
            Monto: clientData.monto || '',
            Comentarios: clientData.comentarios || ''
        };

        // Añadir fila
        try {
            await sheet.addRow(row);
            logger.info(`CRM Manager: Datos de cliente guardados en Google Sheets (hoja: ${sheet.title})`);

            // Guardar el índice de la hoja de datos para futuros usos
            if (crmConfig.googleSheets.dataSheetIndex !== googleSheet.sheetsByIndex.indexOf(sheet)) {
                crmConfig.googleSheets.dataSheetIndex = googleSheet.sheetsByIndex.indexOf(sheet);
                await saveConfig();
            }

            return true;
        } catch (addRowError) {
            // Verificar si es un error de permisos
            if (addRowError.message.includes('permission') || addRowError.message.includes('access')) {
                logger.error(`CRM Manager: Error de permisos al guardar datos en Google Sheets. Asegúrate de que la cuenta de servicio tiene permisos de edición.`);
            } else {
                logger.error(`CRM Manager: Error al añadir fila a Google Sheets: ${addRowError.message}`);
            }
            return false;
        }
    } catch (error) {
        logger.error(`CRM Manager: Error al guardar datos de cliente en Google Sheets: ${error.message}`);
        return false;
    }
}

/**
 * Obtiene la lista de productos/servicios
 * @returns {Promise<Array>} - Lista de productos
 */
async function getProducts() {
    try {
        // Intentar obtener productos de Bitrix24
        if ((crmConfig.activeCrm === 'bitrix24' || crmConfig.activeCrm === 'both') && bitrix24 && crmConfig.bitrix24.enabled) {
            try {
                const products = await bitrix24.getProducts();
                if (products && products.length > 0) {
                    return products;
                }
            } catch (error) {
                logger.error(`CRM Manager: Error al obtener productos de Bitrix24: ${error.message}`);
            }
        }

        // Si no hay productos en Bitrix24 o no está activo, obtener de Google Sheets
        if (crmConfig.activeCrm === 'googleSheets' || crmConfig.activeCrm === 'both') {
            try {
                return await getProductsFromSheet();
            } catch (error) {
                logger.error(`CRM Manager: Error al obtener productos de Google Sheets: ${error.message}`);
            }
        }

        // Si no se pudo obtener de ningún CRM, devolver array vacío
        return [];
    } catch (error) {
        logger.error(`CRM Manager: Error al obtener productos: ${error.message}`);
        return [];
    }
}

/**
 * Obtiene la lista de productos/servicios desde Google Sheets
 * @returns {Promise<Array>} - Lista de productos
 */
async function getProductsFromSheet() {
    try {
        if (!googleSheet) {
            logger.warn('CRM Manager: Google Sheets no está inicializado');
            return [];
        }

        // Intentar obtener hoja de productos (índice 1)
        let productsSheet;
        try {
            productsSheet = googleSheet.sheetsByIndex[1]; // Asumimos que la hoja de productos es la segunda
        } catch (error) {
            logger.warn('CRM Manager: No se encontró la hoja de productos');
            return [];
        }

        if (!productsSheet) {
            return [];
        }

        // Cargar filas
        const rows = await productsSheet.getRows();

        // Convertir a formato de productos
        return rows.map(row => ({
            ID: row.ID || row.id || row._rowNumber,
            NAME: row.Nombre || row.Producto || row.NAME || '',
            DESCRIPTION: row.Descripcion || row.DESCRIPTION || '',
            PRICE: row.Precio || row.PRICE || '0',
            CURRENCY_ID: row.Moneda || row.CURRENCY_ID || 'EUR'
        }));
    } catch (error) {
        logger.error(`CRM Manager: Error al obtener productos de Google Sheets: ${error.message}`);
        return [];
    }
}

/**
 * Obtiene información de producto por nombre o ID
 * @param {string|number} nameOrId - Nombre o ID del producto
 * @returns {Promise<Object|null>} - Información del producto
 */
async function getProductInfo(nameOrId) {
    try {
        const products = await getProducts();

        // Buscar por ID
        if (typeof nameOrId === 'number') {
            return products.find(p => p.ID === nameOrId) || null;
        }

        // Buscar por nombre (parcial)
        const nameLower = nameOrId.toLowerCase();
        return products.find(p => p.NAME.toLowerCase().includes(nameLower)) || null;
    } catch (error) {
        logger.error(`CRM Manager: Error al obtener información de producto: ${error.message}`);
        return null;
    }
}

/**
 * Obtiene información formateada de todos los productos
 * @returns {Promise<string>} - Información formateada
 */
async function getFormattedProductsInfo() {
    try {
        const products = await getProducts();

        if (products.length === 0) {
            return 'No hay productos disponibles.';
        }

        let result = '';
        products.forEach(product => {
            result += `- ${product.NAME}: ${product.PRICE} ${product.CURRENCY_ID}\n`;
            if (product.DESCRIPTION) {
                result += `  ${product.DESCRIPTION}\n`;
            }
            result += '\n';
        });

        return result;
    } catch (error) {
        logger.error(`CRM Manager: Error al obtener información formateada de productos: ${error.message}`);
        return 'Error al obtener información de productos.';
    }
}

/**
 * Verifica las credenciales de Google Sheets
 * @returns {Promise<Object>} - Resultado de la verificación
 */
async function testGoogleSheetsCredentials() {
    try {
        // Verificar ID del documento
        if (!crmConfig.googleSheets.docId) {
            return {
                success: false,
                message: 'No se ha configurado el ID del documento de Google Sheets',
                details: 'Configura GOOGLE_SHEET_ID en el archivo .env o en la interfaz de configuración de CRM'
            };
        }

        // Crear instancia temporal de Google Sheets
        const tempSheet = new GoogleSpreadsheet(crmConfig.googleSheets.docId);

        // Intentar autenticar con credenciales
        let authSuccess = false;
        let authMethod = '';
        let authError = null;

        // 1. Intentar con credenciales proporcionadas en la configuración
        if (crmConfig.googleSheets.credentials) {
            try {
                await tempSheet.useServiceAccountAuth(crmConfig.googleSheets.credentials);
                authSuccess = true;
                authMethod = 'credenciales en configuración';
            } catch (error) {
                authError = `Error con credenciales en configuración: ${error.message}`;
            }
        }

        // 2. Intentar con variables de entorno si el método anterior falló
        if (!authSuccess && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
            try {
                await tempSheet.useServiceAccountAuth({
                    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
                });
                authSuccess = true;
                authMethod = 'variables de entorno';
            } catch (error) {
                if (authError) authError += '\n';
                authError += `Error con variables de entorno: ${error.message}`;
            }
        }

        // 3. Intentar con archivo de credenciales
        if (!authSuccess) {
            try {
                const fs = require('fs');
                const path = require('path');
                const credentialsPath = path.resolve(process.env.CREDENTIALS_PATH || './credentials.json');

                // Verificar si existe el archivo
                if (fs.existsSync(credentialsPath)) {
                    const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
                    const credentials = JSON.parse(credentialsContent);

                    // Verificar que el archivo tiene el formato correcto
                    if (credentials.type === 'service_account' && credentials.client_email && credentials.private_key) {
                        await tempSheet.useServiceAccountAuth(credentials);
                        authSuccess = true;
                        authMethod = `archivo de credenciales (${credentialsPath})`;
                    } else {
                        if (authError) authError += '\n';
                        authError += 'El archivo de credenciales no tiene el formato correcto. Debe ser un archivo de cuenta de servicio.';
                    }
                } else {
                    if (authError) authError += '\n';
                    authError += `No se encontró el archivo de credenciales en ${credentialsPath}`;
                }
            } catch (error) {
                if (authError) authError += '\n';
                authError += `Error con archivo de credenciales: ${error.message}`;
            }
        }

        // Si no se pudo autenticar
        if (!authSuccess) {
            return {
                success: false,
                message: 'Error de autenticación con Google Sheets',
                details: authError || 'No se pudo autenticar con ninguno de los métodos disponibles'
            };
        }

        // Intentar cargar información del documento
        try {
            await tempSheet.loadInfo();

            // Obtener información de las hojas
            const sheetsInfo = tempSheet.sheetsByIndex.map((sheet, index) => {
                return `${index}: ${sheet.title} (${sheet.rowCount} filas)`;
            }).join(', ');

            return {
                success: true,
                message: `Conexión exitosa con Google Sheets (${tempSheet.title})`,
                details: `Autenticado con ${authMethod}\nHojas disponibles: ${sheetsInfo}`,
                sheetTitle: tempSheet.title,
                sheetsCount: tempSheet.sheetsByIndex.length,
                sheetsInfo: tempSheet.sheetsByIndex.map(sheet => ({
                    title: sheet.title,
                    index: tempSheet.sheetsByIndex.indexOf(sheet),
                    rowCount: sheet.rowCount,
                    columnCount: sheet.columnCount
                }))
            };
        } catch (error) {
            return {
                success: false,
                message: `Error al cargar información del documento: ${error.message}`,
                details: 'Posibles causas:\n1. El ID del documento es incorrecto\n2. La cuenta de servicio no tiene permisos para acceder al documento\n3. El documento no existe'
            };
        }
    } catch (error) {
        return {
            success: false,
            message: `Error al verificar credenciales: ${error.message}`,
            details: error.stack
        };
    }
}

/**
 * Prueba la conexión con Google Sheets
 * @returns {Promise<Object>} - Resultado de la prueba
 */
async function testConnection() {
    const result = {
        success: false,
        message: '',
        googleSheets: null
    };

    // Probar Google Sheets
    result.googleSheets = await testGoogleSheetsCredentials();

    // Determinar resultado general
    result.success = result.googleSheets?.success || false;
    result.message = result.googleSheets?.message || 'Error al conectar con Google Sheets';

    return result;
}

/**
 * Obtiene el estado actual del CRM
 * @returns {Object} - Estado del CRM
 */
function getCrmStatus() {
    return {
        googleSheets: {
            initialized: googleSheet !== null,
            docId: crmConfig.googleSheets.docId,
            connected: googleSheet !== null,
            message: googleSheet !== null ? 'Conectado' : 'No conectado'
        }
    };
}

/**
 * Establece Google Sheets como CRM activo
 * @returns {Promise<boolean>} - true si se estableció correctamente
 */
async function setCrmType() {
    try {
        // Inicializar Google Sheets si no está inicializado
        if (!googleSheet) {
            await initializeGoogleSheets();
        }

        // Guardar configuración
        await saveConfig();

        logger.info('CRM Manager: Google Sheets establecido como CRM');
        return true;
    } catch (error) {
        logger.error(`CRM Manager: Error al establecer Google Sheets como CRM: ${error.message}`);
        return false;
    }
}

/**
 * Actualiza la configuración del CRM
 * @param {Object} config - Nueva configuración
 * @returns {Promise<boolean>} - true si la configuración se actualizó correctamente
 */
async function updateConfig(config) {
    try {
        // Guardar configuración anterior para comparar cambios
        const oldConfig = { ...crmConfig };

        // Actualizar configuración
        crmConfig = {
            ...crmConfig,
            ...config
        };

        // Guardar configuración
        await saveConfig();

        // Verificar si cambió el CRM activo
        if (oldConfig.activeCrm !== crmConfig.activeCrm) {
            await setCrmType(crmConfig.activeCrm);
        }

        // Verificar si cambiaron las credenciales de Google Sheets
        if (oldConfig.googleSheets.docId !== crmConfig.googleSheets.docId ||
            JSON.stringify(oldConfig.googleSheets.credentials) !== JSON.stringify(crmConfig.googleSheets.credentials)) {
            // Reinicializar Google Sheets
            if (crmConfig.activeCrm === 'googleSheets' || crmConfig.activeCrm === 'both') {
                await initializeGoogleSheets();
            }
        }

        // Verificar si cambiaron las credenciales de Bitrix24
        if (oldConfig.bitrix24.webhook !== crmConfig.bitrix24.webhook ||
            oldConfig.bitrix24.enabled !== crmConfig.bitrix24.enabled) {
            // Reinicializar Bitrix24
            if ((crmConfig.activeCrm === 'bitrix24' || crmConfig.activeCrm === 'both') && crmConfig.bitrix24.enabled) {
                await initializeBitrix24();
            }
        }

        logger.info('CRM Manager: Configuración actualizada correctamente');
        return true;
    } catch (error) {
        logger.error(`CRM Manager: Error al actualizar configuración: ${error.message}`);
        return false;
    }
}

module.exports = {
    initialize,
    testConnection,
    getCrmStatus,
    getConfig: () => ({ ...crmConfig }),
    updateConfig,
    setCrmType,
    saveMessageToSheet,
    saveClientToSheet,
    syncClientData,
    getProducts,
    getProductInfo,
    getFormattedProductsInfo
};

