/**
 * message-queue.js - Sistema de colas para procesar mensajes de forma ordenada
 */

const logger = require('./logger');

class MessageQueue {
    constructor(options = {}) {
        this.queues = new Map(); // Map de colas por chatId
        this.processing = new Set(); // Set de chatIds en procesamiento
        this.concurrencyLimit = options.concurrencyLimit || 5;
        this.processingCount = 0;
        this.defaultTimeout = options.timeout || 60000; // 1 minuto por defecto
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
                priority: options.priority || 0
            };

            const queue = this.queues.get(chatId);
            queue.push(task);

            // Ordenar por prioridad (mayor número = mayor prioridad)
            queue.sort((a, b) => b.priority - a.priority);

            logger.debug(`Mensaje añadido a la cola para ${chatId}. Tamaño de cola: ${queue.length}`);

            // Intentar procesar la cola
            this.processNext();
        });
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
        if (this.queues.has(chatId)) {
            const queue = this.queues.get(chatId);
            // Rechazar todas las tareas pendientes
            queue.forEach(task => {
                clearTimeout(task.timeoutId);
                task.reject(new Error('Cola limpiada'));
            });
            this.queues.delete(chatId);
        }
    }

    /**
     * Limpia todas las colas
     */
    clearAllQueues() {
        for (const chatId of this.queues.keys()) {
            this.clearQueue(chatId);
        }
    }
}

// Exportar una instancia única
module.exports = new MessageQueue();
