/**
 * cache-manager.js
 * 
 * Sistema de caché para mejorar el rendimiento de la aplicación.
 * Implementa diferentes estrategias de caché (memoria, disco, LRU) y
 * proporciona una interfaz unificada para su uso.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');
const config = require('./config');

/**
 * Clase para gestionar caché en memoria con política LRU (Least Recently Used)
 */
class LRUCache {
    /**
     * Constructor
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        this.maxSize = options.maxSize || 1000;
        this.ttl = options.ttl || 3600000; // 1 hora por defecto
        this.cache = new Map();
        this.keyTimestamps = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            evictions: 0
        };
    }

    /**
     * Obtiene un valor de la caché
     * @param {string} key - Clave
     * @returns {*} - Valor almacenado o undefined si no existe o ha expirado
     */
    get(key) {
        // Verificar si la clave existe
        if (!this.cache.has(key)) {
            this.stats.misses++;
            return undefined;
        }

        // Verificar si ha expirado
        const timestamp = this.keyTimestamps.get(key);
        if (Date.now() - timestamp > this.ttl) {
            // Eliminar entrada expirada
            this.cache.delete(key);
            this.keyTimestamps.delete(key);
            this.stats.misses++;
            return undefined;
        }

        // Actualizar timestamp (LRU)
        this.keyTimestamps.set(key, Date.now());
        
        // Incrementar contador de aciertos
        this.stats.hits++;
        
        // Devolver valor
        return this.cache.get(key);
    }

    /**
     * Almacena un valor en la caché
     * @param {string} key - Clave
     * @param {*} value - Valor a almacenar
     * @param {number} customTtl - Tiempo de vida personalizado (en ms)
     */
    set(key, value, customTtl) {
        // Incrementar contador de inserciones
        this.stats.sets++;
        
        // Si la caché está llena, eliminar la entrada menos usada recientemente
        if (this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        // Almacenar valor y timestamp
        this.cache.set(key, value);
        this.keyTimestamps.set(key, Date.now());
        
        // Si se especifica un TTL personalizado, programar su eliminación
        if (customTtl) {
            setTimeout(() => {
                this.cache.delete(key);
                this.keyTimestamps.delete(key);
            }, customTtl);
        }
    }

    /**
     * Elimina una entrada de la caché
     * @param {string} key - Clave
     * @returns {boolean} - true si se eliminó, false si no existía
     */
    delete(key) {
        const existed = this.cache.has(key);
        
        if (existed) {
            this.cache.delete(key);
            this.keyTimestamps.delete(key);
        }
        
        return existed;
    }

    /**
     * Elimina todas las entradas de la caché
     */
    clear() {
        this.cache.clear();
        this.keyTimestamps.clear();
    }

    /**
     * Elimina la entrada menos usada recientemente
     */
    evictLRU() {
        if (this.cache.size === 0) {
            return;
        }
        
        // Encontrar la clave con el timestamp más antiguo
        let oldestKey = null;
        let oldestTime = Infinity;
        
        for (const [key, timestamp] of this.keyTimestamps.entries()) {
            if (timestamp < oldestTime) {
                oldestTime = timestamp;
                oldestKey = key;
            }
        }
        
        // Eliminar la entrada más antigua
        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.keyTimestamps.delete(oldestKey);
            this.stats.evictions++;
        }
    }

    /**
     * Obtiene estadísticas de la caché
     * @returns {Object} - Estadísticas
     */
    getStats() {
        return {
            ...this.stats,
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRatio: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
        };
    }
}

/**
 * Clase para gestionar caché en disco
 */
class DiskCache {
    /**
     * Constructor
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        this.directory = options.directory || path.join(process.cwd(), 'cache');
        this.ttl = options.ttl || 86400000; // 24 horas por defecto
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            evictions: 0
        };
        
        // Crear directorio si no existe
        this.ensureDirectoryExists();
    }

    /**
     * Asegura que el directorio de caché exista
     */
    async ensureDirectoryExists() {
        try {
            await fs.mkdir(this.directory, { recursive: true });
        } catch (error) {
            logger.error(`Error al crear directorio de caché: ${error.message}`);
        }
    }

    /**
     * Genera una clave de archivo a partir de una clave
     * @param {string} key - Clave
     * @returns {string} - Ruta del archivo
     */
    getFilePath(key) {
        // Generar hash de la clave para evitar problemas con caracteres especiales
        const hash = crypto.createHash('md5').update(key).digest('hex');
        return path.join(this.directory, `${hash}.json`);
    }

