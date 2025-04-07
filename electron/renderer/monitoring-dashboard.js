/**
 * monitoring-dashboard.js - Interfaz para visualizar métricas de monitoreo
 */

// Importar módulos
const { ipcRenderer } = require('electron');
const Chart = require('chart.js');

// Variables globales
let metricsCharts = {};
let alertsList = [];
let refreshInterval;

/**
 * Inicializa el dashboard de monitoreo
 */
function initializeMonitoringDashboard() {
  // Configurar eventos
  document.getElementById('refresh-metrics-button')?.addEventListener('click', refreshMetrics);
  document.getElementById('metrics-time-range')?.addEventListener('change', refreshMetrics);
  document.getElementById('clear-alerts-button')?.addEventListener('click', clearAlerts);
  
  // Inicializar gráficos
  createCharts();
  
  // Cargar métricas iniciales
  refreshMetrics();
  
  // Configurar actualización automática
  refreshInterval = setInterval(refreshMetrics, 10000); // Actualizar cada 10 segundos
  
  // Suscribirse a eventos de alertas
  ipcRenderer.on('monitoring-alert', (event, alert) => {
    addAlert(alert);
  });
  
  // Suscribirse a eventos de métricas
  ipcRenderer.on('monitoring-metrics', (event, metrics) => {
    updateDashboard(metrics);
  });
}

/**
 * Crea los gráficos de métricas
 */
function createCharts() {
  // Gráfico de CPU y memoria
  const systemCtx = document.getElementById('system-metrics-chart')?.getContext('2d');
  if (systemCtx) {
    metricsCharts.system = new Chart(systemCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'CPU (%)',
          data: [],
          borderColor: 'rgba(255, 99, 132, 1)',
          backgroundColor: 'rgba(255, 99, 132, 0.2)',
          yAxisID: 'y'
        }, {
          label: 'Memoria (%)',
          data: [],
          borderColor: 'rgba(54, 162, 235, 1)',
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          yAxisID: 'y'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Porcentaje'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Tiempo'
            }
          }
        }
      }
    });
  }
  
  // Gráfico de mensajes y errores
  const messagesCtx = document.getElementById('messages-metrics-chart')?.getContext('2d');
  if (messagesCtx) {
    metricsCharts.messages = new Chart(messagesCtx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Mensajes',
          data: [],
          backgroundColor: 'rgba(75, 192, 192, 0.8)',
          yAxisID: 'y'
        }, {
          label: 'Errores',
          data: [],
          backgroundColor: 'rgba(255, 99, 132, 0.8)',
          yAxisID: 'y1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Mensajes'
            },
            position: 'left'
          },
          y1: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Errores'
            },
            position: 'right',
            grid: {
              drawOnChartArea: false
            }
          },
          x: {
            title: {
              display: true,
              text: 'Tiempo'
            }
          }
        }
      }
    });
  }
  
  // Gráfico de tiempo de respuesta
  const responseTimeCtx = document.getElementById('response-time-chart')?.getContext('2d');
  if (responseTimeCtx) {
    metricsCharts.responseTime = new Chart(responseTimeCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Tiempo de respuesta (ms)',
          data: [],
          borderColor: 'rgba(153, 102, 255, 1)',
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Milisegundos'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Tiempo'
            }
          }
        }
      }
    });
  }
  
  // Gráfico de solicitudes a la IA
  const aiRequestsCtx = document.getElementById('ai-requests-chart')?.getContext('2d');
  if (aiRequestsCtx) {
    metricsCharts.aiRequests = new Chart(aiRequestsCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Solicitudes a la IA',
          data: [],
          borderColor: 'rgba(255, 159, 64, 1)',
          backgroundColor: 'rgba(255, 159, 64, 0.2)',
          yAxisID: 'y'
        }, {
          label: 'Tiempo de procesamiento (ms)',
          data: [],
          borderColor: 'rgba(201, 203, 207, 1)',
          backgroundColor: 'rgba(201, 203, 207, 0.2)',
          yAxisID: 'y1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Solicitudes'
            },
            position: 'left'
          },
          y1: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Milisegundos'
            },
            position: 'right',
            grid: {
              drawOnChartArea: false
            }
          },
          x: {
            title: {
              display: true,
              text: 'Tiempo'
            }
          }
        }
      }
    });
  }
}

/**
 * Actualiza las métricas
 */
