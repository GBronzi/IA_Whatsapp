/**
 * bitrix24-integration.js - Módulo para integración con Bitrix24 CRM
 * 
 * Este módulo proporciona funciones para interactuar con la API REST de Bitrix24,
 * permitiendo sincronizar contactos, leads y oportunidades de venta.
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

// Configuración por defecto
const DEFAULT_CONFIG = {
    webhook: '', // URL del webhook de Bitrix24 (ej: https://your-domain.bitrix24.es/rest/1/your-webhook-code/)
    cacheFile: path.join(__dirname, 'bitrix24-cache.json'),
    cacheTTL: 3600000, // 1 hora en milisegundos
    retryAttempts: 3,
    retryDelay: 1000, // 1 segundo
    timeout: 10000 // 10 segundos
};

// Caché en memoria
let memoryCache = {
    contacts: {},
    leads: {},
    deals: {},
    lastUpdated: {}
};

/**
 * Inicializa la integración con Bitrix24
 * @param {Object} config - Configuración personalizada
 * @returns {Object} - Instancia de la integración
 */
function initialize(config = {}) {
    // Combinar configuración por defecto con la personalizada
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    
    // Validar webhook
    if (!mergedConfig.webhook) {
        logger.warn('Bitrix24: No se ha proporcionado un webhook. La integración no funcionará correctamente.');
    }
    
    // Cargar caché desde archivo
    loadCache(mergedConfig.cacheFile).catch(error => {
        logger.error(`Bitrix24: Error al cargar caché: ${error.message}`);
    });
    
    /**
     * Realiza una petición a la API de Bitrix24
     * @param {string} method - Método de la API
     * @param {Object} params - Parámetros de la petición
     * @returns {Promise<Object>} - Respuesta de la API
     */
    async function apiRequest(method, params = {}) {
        if (!mergedConfig.webhook) {
            throw new Error('No se ha configurado el webhook de Bitrix24');
        }
        
        const url = `${mergedConfig.webhook}${method}`;
        
        // Intentar la petición con reintentos
        let lastError;
        for (let attempt = 0; attempt < mergedConfig.retryAttempts; attempt++) {
            try {
                const response = await axios.post(url, params, {
                    timeout: mergedConfig.timeout,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                // Verificar si la respuesta contiene un error
                if (response.data.error) {
                    throw new Error(`Error de Bitrix24: ${response.data.error} - ${response.data.error_description || ''}`);
                }
                
                return response.data.result;
            } catch (error) {
                lastError = error;
                logger.warn(`Bitrix24: Error en intento ${attempt + 1}/${mergedConfig.retryAttempts}: ${error.message}`);
                
                // Esperar antes de reintentar
                if (attempt < mergedConfig.retryAttempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, mergedConfig.retryDelay));
                }
            }
        }
        
        // Si llegamos aquí, todos los intentos fallaron
        throw lastError;
    }
    
    /**
     * Carga la caché desde un archivo
     * @param {string} filePath - Ruta al archivo de caché
     * @returns {Promise<void>}
     */
    async function loadCache(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            memoryCache = JSON.parse(data);
            logger.info('Bitrix24: Caché cargada correctamente');
        } catch (error) {
            // Si el archivo no existe, crear uno nuevo
            if (error.code === 'ENOENT') {
                await saveCache(filePath);
            } else {
                throw error;
            }
        }
    }
    
    /**
     * Guarda la caché en un archivo
     * @param {string} filePath - Ruta al archivo de caché
     * @returns {Promise<void>}
     */
    async function saveCache(filePath) {
        try {
            await fs.writeFile(filePath, JSON.stringify(memoryCache, null, 2));
            logger.info('Bitrix24: Caché guardada correctamente');
        } catch (error) {
            logger.error(`Bitrix24: Error al guardar caché: ${error.message}`);
        }
    }
    
    /**
     * Verifica si la caché está actualizada
     * @param {string} entity - Entidad (contacts, leads, deals)
     * @returns {boolean} - true si la caché está actualizada
     */
    function isCacheValid(entity) {
        const lastUpdated = memoryCache.lastUpdated[entity];
        if (!lastUpdated) return false;
        
        const now = Date.now();
        return (now - lastUpdated) < mergedConfig.cacheTTL;
    }
    
    /**
     * Busca un contacto por teléfono o email
     * @param {Object} data - Datos del contacto (PHONE, EMAIL)
     * @returns {Promise<Object|null>} - Contacto encontrado o null
     */
    async function findContact(data) {
        try {
            let filter = {};
            
            if (data.PHONE) {
                filter['PHONE'] = data.PHONE;
            } else if (data.EMAIL) {
                filter['EMAIL'] = data.EMAIL;
            } else {
                throw new Error('Se requiere teléfono o email para buscar un contacto');
            }
            
            const result = await apiRequest('crm.contact.list', {
                filter,
                select: ['ID', 'NAME', 'LAST_NAME', 'PHONE', 'EMAIL']
            });
            
            return result.length > 0 ? result[0] : null;
        } catch (error) {
            logger.error(`Bitrix24: Error al buscar contacto: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Crea o actualiza un contacto
     * @param {Object} data - Datos del contacto
     * @returns {Promise<Object>} - Contacto creado o actualizado
     */
    async function createOrUpdateContact(data) {
        try {
            // Buscar contacto existente
            const existingContact = await findContact({
                PHONE: data.PHONE || data.telefono,
                EMAIL: data.EMAIL || data.correo
            });
            
            // Preparar datos
            const contactData = {
                NAME: data.NAME || data.nombre || '',
                LAST_NAME: data.LAST_NAME || data.apellido || '',
                PHONE: [{ VALUE: data.PHONE || data.telefono || '', VALUE_TYPE: 'WORK' }],
                EMAIL: [{ VALUE: data.EMAIL || data.correo || '', VALUE_TYPE: 'WORK' }]
            };
            
            let result;
            
            // Actualizar o crear
            if (existingContact) {
                result = await apiRequest('crm.contact.update', {
                    id: existingContact.ID,
                    fields: contactData
                });
                
                logger.info(`Bitrix24: Contacto actualizado con ID ${existingContact.ID}`);
                return { ...existingContact, ...contactData, ID: existingContact.ID };
            } else {
                result = await apiRequest('crm.contact.add', {
                    fields: contactData
                });
                
                logger.info(`Bitrix24: Contacto creado con ID ${result}`);
                return { ...contactData, ID: result };
            }
        } catch (error) {
            logger.error(`Bitrix24: Error al crear/actualizar contacto: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Crea un lead (oportunidad)
     * @param {Object} data - Datos del lead
     * @returns {Promise<Object>} - Lead creado
     */
    async function createLead(data) {
        try {
            // Preparar datos
            const leadData = {
                TITLE: data.TITLE || `Lead desde WhatsApp: ${data.nombre || 'Cliente'}`,
                NAME: data.NAME || data.nombre || '',
                LAST_NAME: data.LAST_NAME || data.apellido || '',
                PHONE: [{ VALUE: data.PHONE || data.telefono || '', VALUE_TYPE: 'WORK' }],
                EMAIL: [{ VALUE: data.EMAIL || data.correo || '', VALUE_TYPE: 'WORK' }],
                COMMENTS: data.COMMENTS || data.comentarios || `Interesado en: ${data.curso || data.producto || 'No especificado'}`,
                SOURCE_ID: data.SOURCE_ID || 'WHATSAPP',
                SOURCE_DESCRIPTION: data.SOURCE_DESCRIPTION || 'Asistente de Ventas WhatsApp'
            };
            
            const result = await apiRequest('crm.lead.add', {
                fields: leadData
            });
            
            logger.info(`Bitrix24: Lead creado con ID ${result}`);
            return { ...leadData, ID: result };
        } catch (error) {
            logger.error(`Bitrix24: Error al crear lead: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Crea un deal (negocio)
     * @param {Object} data - Datos del deal
     * @returns {Promise<Object>} - Deal creado
     */
    async function createDeal(data) {
        try {
            // Preparar datos
            const dealData = {
                TITLE: data.TITLE || `Venta desde WhatsApp: ${data.nombre || 'Cliente'}`,
                CONTACT_ID: data.CONTACT_ID,
                COMMENTS: data.COMMENTS || data.comentarios || `Producto/Servicio: ${data.curso || data.producto || 'No especificado'}`,
                OPPORTUNITY: data.OPPORTUNITY || data.monto || 0,
                CURRENCY_ID: data.CURRENCY_ID || 'EUR',
                SOURCE_ID: data.SOURCE_ID || 'WHATSAPP',
                SOURCE_DESCRIPTION: data.SOURCE_DESCRIPTION || 'Asistente de Ventas WhatsApp',
                STAGE_ID: data.STAGE_ID || 'NEW'
            };
            
            const result = await apiRequest('crm.deal.add', {
                fields: dealData
            });
            
            logger.info(`Bitrix24: Deal creado con ID ${result}`);
            return { ...dealData, ID: result };
        } catch (error) {
            logger.error(`Bitrix24: Error al crear deal: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Procesa los datos de un cliente y los sincroniza con Bitrix24
     * @param {Object} clientData - Datos del cliente
     * @returns {Promise<Object>} - Resultado de la sincronización
     */
    async function syncClientData(clientData) {
        try {
            // Validar datos mínimos
            if (!clientData.nombre && !clientData.telefono && !clientData.correo) {
                throw new Error('Se requiere al menos nombre, teléfono o correo para sincronizar con Bitrix24');
            }
            
            // 1. Crear o actualizar contacto
            const contact = await createOrUpdateContact({
                nombre: clientData.nombre,
                apellido: clientData.apellido,
                telefono: clientData.telefono,
                correo: clientData.correo
            });
            
            // 2. Crear lead
            const lead = await createLead({
                nombre: clientData.nombre,
                apellido: clientData.apellido,
                telefono: clientData.telefono,
                correo: clientData.correo,
                curso: clientData.curso,
                producto: clientData.producto,
                comentarios: clientData.comentarios
            });
            
            // 3. Si hay información de producto y precio, crear deal
            let deal = null;
            if (clientData.curso || clientData.producto) {
                deal = await createDeal({
                    nombre: clientData.nombre,
                    CONTACT_ID: contact.ID,
                    curso: clientData.curso,
                    producto: clientData.producto,
                    monto: clientData.monto,
                    comentarios: clientData.comentarios
                });
            }
            
            // Guardar caché
            await saveCache(mergedConfig.cacheFile);
            
            return {
                success: true,
                contact,
                lead,
                deal
            };
        } catch (error) {
            logger.error(`Bitrix24: Error al sincronizar datos del cliente: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Obtiene la lista de productos/servicios desde Bitrix24
     * @returns {Promise<Array>} - Lista de productos
     */
    async function getProducts() {
        try {
            // Verificar caché
            if (isCacheValid('products')) {
                return memoryCache.products || [];
            }
            
            const result = await apiRequest('crm.product.list', {
                select: ['ID', 'NAME', 'DESCRIPTION', 'PRICE', 'CURRENCY_ID']
            });
            
            // Actualizar caché
            memoryCache.products = result;
            memoryCache.lastUpdated.products = Date.now();
            await saveCache(mergedConfig.cacheFile);
            
            return result;
        } catch (error) {
            logger.error(`Bitrix24: Error al obtener productos: ${error.message}`);
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
            logger.error(`Bitrix24: Error al obtener información de producto: ${error.message}`);
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
            logger.error(`Bitrix24: Error al obtener información formateada de productos: ${error.message}`);
            return 'Error al obtener información de productos.';
        }
    }
    
    // Retornar API pública
    return {
        findContact,
        createOrUpdateContact,
        createLead,
        createDeal,
        syncClientData,
        getProducts,
        getProductInfo,
        getFormattedProductsInfo,
        apiRequest
    };
}

module.exports = {
    initialize
};