    /**
     * Obtiene un valor de la caché
     * @param {string} key - Clave
     * @returns {Promise<*>} - Valor almacenado o undefined si no existe o ha expirado
     */
    async get(key) {
        try {
            const filePath = this.getFilePath(key);
            
            // Verificar si el archivo existe
            try {
                await fs.access(filePath);
            } catch (error) {
                this.stats.misses++;
                return undefined;
            }
            
            // Leer archivo
            const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
            
            // Verificar si ha expirado
            if (Date.now() - data.timestamp > (data.ttl || this.ttl)) {
                // Eliminar archivo expirado
                await fs.unlink(filePath);
                this.stats.misses++;
                return undefined;
            }
            
            // Incrementar contador de aciertos
            this.stats.hits++;
            
            // Devolver valor
            return data.value;
        } catch (error) {
            logger.error(`Error al obtener valor de caché en disco: ${error.message}`);
            this.stats.misses++;
            return undefined;
        }
    }

    /**
     * Almacena un valor en la caché
     * @param {string} key - Clave
     * @param {*} value - Valor a almacenar
     * @param {number} customTtl - Tiempo de vida personalizado (en ms)
     */
    async set(key, value, customTtl) {
        try {
            // Incrementar contador de inserciones
            this.stats.sets++;
            
            // Crear directorio si no existe
            await this.ensureDirectoryExists();
            
            // Preparar datos
            const data = {
                value,
                timestamp: Date.now(),
                ttl: customTtl || this.ttl
            };
            
            // Escribir archivo
            const filePath = this.getFilePath(key);
            await fs.writeFile(filePath, JSON.stringify(data), 'utf8');
        } catch (error) {
            logger.error(`Error al almacenar valor en caché en disco: ${error.message}`);
        }
    }

    /**
     * Elimina una entrada de la caché
     * @param {string} key - Clave
     * @returns {Promise<boolean>} - true si se eliminó, false si no existía
     */
    async delete(key) {
        try {
            const filePath = this.getFilePath(key);
            
            // Verificar si el archivo existe
            try {
                await fs.access(filePath);
            } catch (error) {
                return false;
            }
            
            // Eliminar archivo
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            logger.error(`Error al eliminar valor de caché en disco: ${error.message}`);
            return false;
        }
    }

    /**
     * Elimina todas las entradas de la caché
     */
    async clear() {
        try {
            // Leer directorio
            const files = await fs.readdir(this.directory);
            
            // Eliminar todos los archivos
            for (const file of files) {
                if (file.endsWith('.json')) {
                    await fs.unlink(path.join(this.directory, file));
                    this.stats.evictions++;
                }
            }
        } catch (error) {
            logger.error(`Error al limpiar caché en disco: ${error.message}`);
        }
    }

    /**
     * Elimina las entradas expiradas de la caché
     */
    async cleanup() {
        try {
            // Leer directorio
            const files = await fs.readdir(this.directory);
            
            // Verificar cada archivo
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.directory, file);
                    
                    try {
                        // Leer archivo
                        const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
                        
                        // Verificar si ha expirado
                        if (Date.now() - data.timestamp > (data.ttl || this.ttl)) {
                            // Eliminar archivo expirado
                            await fs.unlink(filePath);
                            this.stats.evictions++;
                        }
                    } catch (error) {
                        // Si hay error al leer el archivo, eliminarlo
                        await fs.unlink(filePath);
                        this.stats.evictions++;
                    }
                }
            }
        } catch (error) {
            logger.error(`Error al limpiar caché en disco: ${error.message}`);
        }
    }

    /**
     * Obtiene estadísticas de la caché
     * @returns {Promise<Object>} - Estadísticas
     */
    async getStats() {
        try {
            // Leer directorio
            const files = await fs.readdir(this.directory);
            
            // Contar archivos de caché
            const cacheFiles = files.filter(file => file.endsWith('.json'));
            
            return {
                ...this.stats,
                size: cacheFiles.length,
                hitRatio: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
            };
        } catch (error) {
            logger.error(`Error al obtener estadísticas de caché en disco: ${error.message}`);
            return this.stats;
        }
    }
}

/**
 * Clase principal para gestionar la caché
 */
