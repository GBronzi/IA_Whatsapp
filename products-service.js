/**
 * products-service.js - Servicio para gestionar productos y servicios
 *
 * Este servicio puede obtener productos tanto del archivo local como del CRM configurado.
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');
const config = require('./config');

// Referencia al gestor de CRM (se establecerá en initialize)
let crmManager = null;

// Ruta al archivo de configuración de productos
const PRODUCTS_CONFIG_PATH = path.join(__dirname, 'products-config.json');

// Caché en memoria
let productsCache = null;
let lastLoadTime = 0;
const CACHE_TTL = 3600000; // 1 hora en milisegundos

/**
 * Inicializa el servicio de productos
 * @param {Object} crm - Instancia del gestor de CRM
 */
function initialize(crm) {
    crmManager = crm;
    logger.info('Servicio de productos inicializado' + (crmManager ? ' con gestor de CRM' : ''));
}

/**
 * Carga la configuración de productos desde el archivo
 * @param {boolean} forceReload - Forzar recarga desde archivo
 * @returns {Promise<Object>} - Configuración de productos
 */
async function loadProductsConfig(forceReload = false) {
    try {
        const now = Date.now();

        // Usar caché si está disponible y no ha expirado
        if (productsCache && !forceReload && (now - lastLoadTime < CACHE_TTL)) {
            return productsCache;
        }

        // Cargar desde archivo
        const data = await fs.readFile(PRODUCTS_CONFIG_PATH, 'utf8');
        productsCache = JSON.parse(data);
        lastLoadTime = now;

        logger.info('Configuración de productos cargada correctamente');
        return productsCache;
    } catch (error) {
        logger.error(`Error al cargar configuración de productos: ${error.message}`);

        // Si no se puede cargar, devolver un objeto vacío
        return {
            business: {
                name: config.BUSINESS_NAME || 'Tu Empresa'
            },
            categories: [],
            promotions: [],
            payment_methods: []
        };
    }
}

/**
 * Obtiene todos los productos disponibles
 * @returns {Promise<Array>} - Lista de productos
 */
async function getAllProducts() {
    try {
        // Intentar obtener productos del CRM si está disponible
        if (crmManager && crmManager.getProducts) {
            try {
                const crmProducts = await crmManager.getProducts();
                if (crmProducts && crmProducts.length > 0) {
                    logger.info(`Obtenidos ${crmProducts.length} productos desde el CRM`);
                    return crmProducts;
                }
            } catch (error) {
                logger.warn(`Error al obtener productos desde el CRM: ${error.message}`);
            }
        }

        // Si no hay productos en el CRM o hubo un error, usar el archivo local
        const productsConfig = await loadProductsConfig();

        // Aplanar la estructura para obtener todos los productos
        const allProducts = [];

        if (productsConfig.categories) {
            productsConfig.categories.forEach(category => {
                if (category.products) {
                    category.products.forEach(product => {
                        allProducts.push({
                            ...product,
                            category: {
                                id: category.id,
                                name: category.name
                            }
                        });
                    });
                }
            });
        }

        logger.info(`Obtenidos ${allProducts.length} productos desde el archivo local`);
        return allProducts;
    } catch (error) {
        logger.error(`Error al obtener productos: ${error.message}`);
        return [];
    }
}

/**
 * Busca productos por nombre o descripción
 * @param {string} query - Texto a buscar
 * @returns {Promise<Array>} - Productos encontrados
 */
async function searchProducts(query) {
    if (!query) return [];

    const allProducts = await getAllProducts();
    const lowerQuery = query.toLowerCase();

    return allProducts.filter(product => {
        return (
            product.name.toLowerCase().includes(lowerQuery) ||
            product.description.toLowerCase().includes(lowerQuery) ||
            (product.category && product.category.name.toLowerCase().includes(lowerQuery))
        );
    });
}

/**
 * Obtiene un producto por su ID
 * @param {string} productId - ID del producto
 * @returns {Promise<Object|null>} - Producto encontrado o null
 */
async function getProductById(productId) {
    const allProducts = await getAllProducts();
    return allProducts.find(product => product.id === productId) || null;
}

