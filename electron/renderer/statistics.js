/**
 * statistics.js - Módulo para mostrar estadísticas en la interfaz de usuario
 */

// Importar módulos
const { ipcRenderer } = require('electron');
const Chart = require('chart.js');

// Variables globales
let statsCharts = {};
let refreshInterval;

/**
 * Inicializa el módulo de estadísticas
 */
function initializeStatistics() {
  // Configurar eventos
  document.getElementById('refresh-stats-button')?.addEventListener('click', refreshStatistics);
  document.getElementById('stats-time-range')?.addEventListener('change', refreshStatistics);
  
  // Inicializar gráficos
  createCharts();
  
  // Cargar estadísticas iniciales
  refreshStatistics();
  
  // Configurar actualización automática
  refreshInterval = setInterval(refreshStatistics, 60000); // Actualizar cada minuto
}

/**
 * Crea los gráficos de estadísticas
 */
function createCharts() {
  // Gráfico de mensajes por día
  const messagesCtx = document.getElementById('messages-chart')?.getContext('2d');
  if (messagesCtx) {
    statsCharts.messages = new Chart(messagesCtx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Mensajes recibidos',
          data: [],
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1
        }, {
          label: 'Respuestas enviadas',
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
              text: 'Cantidad de mensajes'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Fecha'
            }
          }
        }
      }
    });
  }
  
  // Gráfico de clientes por estado
  const clientsCtx = document.getElementById('clients-chart')?.getContext('2d');
  if (clientsCtx) {
    statsCharts.clients = new Chart(clientsCtx, {
      type: 'doughnut',
      data: {
        labels: ['Nuevos', 'En conversación', 'Requieren atención humana', 'Convertidos', 'Inactivos'],
        datasets: [{
          data: [0, 0, 0, 0, 0],
          backgroundColor: [
            'rgba(75, 192, 192, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 99, 132, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(153, 102, 255, 0.8)'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          }
        }
      }
    });
  }
  
  // Gráfico de rendimiento de la IA
  const aiPerformanceCtx = document.getElementById('ai-performance-chart')?.getContext('2d');
  if (aiPerformanceCtx) {
    statsCharts.aiPerformance = new Chart(aiPerformanceCtx, {
      type: 'bar',
      data: {
        labels: ['Tiempo de respuesta', 'Precisión', 'Satisfacción'],
        datasets: [{
          label: 'Rendimiento de la IA',
          data: [0, 0, 0],
          backgroundColor: [
            'rgba(54, 162, 235, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(255, 206, 86, 0.8)'
          ]
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
          }
        }
      }
    });
  }
}

/**
 * Actualiza las estadísticas
 */
async function refreshStatistics() {
  try {
    // Obtener rango de tiempo seleccionado
    const timeRange = document.getElementById('stats-time-range')?.value || '7d';
    
    // Solicitar estadísticas al proceso principal
    const stats = await ipcRenderer.invoke('get-statistics', { timeRange });
    
    // Actualizar gráficos
    updateCharts(stats);
    
    // Actualizar contadores
    updateCounters(stats);
    
    // Mostrar última actualización
    document.getElementById('last-update-time').textContent = new Date().toLocaleTimeString();
  } catch (error) {
    console.error('Error al actualizar estadísticas:', error);
    showError('No se pudieron cargar las estadísticas. Inténtalo de nuevo más tarde.');
  }
}

/**
 * Actualiza los gráficos con los datos de estadísticas
 * @param {Object} stats - Datos de estadísticas
 */
function updateCharts(stats) {
  // Actualizar gráfico de mensajes
  if (statsCharts.messages && stats.messagesByDay) {
    statsCharts.messages.data.labels = stats.messagesByDay.dates;
    statsCharts.messages.data.datasets[0].data = stats.messagesByDay.received;
    statsCharts.messages.data.datasets[1].data = stats.messagesByDay.sent;
    statsCharts.messages.update();
  }
  
  // Actualizar gráfico de clientes
  if (statsCharts.clients && stats.clientsByStatus) {
    statsCharts.clients.data.datasets[0].data = [
      stats.clientsByStatus.new || 0,
      stats.clientsByStatus.active || 0,
      stats.clientsByStatus.needsHuman || 0,
      stats.clientsByStatus.converted || 0,
      stats.clientsByStatus.inactive || 0
    ];
    statsCharts.clients.update();
  }
  
  // Actualizar gráfico de rendimiento de la IA
  if (statsCharts.aiPerformance && stats.aiPerformance) {
    statsCharts.aiPerformance.data.datasets[0].data = [
      stats.aiPerformance.responseTime || 0,
      stats.aiPerformance.accuracy || 0,
      stats.aiPerformance.satisfaction || 0
    ];
    statsCharts.aiPerformance.update();
  }
}

/**
 * Actualiza los contadores con los datos de estadísticas
 * @param {Object} stats - Datos de estadísticas
 */
function updateCounters(stats) {
  // Actualizar contador de mensajes totales
  document.getElementById('total-messages-count').textContent = stats.totalMessages || 0;
  
  // Actualizar contador de clientes totales
  document.getElementById('total-clients-count').textContent = stats.totalClients || 0;
  
  // Actualizar contador de conversiones
  document.getElementById('conversions-count').textContent = stats.conversions || 0;
  
  // Actualizar contador de asistencia humana
  document.getElementById('human-assistance-count').textContent = stats.humanAssistanceRequests || 0;
  
  // Actualizar tasa de respuesta
  const responseRate = stats.responseRate || 0;
  document.getElementById('response-rate').textContent = `${responseRate.toFixed(1)}%`;
  
  // Actualizar tiempo promedio de respuesta
  const avgResponseTime = stats.averageResponseTime || 0;
  document.getElementById('avg-response-time').textContent = `${avgResponseTime.toFixed(1)}s`;
}

/**
 * Muestra un mensaje de error
 * @param {string} message - Mensaje de error
 */
function showError(message) {
  const errorElement = document.getElementById('stats-error');
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
function cleanupStatistics() {
  // Detener actualización automática
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  // Destruir gráficos
  Object.values(statsCharts).forEach(chart => {
    if (chart) {
      chart.destroy();
    }
  });
}

// Exportar funciones
module.exports = {
  initializeStatistics,
  refreshStatistics,
  cleanupStatistics
};