async function refreshMetrics() {
  try {
    // Obtener rango de tiempo seleccionado
    const timeRange = document.getElementById('metrics-time-range')?.value || '1h';
    
    // Calcular tiempo de inicio según el rango
    let startTime;
    const now = Date.now();
    
    switch (timeRange) {
      case '15m':
        startTime = now - 15 * 60 * 1000;
        break;
      case '1h':
        startTime = now - 60 * 60 * 1000;
        break;
      case '6h':
        startTime = now - 6 * 60 * 60 * 1000;
        break;
      case '24h':
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case '7d':
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      default:
        startTime = now - 60 * 60 * 1000; // 1 hora por defecto
    }
    
    // Solicitar métricas al proceso principal
    const metricsHistory = await ipcRenderer.invoke('get-metrics-history', {
      startTime,
      endTime: now
    });
    
    // Solicitar alertas activas
    const activeAlerts = await ipcRenderer.invoke('get-active-alerts');
    
    // Actualizar dashboard
    updateChartsWithHistory(metricsHistory);
    updateAlertsList(activeAlerts);
    
    // Mostrar última actualización
    document.getElementById('last-metrics-update').textContent = new Date().toLocaleTimeString();
  } catch (error) {
    console.error('Error al actualizar métricas:', error);
    showError('No se pudieron cargar las métricas. Inténtalo de nuevo más tarde.');
  }
}

/**
 * Actualiza los gráficos con el historial de métricas
 * @param {Array} metricsHistory - Historial de métricas
 */
function updateChartsWithHistory(metricsHistory) {
  if (!metricsHistory || metricsHistory.length === 0) {
    return;
  }
  
  // Ordenar métricas por timestamp
  const sortedMetrics = [...metricsHistory].sort((a, b) => a.timestamp - b.timestamp);
  
  // Preparar datos para los gráficos
  const labels = sortedMetrics.map(m => new Date(m.timestamp).toLocaleTimeString());
  
  // Datos para gráfico de sistema
  const cpuData = sortedMetrics.map(m => m.system.cpu);
  const memoryData = sortedMetrics.map(m => m.system.memory.percentage);
  
  // Datos para gráfico de mensajes
  const messagesData = sortedMetrics.map(m => m.application.messageCount);
  const errorsData = sortedMetrics.map(m => m.application.errorCount);
  
  // Datos para gráfico de tiempo de respuesta
  const responseTimeData = sortedMetrics.map(m => m.application.responseTime.avg);
  
  // Datos para gráfico de solicitudes a la IA
  const aiRequestsData = sortedMetrics.map(m => m.ai.requestCount);
  const aiProcessingTimeData = sortedMetrics.map(m => m.ai.processingTime.avg);
  
  // Actualizar gráfico de sistema
  if (metricsCharts.system) {
    metricsCharts.system.data.labels = labels;
    metricsCharts.system.data.datasets[0].data = cpuData;
    metricsCharts.system.data.datasets[1].data = memoryData;
    metricsCharts.system.update();
  }
  
  // Actualizar gráfico de mensajes
  if (metricsCharts.messages) {
    metricsCharts.messages.data.labels = labels;
    metricsCharts.messages.data.datasets[0].data = messagesData;
    metricsCharts.messages.data.datasets[1].data = errorsData;
    metricsCharts.messages.update();
  }
  
  // Actualizar gráfico de tiempo de respuesta
  if (metricsCharts.responseTime) {
    metricsCharts.responseTime.data.labels = labels;
    metricsCharts.responseTime.data.datasets[0].data = responseTimeData;
    metricsCharts.responseTime.update();
  }
  
  // Actualizar gráfico de solicitudes a la IA
  if (metricsCharts.aiRequests) {
    metricsCharts.aiRequests.data.labels = labels;
    metricsCharts.aiRequests.data.datasets[0].data = aiRequestsData;
    metricsCharts.aiRequests.data.datasets[1].data = aiProcessingTimeData;
    metricsCharts.aiRequests.update();
  }
  
  // Actualizar contadores
  updateCounters(sortedMetrics[sortedMetrics.length - 1]);
}

/**
 * Actualiza el dashboard con las métricas actuales
 * @param {Object} metrics - Métricas actuales
 */