class CacheManager {
    /**
     * Constructor
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        this.options = {
            // Estrategia de caché por defecto
            defaultStrategy: options.defaultStrategy || 'memory',
            // Configuración de caché en memoria
            memory: {
                enabled: options.memory?.enabled !== false,
                maxSize: options.memory?.maxSize || 1000,
                ttl: options.memory?.ttl || 3600000 // 1 hora
            },
            // Configuración de caché en disco
            disk: {
                enabled: options.disk?.enabled === true,
                directory: options.disk?.directory || path.join(process.cwd(), 'cache'),
                ttl: options.disk?.ttl || 86400000 // 24 horas
            },
            // Prefijo para las claves de caché
            keyPrefix: options.keyPrefix || 'cache:'
        };

        // Inicializar cachés
        this.caches = {};
        
        if (this.options.memory.enabled) {
            this.caches.memory = new LRUCache({
                maxSize: this.options.memory.maxSize,
                ttl: this.options.memory.ttl
            });
        }
        
        if (this.options.disk.enabled) {
            this.caches.disk = new DiskCache({
                directory: this.options.disk.directory,
                ttl: this.options.disk.ttl
            });
        }
        
        // Programar limpieza periódica
        if (this.options.disk.enabled) {
            setInterval(() => {
                this.caches.disk.cleanup().catch(error => {
                    logger.error(`Error en limpieza periódica de caché en disco: ${error.message}`);
                });
            }, 3600000); // Cada hora
        }
        
        logger.info('Gestor de caché inicializado');
    }

    /**
     * Genera una clave con prefijo
     * @param {string} key - Clave original
     * @returns {string} - Clave con prefijo
     */
    getPrefixedKey(key) {
        return `${this.options.keyPrefix}${key}`;
    }

    /**
     * Obtiene un valor de la caché
     * @param {string} key - Clave
     * @param {string} strategy - Estrategia de caché ('memory', 'disk')
     * @returns {Promise<*>} - Valor almacenado o undefined si no existe
     */
    async get(key, strategy = this.options.defaultStrategy) {
        const prefixedKey = this.getPrefixedKey(key);
        
        // Verificar si la estrategia existe
        if (!this.caches[strategy]) {
            logger.warn(`Estrategia de caché '${strategy}' no disponible`);
            return undefined;
        }
        
        // Obtener valor de la caché
        const cache = this.caches[strategy];
        
        if (strategy === 'memory') {
            return cache.get(prefixedKey);
        } else if (strategy === 'disk') {
            return await cache.get(prefixedKey);
        }
        
        return undefined;
    }

