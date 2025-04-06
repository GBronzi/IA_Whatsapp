/**
 * message-queue.js - Sistema de colas para procesar mensajes de forma ordenada
 */

const logger = require('./logger');
const config = require('./config');

class MessageQueue {
    constructor(options = {}) {
        this.queues = new Map(); // Map de colas por chatId
        this.processing = new Set(); // Set de chatIds en procesamiento
        this.concurrencyLimit = options.concurrencyLimit || 5;
        this.processingCount = 0;
        this.defaultTimeout = options.timeout || 60000; // 1 minuto por defecto
        this.waitTimeBeforeProcessing = options.waitTimeBeforeProcessing || 3000; // 3 segundos por defecto
        this.messageBuffers = new Map(); // Buffer para agrupar mensajes consecutivos
        this.bufferTimers = new Map(); // Timers para los buffers
    }

    /**
     * Añade un mensaje a la cola para un chat específico
     * @param {string} chatId - ID del chat
     * @param {Function} taskFn - Función a ejecutar (debe devolver una promesa)
     * @param {Object} options - Opciones adicionales
     * @returns {Promise} - Promesa que se resolverá cuando se procese el mensaje
     */
    enqueue(chatId, taskFn, options = {}) {
        if (!this.queues.has(chatId)) {
            this.queues.set(chatId, []);
        }

        return new Promise((resolve, reject) => {
            const task = {
                fn: taskFn,
                resolve,
                reject,
                timeout: options.timeout || this.defaultTimeout,
                timeoutId: null,
                priority: options.priority || 0,
                timestamp: Date.now()
            };

            // Cancelar cualquier timer existente para este chat
            if (this.bufferTimers.has(chatId)) {
                clearTimeout(this.bufferTimers.get(chatId));
                this.bufferTimers.delete(chatId);
                logger.debug(`Timer de espera cancelado para ${chatId} - Se recibió un nuevo mensaje`);
            }

            // Añadir tarea al buffer de mensajes
            if (!this.messageBuffers.has(chatId)) {
                this.messageBuffers.set(chatId, []);
            }

            const buffer = this.messageBuffers.get(chatId);
            buffer.push(task);

            logger.debug(`Mensaje añadido al buffer para ${chatId}. Tamaño del buffer: ${buffer.length}`);

            // Configurar un nuevo timer para procesar el buffer después del tiempo de espera
            const timerId = setTimeout(() => {
                this.processBuffer(chatId);
            }, this.waitTimeBeforeProcessing);

            this.bufferTimers.set(chatId, timerId);

            logger.debug(`Timer de espera configurado para ${chatId}: ${this.waitTimeBeforeProcessing}ms`);
        });
    }

    /**
     * Procesa el buffer de mensajes para un chat específico
     * @param {string} chatId - ID del chat
     */
    processBuffer(chatId) {
        if (!this.messageBuffers.has(chatId) || this.messageBuffers.get(chatId).length === 0) {
            logger.debug(`No hay mensajes en el buffer para ${chatId}`);
            return;
        }

        const buffer = this.messageBuffers.get(chatId);
        logger.info(`Procesando buffer de ${buffer.length} mensaje(s) para ${chatId} después de ${this.waitTimeBeforeProcessing}ms de espera`);

        // Crear una tarea combinada que procesará todos los mensajes en el buffer
        const combinedTask = {
            fn: async () => {
                // Ejecutar todas las funciones en el buffer en orden
                for (const task of buffer) {
                    try {
                        await task.fn();
                        task.resolve();
                    } catch (error) {
                        logger.error(`Error al procesar mensaje en buffer para ${chatId}: ${error.message}`);
                        task.reject(error);
                    }
                }
            },
            resolve: () => {}, // No necesitamos resolver la tarea combinada
            reject: () => {}, // No necesitamos rechazar la tarea combinada
            timeout: Math.max(...buffer.map(task => task.timeout)), // Usar el timeout más largo
            timeoutId: null,
            priority: Math.max(...buffer.map(task => task.priority)) // Usar la prioridad más alta
        };

        // Limpiar el buffer
        this.messageBuffers.delete(chatId);

        // Añadir la tarea combinada a la cola
        const queue = this.queues.get(chatId);
        queue.push(combinedTask);

        // Ordenar por prioridad (mayor número = mayor prioridad)
        queue.sort((a, b) => b.priority - a.priority);

        logger.debug(`Tarea combinada añadida a la cola para ${chatId}. Tamaño de cola: ${queue.length}`);

        // Intentar procesar la cola
        this.processNext();
    }