function updateDashboard(metrics) {
  if (!metrics) return;
  
  // Actualizar contadores
  updateCounters(metrics);
  
  // Añadir punto a los gráficos
  const label = new Date(metrics.timestamp).toLocaleTimeString();
  
  // Actualizar gráfico de sistema
  if (metricsCharts.system) {
    // Añadir nuevo punto
    metricsCharts.system.data.labels.push(label);
    metricsCharts.system.data.datasets[0].data.push(metrics.system.cpu);
    metricsCharts.system.data.datasets[1].data.push(metrics.system.memory.percentage);
    
    // Limitar a 60 puntos
    if (metricsCharts.system.data.labels.length > 60) {
      metricsCharts.system.data.labels.shift();
      metricsCharts.system.data.datasets[0].data.shift();
      metricsCharts.system.data.datasets[1].data.shift();
    }
    
    metricsCharts.system.update();
  }
  
  // Actualizar gráfico de mensajes
  if (metricsCharts.messages) {
    // Añadir nuevo punto
    metricsCharts.messages.data.labels.push(label);
    metricsCharts.messages.data.datasets[0].data.push(metrics.application.messageCount);
    metricsCharts.messages.data.datasets[1].data.push(metrics.application.errorCount);
    
    // Limitar a 60 puntos
    if (metricsCharts.messages.data.labels.length > 60) {
      metricsCharts.messages.data.labels.shift();
      metricsCharts.messages.data.datasets[0].data.shift();
      metricsCharts.messages.data.datasets[1].data.shift();
    }
    
    metricsCharts.messages.update();
  }
  
  // Actualizar gráfico de tiempo de respuesta
  if (metricsCharts.responseTime) {
    // Añadir nuevo punto
    metricsCharts.responseTime.data.labels.push(label);
    metricsCharts.responseTime.data.datasets[0].data.push(metrics.application.responseTime.avg);
    
    // Limitar a 60 puntos
    if (metricsCharts.responseTime.data.labels.length > 60) {
      metricsCharts.responseTime.data.labels.shift();
      metricsCharts.responseTime.data.datasets[0].data.shift();
    }
    
    metricsCharts.responseTime.update();
  }
  
  // Actualizar gráfico de solicitudes a la IA
  if (metricsCharts.aiRequests) {
    // Añadir nuevo punto
    metricsCharts.aiRequests.data.labels.push(label);
    metricsCharts.aiRequests.data.datasets[0].data.push(metrics.ai.requestCount);
    metricsCharts.aiRequests.data.datasets[1].data.push(metrics.ai.processingTime.avg);
    
    // Limitar a 60 puntos
    if (metricsCharts.aiRequests.data.labels.length > 60) {
      metricsCharts.aiRequests.data.labels.shift();
      metricsCharts.aiRequests.data.datasets[0].data.shift();
      metricsCharts.aiRequests.data.datasets[1].data.shift();
    }
    
    metricsCharts.aiRequests.update();
  }
}

/**
 * Actualiza los contadores con las métricas actuales
 * @param {Object} metrics - Métricas actuales
 */
function updateCounters(metrics) {
  if (!metrics) return;
  
  // Actualizar contador de CPU
  document.getElementById('cpu-usage').textContent = `${metrics.system.cpu.toFixed(1)}%`;
  
  // Actualizar contador de memoria
  document.getElementById('memory-usage').textContent = `${metrics.system.memory.percentage.toFixed(1)}%`;
  
  // Actualizar contador de mensajes
  document.getElementById('message-count').textContent = metrics.application.messageCount;
  
  // Actualizar contador de errores
  document.getElementById('error-count').textContent = metrics.application.errorCount;
  
  // Actualizar tasa de errores
  document.getElementById('error-rate').textContent = `${metrics.application.errorRate.toFixed(1)}%`;
  
  // Actualizar tiempo de respuesta
  document.getElementById('response-time').textContent = `${metrics.application.responseTime.avg.toFixed(0)}ms`;
  
  // Actualizar contador de solicitudes a la IA
  document.getElementById('ai-request-count').textContent = metrics.ai.requestCount;
  
  // Actualizar tiempo de procesamiento de la IA
  document.getElementById('ai-processing-time').textContent = `${metrics.ai.processingTime.avg.toFixed(0)}ms`;
  
  // Actualizar contador de chats activos
  document.getElementById('active-chats').textContent = metrics.application.activeChats;
  
  // Actualizar tamaño de cola
  document.getElementById('queue-size').textContent = metrics.application.queueSize;
  
  // Actualizar tiempo de actividad
  const uptime = metrics.system.uptime;
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  let uptimeText = '';
  if (days > 0) uptimeText += `${days}d `;
  if (hours > 0) uptimeText += `${hours}h `;
  if (minutes > 0) uptimeText += `${minutes}m `;
  uptimeText += `${seconds}s`;
  
  document.getElementById('uptime').textContent = uptimeText;
}

/**
 * Actualiza la lista de alertas
 * @param {Array} alerts - Alertas activas
 */