/**
 * Obtiene productos por categoría
 * @param {string} categoryId - ID de la categoría
 * @returns {Promise<Array>} - Productos de la categoría
 */
async function getProductsByCategory(categoryId) {
    const productsConfig = await loadProductsConfig();

    const category = productsConfig.categories.find(cat => cat.id === categoryId);
    if (!category || !category.products) return [];

    return category.products.map(product => ({
        ...product,
        category: {
            id: category.id,
            name: category.name
        }
    }));
}

/**
 * Obtiene todas las promociones disponibles
 * @returns {Promise<Array>} - Lista de promociones
 */
async function getPromotions() {
    const productsConfig = await loadProductsConfig();
    return productsConfig.promotions || [];
}

/**
 * Obtiene todos los métodos de pago disponibles
 * @returns {Promise<Array>} - Lista de métodos de pago
 */
async function getPaymentMethods() {
    const productsConfig = await loadProductsConfig();
    return productsConfig.payment_methods || [];
}

/**
 * Genera un texto formateado con información de productos
 * @param {string} categoryId - ID de categoría (opcional)
 * @returns {Promise<string>} - Texto formateado
 */
async function getFormattedProductsInfo(categoryId = null) {
    try {
        // Intentar usar el gestor de CRM si está disponible
        if (crmManager && crmManager.getFormattedProductsInfo) {
            try {
                const crmFormattedInfo = await crmManager.getFormattedProductsInfo(categoryId);
                if (crmFormattedInfo && crmFormattedInfo !== 'Error al obtener información de productos.') {
                    logger.info('Obtenida información formateada de productos desde el CRM');
                    return crmFormattedInfo;
                }
            } catch (error) {
                logger.warn(`Error al obtener información formateada desde el CRM: ${error.message}`);
            }
        }

        // Si no se pudo obtener del CRM, usar la implementación local
        let products;

        if (categoryId) {
            products = await getProductsByCategory(categoryId);
        } else {
            products = await getAllProducts();
        }

        if (products.length === 0) {
            return 'No hay productos disponibles.';
        }

        // Agrupar por categoría
        const productsByCategory = {};

        products.forEach(product => {
            const categoryName = product.category ? product.category.name : 'Otros';

            if (!productsByCategory[categoryName]) {
                productsByCategory[categoryName] = [];
            }

            productsByCategory[categoryName].push(product);
        });

        // Generar texto formateado
        let result = '';

        for (const [categoryName, categoryProducts] of Object.entries(productsByCategory)) {
            result += `== ${categoryName} ==\n\n`;

            categoryProducts.forEach(product => {
                result += `- ${product.name}: ${product.price} ${product.currency || '€'}\n`;
                if (product.description) {
                    result += `  ${product.description}\n`;
                }
                if (product.duration || product.level) {
                    result += `  ${product.duration ? 'Duración: ' + product.duration : ''}${product.duration && product.level ? ', ' : ''}${product.level ? 'Nivel: ' + product.level : ''}\n`;
                }
                if (product.modality && Array.isArray(product.modality) && product.modality.length > 0) {
                    result += `  Modalidades: ${product.modality.join(', ')}\n`;
                }
                result += '\n';
            });
        }

        // Añadir información de promociones
        const promotions = await getPromotions();
        if (promotions.length > 0) {
            result += '== Promociones ==\n\n';

            promotions.forEach(promo => {
                result += `- ${promo.name}: ${promo.description}\n`;
            });

            result += '\n';
        }

        logger.info('Generada información formateada de productos desde el archivo local');
        return result;
    } catch (error) {
        logger.error(`Error al generar información formateada de productos: ${error.message}`);
        return 'Error al obtener información de productos.';
    }
}

/**
 * Obtiene información de la empresa
 * @returns {Promise<Object>} - Información de la empresa
 */
async function getBusinessInfo() {
    const productsConfig = await loadProductsConfig();
    return productsConfig.business || { name: config.BUSINESS_NAME || 'Tu Empresa' };
}

module.exports = {
    initialize,
    loadProductsConfig,
    getAllProducts,
    searchProducts,
    getProductById,
    getProductsByCategory,
    getPromotions,
    getPaymentMethods,
    getFormattedProductsInfo,
    getBusinessInfo
};