    /**
     * Procesa el siguiente mensaje en la cola
     */
    processNext() {
        // Si ya estamos procesando el máximo de mensajes, no hacer nada
        if (this.processingCount >= this.concurrencyLimit) {
            return;
        }

        // Buscar el siguiente chat con mensajes pendientes
        for (const [chatId, queue] of this.queues.entries()) {
            // Si este chat ya está siendo procesado o no tiene mensajes, continuar
            if (this.processing.has(chatId) || queue.length === 0) {
                continue;
            }

            // Marcar este chat como en procesamiento
            this.processing.add(chatId);
            this.processingCount++;

            // Obtener el primer mensaje de la cola
            const task = queue.shift();

            // Configurar timeout
            task.timeoutId = setTimeout(() => {
                logger.warn(`Timeout al procesar mensaje para ${chatId}`);
                task.reject(new Error('Timeout al procesar mensaje'));
                this.finishProcessing(chatId);
            }, task.timeout);

            // Ejecutar la tarea
            logger.debug(`Procesando mensaje para ${chatId}`);
            task.fn()
                .then(result => {
                    clearTimeout(task.timeoutId);
                    task.resolve(result);
                })
                .catch(error => {
                    clearTimeout(task.timeoutId);
                    task.reject(error);
                })
                .finally(() => {
                    this.finishProcessing(chatId);
                });

            // Solo procesar un chat a la vez en esta iteración
            break;
        }
    }

    /**
     * Finaliza el procesamiento de un chat
     * @param {string} chatId - ID del chat
     */
    finishProcessing(chatId) {
        this.processing.delete(chatId);
        this.processingCount--;

        // Si la cola de este chat está vacía, eliminarla
        const queue = this.queues.get(chatId);
        if (queue && queue.length === 0) {
            this.queues.delete(chatId);
        }

        // Intentar procesar el siguiente mensaje
        this.processNext();
    }

    /**
     * Obtiene el tamaño de la cola para un chat
     * @param {string} chatId - ID del chat
     * @returns {number} - Número de mensajes en cola
     */
    getQueueSize(chatId) {
        return this.queues.has(chatId) ? this.queues.get(chatId).length : 0;
    }

    /**
     * Obtiene el número total de mensajes en todas las colas
     * @returns {number} - Número total de mensajes
     */
    getTotalQueueSize() {
        let total = 0;
        for (const queue of this.queues.values()) {
            total += queue.length;
        }
        return total;
    }

    /**
     * Limpia la cola para un chat específico
     * @param {string} chatId - ID del chat
     */
    clearQueue(chatId) {
        // Limpiar cola de mensajes
        if (this.queues.has(chatId)) {
            const queue = this.queues.get(chatId);
            // Rechazar todas las tareas pendientes
            queue.forEach(task => {
                clearTimeout(task.timeoutId);
                try {
                    if (typeof task.reject === 'function') {
                        task.reject(new Error('Cola limpiada'));
                    }
                } catch (error) {
                    logger.error(`Error al rechazar tarea en cola: ${error.message}`);
                }
            });
            this.queues.delete(chatId);
        }

        // Limpiar buffer de mensajes
        if (this.messageBuffers.has(chatId)) {
            const buffer = this.messageBuffers.get(chatId);
            // Rechazar todas las tareas pendientes en el buffer
            buffer.forEach(task => {
                try {
                    if (typeof task.reject === 'function') {
                        task.reject(new Error('Buffer limpiado'));
                    }
                } catch (error) {
                    logger.error(`Error al rechazar tarea en buffer: ${error.message}`);
                }
            });
            this.messageBuffers.delete(chatId);
        }

        // Cancelar timer de buffer
        if (this.bufferTimers.has(chatId)) {
            clearTimeout(this.bufferTimers.get(chatId));
            this.bufferTimers.delete(chatId);
        }

        logger.debug(`Cola, buffer y timer limpiados para ${chatId}`);
    }

    /**
     * Limpia todas las colas
     */
    clearAllQueues() {
        // Obtener todos los chatIds únicos de colas y buffers
        const chatIds = new Set([...this.queues.keys(), ...this.messageBuffers.keys()]);

        // Limpiar cada chat
        for (const chatId of chatIds) {
            this.clearQueue(chatId);
        }

        logger.info(`Todas las colas y buffers han sido limpiados`);
    }
}

// Exportar una instancia única con la configuración del sistema
module.exports = new MessageQueue({
    concurrencyLimit: config.MESSAGE_QUEUE_CONCURRENCY,
    timeout: config.MESSAGE_QUEUE_TIMEOUT,
    waitTimeBeforeProcessing: config.MESSAGE_WAIT_TIME
});