function updateAlertsList(alerts) {
  const alertsContainer = document.getElementById('alerts-container');
  if (!alertsContainer) return;
  
  // Actualizar contador de alertas
  document.getElementById('alerts-count').textContent = alerts.length;
  
  // Limpiar contenedor
  alertsContainer.innerHTML = '';
  
  // Verificar si hay alertas
  if (alerts.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-message';
    emptyMessage.textContent = 'No hay alertas activas';
    alertsContainer.appendChild(emptyMessage);
    return;
  }
  
  // Ordenar alertas por timestamp (más recientes primero)
  const sortedAlerts = [...alerts].sort((a, b) => b.timestamp - a.timestamp);
  
  // Crear elementos para cada alerta
  sortedAlerts.forEach(alert => {
    const alertElement = document.createElement('div');
    alertElement.className = `alert-item ${getAlertSeverityClass(alert)}`;
    alertElement.dataset.alertId = alert.id;
    
    // Crear contenido
    alertElement.innerHTML = `
      <div class="alert-header">
        <span class="alert-title">${getAlertTitle(alert)}</span>
        <span class="alert-time">${formatTime(alert.timestamp)}</span>
      </div>
      <div class="alert-message">${alert.message}</div>
      <div class="alert-details">
        ${alert.metric ? `<span class="alert-metric">${alert.metric}</span>` : ''}
        ${alert.value ? `<span class="alert-value">Valor: ${alert.value.toFixed(1)}</span>` : ''}
        ${alert.threshold ? `<span class="alert-threshold">Umbral: ${alert.threshold}</span>` : ''}
      </div>
    `;
    
    // Añadir al contenedor
    alertsContainer.appendChild(alertElement);
  });
  
  // Actualizar lista global
  alertsList = sortedAlerts;
}

/**
 * Añade una nueva alerta a la lista
 * @param {Object} alert - Alerta
 */
function addAlert(alert) {
  // Añadir a la lista global
  alertsList.push(alert);
  
  // Actualizar lista de alertas
  updateAlertsList(alertsList);
  
  // Mostrar notificación
  showNotification(alert);
}

/**
 * Limpia todas las alertas
 */
async function clearAlerts() {
  try {
    // Solicitar limpiar alertas al proceso principal
    await ipcRenderer.invoke('clear-alerts');
    
    // Limpiar lista global
    alertsList = [];
    
    // Actualizar lista de alertas
    updateAlertsList([]);
  } catch (error) {
    console.error('Error al limpiar alertas:', error);
    showError('No se pudieron limpiar las alertas. Inténtalo de nuevo más tarde.');
  }
}

/**
 * Muestra una notificación para una alerta
 * @param {Object} alert - Alerta
 */
function showNotification(alert) {
  // Verificar si las notificaciones están soportadas
  if (!('Notification' in window)) return;
  
  // Verificar permiso
  if (Notification.permission === 'granted') {
    // Crear notificación
    const notification = new Notification(getAlertTitle(alert), {
      body: alert.message,
      icon: './img/alert-icon.png'
    });
    
    // Cerrar después de 5 segundos
    setTimeout(() => notification.close(), 5000);
  } else if (Notification.permission !== 'denied') {
    // Solicitar permiso
    Notification.requestPermission();
  }
}

/**
 * Obtiene el título de una alerta
 * @param {Object} alert - Alerta
 * @returns {string} - Título de la alerta
 */
function getAlertTitle(alert) {
  if (alert.type === 'threshold') {
    return `Alerta de ${alert.metric}`;
  } else {
    return 'Alerta del sistema';
  }
}

/**
 * Obtiene la clase de severidad de una alerta
 * @param {Object} alert - Alerta
 * @returns {string} - Clase de severidad
 */
function getAlertSeverityClass(alert) {
  if (alert.type === 'threshold') {
    if (alert.metric === 'cpu' || alert.metric === 'memory') {
      return alert.value > 90 ? 'critical' : 'warning';
    } else if (alert.metric === 'errorRate') {
      return alert.value > 10 ? 'critical' : 'warning';
    } else {
      return 'warning';
    }
  } else {
    return 'info';
  }
}

/**
 * Formatea una marca de tiempo para mostrarla en la UI
 * @param {number} timestamp - Marca de tiempo
 * @returns {string} - Tiempo formateado
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

/**
 * Muestra un mensaje de error
 * @param {string} message - Mensaje de error
 */
function showError(message) {
  const errorElement = document.getElementById('monitoring-error');
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Ocultar después de 5 segundos
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }
}

/**
 * Limpia los recursos al cerrar la página
 */
function cleanupMonitoringDashboard() {
  // Detener actualización automática
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  // Destruir gráficos
  Object.values(metricsCharts).forEach(chart => {
    if (chart) {
      chart.destroy();
    }
  });
  
  // Eliminar suscripciones a eventos
  ipcRenderer.removeAllListeners('monitoring-alert');
  ipcRenderer.removeAllListeners('monitoring-metrics');
}

// Exportar funciones
module.exports = {
  initializeMonitoringDashboard,
  refreshMetrics,
  cleanupMonitoringDashboard
};