    /**
     * Almacena un valor en la caché
     * @param {string} key - Clave
     * @param {*} value - Valor a almacenar
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<boolean>} - true si se almacenó correctamente
     */
    async set(key, value, options = {}) {
        const {
            strategy = this.options.defaultStrategy,
            ttl,
            multiStrategy = false
        } = options;
        
        const prefixedKey = this.getPrefixedKey(key);
        
        try {
            // Si se especifica multiStrategy, almacenar en todas las estrategias disponibles
            if (multiStrategy) {
                const promises = [];
                
                if (this.caches.memory) {
                    promises.push(Promise.resolve(
                        this.caches.memory.set(prefixedKey, value, ttl)
                    ));
                }
                
                if (this.caches.disk) {
                    promises.push(
                        this.caches.disk.set(prefixedKey, value, ttl)
                    );
                }
                
                await Promise.all(promises);
                return true;
            }
            
            // Verificar si la estrategia existe
            if (!this.caches[strategy]) {
                logger.warn(`Estrategia de caché '${strategy}' no disponible`);
                return false;
            }
            
            // Almacenar valor en la caché
            const cache = this.caches[strategy];
            
            if (strategy === 'memory') {
                cache.set(prefixedKey, value, ttl);
                return true;
            } else if (strategy === 'disk') {
                await cache.set(prefixedKey, value, ttl);
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error(`Error al almacenar valor en caché: ${error.message}`);
            return false;
        }
    }

    /**
     * Elimina una entrada de la caché
     * @param {string} key - Clave
     * @param {string} strategy - Estrategia de caché ('memory', 'disk', 'all')
     * @returns {Promise<boolean>} - true si se eliminó correctamente
     */
    async delete(key, strategy = 'all') {
        const prefixedKey = this.getPrefixedKey(key);
        
        try {
            // Si se especifica 'all', eliminar de todas las estrategias
            if (strategy === 'all') {
                const results = [];
                
                if (this.caches.memory) {
                    results.push(this.caches.memory.delete(prefixedKey));
                }
                
                if (this.caches.disk) {
                    results.push(await this.caches.disk.delete(prefixedKey));
                }
                
                return results.some(result => result);
            }
            
            // Verificar si la estrategia existe
            if (!this.caches[strategy]) {
                logger.warn(`Estrategia de caché '${strategy}' no disponible`);
                return false;
            }
            
            // Eliminar valor de la caché
            const cache = this.caches[strategy];
            
            if (strategy === 'memory') {
                return cache.delete(prefixedKey);
            } else if (strategy === 'disk') {
                return await cache.delete(prefixedKey);
            }
            
            return false;
        } catch (error) {
            logger.error(`Error al eliminar valor de caché: ${error.message}`);
            return false;
        }
    }

    /**
     * Elimina todas las entradas de la caché
     * @param {string} strategy - Estrategia de caché ('memory', 'disk', 'all')
     * @returns {Promise<boolean>} - true si se eliminaron correctamente
     */
    async clear(strategy = 'all') {
        try {
            // Si se especifica 'all', limpiar todas las estrategias
            if (strategy === 'all') {
                const promises = [];
                
                if (this.caches.memory) {
                    this.caches.memory.clear();
                    promises.push(Promise.resolve(true));
                }
                
                if (this.caches.disk) {
                    promises.push(this.caches.disk.clear());
                }
                
                await Promise.all(promises);
                return true;
            }
            
            // Verificar si la estrategia existe
            if (!this.caches[strategy]) {
                logger.warn(`Estrategia de caché '${strategy}' no disponible`);
                return false;
            }
            
            // Limpiar caché
            const cache = this.caches[strategy];
            
            if (strategy === 'memory') {
                cache.clear();
                return true;
            } else if (strategy === 'disk') {
                await cache.clear();
                return true;
            }
            
            return false;
        } catch (error) {
            logger.error(`Error al limpiar caché: ${error.message}`);
            return false;
        }
    }

    /**
     * Obtiene estadísticas de la caché
     * @param {string} strategy - Estrategia de caché ('memory', 'disk', 'all')
     * @returns {Promise<Object>} - Estadísticas
     */
    async getStats(strategy = 'all') {
        try {
            // Si se especifica 'all', obtener estadísticas de todas las estrategias
            if (strategy === 'all') {
                const stats = {
                    memory: this.caches.memory ? this.caches.memory.getStats() : null,
                    disk: this.caches.disk ? await this.caches.disk.getStats() : null
                };
                
                // Calcular estadísticas globales
                const hits = (stats.memory?.hits || 0) + (stats.disk?.hits || 0);
                const misses = (stats.memory?.misses || 0) + (stats.disk?.misses || 0);
                
                stats.global = {
                    hits,
                    misses,
                    hitRatio: hits / (hits + misses) || 0
                };
                
                return stats;
            }
            
            // Verificar si la estrategia existe
            if (!this.caches[strategy]) {
                logger.warn(`Estrategia de caché '${strategy}' no disponible`);
                return null;
            }
            
            // Obtener estadísticas
            const cache = this.caches[strategy];
            
            if (strategy === 'memory') {
                return cache.getStats();
            } else if (strategy === 'disk') {
                return await cache.getStats();
            }
            
            return null;
        } catch (error) {
            logger.error(`Error al obtener estadísticas de caché: ${error.message}`);
            return null;
        }
    }

    /**
     * Obtiene o calcula un valor, almacenándolo en caché si no existe
     * @param {string} key - Clave
     * @param {Function} fn - Función para calcular el valor si no está en caché
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<*>} - Valor almacenado o calculado
     */
    async getOrSet(key, fn, options = {}) {
        const {
            strategy = this.options.defaultStrategy,
            ttl,
            multiStrategy = false
        } = options;
        
        try {
            // Intentar obtener de la caché
            const cachedValue = await this.get(key, strategy);
            
            if (cachedValue !== undefined) {
                return cachedValue;
            }
            
            // Calcular valor
            const value = await fn();
            
            // Almacenar en caché
            await this.set(key, value, { strategy, ttl, multiStrategy });
            
            return value;
        } catch (error) {
            logger.error(`Error en getOrSet: ${error.message}`);
            
            // Si hay error, intentar calcular el valor sin almacenarlo en caché
            return await fn();
        }
    }

    /**
     * Envuelve una función para cachear sus resultados
     * @param {Function} fn - Función a envolver
     * @param {Function} keyGenerator - Función para generar la clave a partir de los argumentos
     * @param {Object} options - Opciones adicionales
     * @returns {Function} - Función envuelta
     */
    memoize(fn, keyGenerator, options = {}) {
        const self = this;
        
        return async function(...args) {
            // Generar clave
            const key = keyGenerator(...args);
            
            // Usar getOrSet para obtener o calcular el valor
            return await self.getOrSet(key, async () => {
                return await fn.apply(this, args);
            }, options);
        };
    }
}

// Exportar una instancia única
module.exports = new CacheManager({
    defaultStrategy: config.CACHE_DEFAULT_STRATEGY || 'memory',
    memory: {
        enabled: config.CACHE_MEMORY_ENABLED !== 'false',
        maxSize: parseInt(config.CACHE_MEMORY_MAX_SIZE || '1000', 10),
        ttl: parseInt(config.CACHE_MEMORY_TTL || '3600000', 10)
    },
    disk: {
        enabled: config.CACHE_DISK_ENABLED === 'true',
        directory: config.CACHE_DISK_DIRECTORY || path.join(process.cwd(), 'cache'),
        ttl: parseInt(config.CACHE_DISK_TTL || '86400000', 10)
    },
    keyPrefix: config.CACHE_KEY_PREFIX || 'cache:'
});
