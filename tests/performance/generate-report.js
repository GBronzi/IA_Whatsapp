/**
 * Generador de informes de rendimiento para el Asistente de Ventas WhatsApp
 * 
 * Este script genera un informe HTML con los resultados de las pruebas de rendimiento.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuración
const PERFORMANCE_REPORT = path.join(__dirname, 'performance-report.json');
const LOAD_TEST_REPORT = path.join(__dirname, 'load-test-report.json');
const INTEGRATION_TEST_REPORT = path.join(__dirname, '../integration/integration-test-report.json');
const RESOURCE_MONITOR_REPORT = path.join(__dirname, 'resource-monitor-report.json');
const OUTPUT_REPORT = path.join(__dirname, 'performance-report.html');

/**
 * Carga un archivo JSON
 * @param {string} filePath - Ruta del archivo
 * @returns {Object} - Contenido del archivo
 */
function loadJsonFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`Error al cargar archivo ${filePath}: ${error.message}`);
  }
  
  return null;
}

/**
 * Genera un gráfico de barras HTML
 * @param {string} id - ID del gráfico
 * @param {string} title - Título del gráfico
 * @param {Array<Object>} data - Datos del gráfico
 * @returns {string} - HTML del gráfico
 */
function generateBarChart(id, title, data) {
  const labels = data.map(item => item.label);
  const values = data.map(item => item.value);
  const colors = data.map(item => item.color || '#4CAF50');
  
  return `
    <div class="chart-container">
      <h3>${title}</h3>
      <canvas id="${id}"></canvas>
      <script>
        new Chart(document.getElementById('${id}'), {
          type: 'bar',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: [{
              label: '${title}',
              data: ${JSON.stringify(values)},
              backgroundColor: ${JSON.stringify(colors)}
            }]
          },
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        });
      </script>
    </div>
  `;
}

/**
 * Genera un gráfico de líneas HTML
 * @param {string} id - ID del gráfico
 * @param {string} title - Título del gráfico
 * @param {Array<Object>} datasets - Conjuntos de datos
 * @param {Array<string>} labels - Etiquetas del eje X
 * @returns {string} - HTML del gráfico
 */
function generateLineChart(id, title, datasets, labels) {
  return `
    <div class="chart-container">
      <h3>${title}</h3>
      <canvas id="${id}"></canvas>
      <script>
        new Chart(document.getElementById('${id}'), {
          type: 'line',
          data: {
            labels: ${JSON.stringify(labels)},
            datasets: ${JSON.stringify(datasets)}
          },
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true
              }
            }
          }
        });
      </script>
    </div>
  `;
}

/**
 * Genera una tabla HTML
 * @param {string} title - Título de la tabla
 * @param {Array<Object>} data - Datos de la tabla
 * @returns {string} - HTML de la tabla
 */
function generateTable(title, data) {
  if (!data || data.length === 0) {
    return '';
  }
  
  const headers = Object.keys(data[0]);
  
  return `
    <div class="table-container">
      <h3>${title}</h3>
      <table>
        <thead>
          <tr>
            ${headers.map(header => `<th>${header}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${headers.map(header => `<td>${row[header]}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Genera el informe HTML
 */
function generateReport() {
  console.log('Generando informe de rendimiento...');
  
  // Cargar informes
  const performanceReport = loadJsonFile(PERFORMANCE_REPORT);
  const loadTestReport = loadJsonFile(LOAD_TEST_REPORT);
  const integrationTestReport = loadJsonFile(INTEGRATION_TEST_REPORT);
  const resourceMonitorReport = loadJsonFile(RESOURCE_MONITOR_REPORT);
  
  // Verificar si hay informes disponibles
  if (!performanceReport && !loadTestReport && !integrationTestReport && !resourceMonitorReport) {
    console.error('No hay informes disponibles para generar el informe HTML');
    return;
  }
  
  // Generar contenido HTML
  let content = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Informe de Rendimiento - Asistente de Ventas WhatsApp</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        
        h1, h2, h3 {
          color: #2c3e50;
        }
        
        .section {
          margin-bottom: 40px;
          padding: 20px;
          background-color: #f9f9f9;
          border-radius: 5px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        
        .chart-container {
          margin-bottom: 30px;
        }
        
        .table-container {
          margin-bottom: 30px;
          overflow-x: auto;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
        }
        
        th, td {
          padding: 10px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        
        th {
          background-color: #f2f2f2;
        }
        
        tr:hover {
          background-color: #f5f5f5;
        }
        
        .summary-box {
          display: inline-block;
          width: 200px;
          padding: 15px;
          margin: 10px;
          background-color: #e8f4f8;
          border-radius: 5px;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
          text-align: center;
        }
        
        .summary-box h4 {
          margin-top: 0;
          color: #2980b9;
        }
        
        .summary-box p {
          font-size: 24px;
          font-weight: bold;
          margin: 10px 0;
        }
        
        .summary-box small {
          display: block;
          color: #7f8c8d;
        }
        
        .status-passed {
          color: #27ae60;
        }
        
        .status-failed {
          color: #e74c3c;
        }
        
        .status-skipped {
          color: #f39c12;
        }
        
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          text-align: center;
          color: #7f8c8d;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <h1>Informe de Rendimiento - Asistente de Ventas WhatsApp</h1>
      <p>Generado el ${new Date().toLocaleString()}</p>
      
      <div class="section">
        <h2>Información del Sistema</h2>
        <div class="summary-boxes">
  `;
  
  // Información del sistema
  const systemInfo = performanceReport?.system || loadTestReport?.system || resourceMonitorReport?.system || {};
  
  if (systemInfo.os) {
    content += `
      <div class="summary-box">
        <h4>Sistema Operativo</h4>
        <p>${systemInfo.os.platform} ${systemInfo.os.arch}</p>
        <small>${systemInfo.os.version || systemInfo.os.release}</small>
      </div>
    `;
  }
  
  if (systemInfo.cpu) {
    content += `
      <div class="summary-box">
        <h4>CPU</h4>
        <p>${systemInfo.cpu.cores} núcleos</p>
        <small>${systemInfo.cpu.model}</small>
      </div>
    `;
  }
  
  if (systemInfo.memory) {
    content += `
      <div class="summary-box">
        <h4>Memoria</h4>
        <p>${systemInfo.memory.total}</p>
        <small>${systemInfo.memory.used} usado</small>
      </div>
    `;
  }
  
  content += `
        </div>
      </div>
  `;
  
  // Pruebas de rendimiento
  if (performanceReport) {
    content += `
      <div class="section">
        <h2>Pruebas de Rendimiento</h2>
    `;
    
    // Resumen
    if (performanceReport.summary) {
      content += `
        <div class="summary-boxes">
      `;
      
      for (const [testName, stats] of Object.entries(performanceReport.summary.averageTimes)) {
        content += `
          <div class="summary-box">
            <h4>${testName}</h4>
            <p>${stats.average}</p>
            <small>Min: ${stats.min}, Max: ${stats.max}</small>
          </div>
        `;
      }
      
      content += `
        </div>
      `;
    }
    
    // Gráficos
    if (performanceReport.tests) {
      const chartData = [];
      
      for (const [testName, testResult] of Object.entries(performanceReport.tests)) {
        chartData.push({
          label: testName,
          value: testResult.average,
          color: '#3498db'
        });
      }
      
      content += generateBarChart('performance-chart', 'Tiempo de Ejecución Promedio (ms)', chartData);
    }
    
    content += `
      </div>
    `;
  }
  
  // Pruebas de carga
  if (loadTestReport) {
    content += `
      <div class="section">
        <h2>Pruebas de Carga</h2>
    `;
    
    // Resumen
    if (loadTestReport.summary) {
      content += `
        <div class="summary-boxes">
          <div class="summary-box">
            <h4>Usuarios Concurrentes</h4>
            <p>${loadTestReport.summary.totalUsers}</p>
          </div>
          <div class="summary-box">
            <h4>Operaciones Totales</h4>
            <p>${loadTestReport.summary.totalOperations}</p>
          </div>
          <div class="summary-box">
            <h4>Operaciones por Segundo</h4>
            <p>${loadTestReport.summary.operationsPerSecond}</p>
          </div>
          <div class="summary-box">
            <h4>Tasa de Éxito</h4>
            <p>${loadTestReport.summary.successRate}</p>
          </div>
        </div>
      `;
      
      // Tiempos promedio
      if (loadTestReport.summary.averageTimes) {
        const chartData = [];
        
        for (const [type, stats] of Object.entries(loadTestReport.summary.averageTimes)) {
          chartData.push({
            label: type,
            value: parseFloat(stats.average),
            color: '#e74c3c'
          });
        }
        
        content += generateBarChart('load-test-chart', 'Tiempo de Respuesta Promedio (ms)', chartData);
      }
    }
    
    // Uso de recursos
    if (loadTestReport.tests && loadTestReport.tests.resources) {
      const resources = loadTestReport.tests.resources;
      
      content += `
        <h3>Uso de Recursos</h3>
        <div class="summary-boxes">
          <div class="summary-box">
            <h4>CPU (Usuario)</h4>
            <p>${resources.cpu.user.toFixed(2)} ms</p>
          </div>
          <div class="summary-box">
            <h4>CPU (Sistema)</h4>
            <p>${resources.cpu.system.toFixed(2)} ms</p>
          </div>
          <div class="summary-box">
            <h4>Memoria RSS</h4>
            <p>${resources.memory.rss.end}</p>
            <small>Incremento: ${resources.memory.rss.diff}</small>
          </div>
          <div class="summary-box">
            <h4>Memoria Heap</h4>
            <p>${resources.memory.heapUsed.end}</p>
            <small>Incremento: ${resources.memory.heapUsed.diff}</small>
          </div>
        </div>
      `;
    }
    
    content += `
      </div>
    `;
  }
  
  // Pruebas de integración
  if (integrationTestReport) {
    content += `
      <div class="section">
        <h2>Pruebas de Integración</h2>
    `;
    
    // Resumen
    if (integrationTestReport.summary) {
      content += `
        <div class="summary-boxes">
          <div class="summary-box">
            <h4>Total de Pruebas</h4>
            <p>${integrationTestReport.summary.total}</p>
          </div>
          <div class="summary-box">
            <h4>Pruebas Pasadas</h4>
            <p class="status-passed">${integrationTestReport.summary.passed}</p>
          </div>
          <div class="summary-box">
            <h4>Pruebas Fallidas</h4>
            <p class="status-failed">${integrationTestReport.summary.failed}</p>
          </div>
          <div class="summary-box">
            <h4>Pruebas Omitidas</h4>
            <p class="status-skipped">${integrationTestReport.summary.skipped}</p>
          </div>
        </div>
      `;
      
      // Gráfico de resultados
      const chartData = [
        {
          label: 'Pasadas',
          value: integrationTestReport.summary.passed,
          color: '#27ae60'
        },
        {
          label: 'Fallidas',
          value: integrationTestReport.summary.failed,
          color: '#e74c3c'
        },
        {
          label: 'Omitidas',
          value: integrationTestReport.summary.skipped,
          color: '#f39c12'
        }
      ];
      
      content += generateBarChart('integration-test-chart', 'Resultados de Pruebas de Integración', chartData);
    }
    
    // Tabla de pruebas
    if (integrationTestReport.tests) {
      const tableData = integrationTestReport.tests.map(test => ({
        'Prueba': test.name,
        'Estado': test.status,
        'Duración (ms)': test.duration.toFixed(2),
        'Error': test.error || '-'
      }));
      
      content += generateTable('Detalle de Pruebas de Integración', tableData);
    }
    
    content += `
      </div>
    `;
  }
  
  // Monitoreo de recursos
  if (resourceMonitorReport) {
    content += `
      <div class="section">
        <h2>Monitoreo de Recursos</h2>
    `;
    
    // Resumen
    if (resourceMonitorReport.summary) {
      content += `
        <div class="summary-boxes">
          <div class="summary-box">
            <h4>CPU Proceso (Promedio)</h4>
            <p>${resourceMonitorReport.summary.process.cpu.avg.toFixed(2)}%</p>
            <small>Min: ${resourceMonitorReport.summary.process.cpu.min.toFixed(2)}%, Max: ${resourceMonitorReport.summary.process.cpu.max.toFixed(2)}%</small>
          </div>
          <div class="summary-box">
            <h4>Memoria RSS (Promedio)</h4>
            <p>${resourceMonitorReport.summary.process.memory.rss.avg.toFixed(2)} MB</p>
            <small>Min: ${resourceMonitorReport.summary.process.memory.rss.min.toFixed(2)} MB, Max: ${resourceMonitorReport.summary.process.memory.rss.max.toFixed(2)} MB</small>
          </div>
          <div class="summary-box">
            <h4>CPU Sistema (Promedio)</h4>
            <p>${resourceMonitorReport.summary.system.cpu.avg.toFixed(2)}%</p>
            <small>Min: ${resourceMonitorReport.summary.system.cpu.min.toFixed(2)}%, Max: ${resourceMonitorReport.summary.system.cpu.max.toFixed(2)}%</small>
          </div>
          <div class="summary-box">
            <h4>Memoria Sistema (Promedio)</h4>
            <p>${resourceMonitorReport.summary.system.memory.percent.avg.toFixed(2)}%</p>
            <small>Min: ${resourceMonitorReport.summary.system.memory.percent.min.toFixed(2)}%, Max: ${resourceMonitorReport.summary.system.memory.percent.max.toFixed(2)}%</small>
          </div>
        </div>
      `;
      
      // Gráficos de uso de recursos
      if (resourceMonitorReport.samples && resourceMonitorReport.samples.length > 0) {
        // Preparar datos para gráficos
        const timestamps = resourceMonitorReport.samples.map(sample => sample.elapsedTime / 1000); // Convertir a segundos
        
        // Gráfico de CPU
        const cpuDatasets = [
          {
            label: 'Proceso',
            data: resourceMonitorReport.samples.map(sample => sample.process.cpu),
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.2)',
            fill: true
          },
          {
            label: 'Sistema',
            data: resourceMonitorReport.samples.map(sample => sample.system.cpu.total),
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.2)',
            fill: true
          }
        ];
        
        content += generateLineChart('cpu-chart', 'Uso de CPU (%)', cpuDatasets, timestamps);
        
        // Gráfico de memoria
        const memoryDatasets = [
          {
            label: 'Proceso (RSS)',
            data: resourceMonitorReport.samples.map(sample => sample.process.memory.rss),
            borderColor: '#2ecc71',
            backgroundColor: 'rgba(46, 204, 113, 0.2)',
            fill: true
          },
          {
            label: 'Sistema (%)',
            data: resourceMonitorReport.samples.map(sample => sample.system.memory.usedPercent),
            borderColor: '#f39c12',
            backgroundColor: 'rgba(243, 156, 18, 0.2)',
            fill: true,
            yAxisID: 'y1'
          }
        ];
        
        content += generateLineChart('memory-chart', 'Uso de Memoria', memoryDatasets, timestamps);
      }
    }
    
    content += `
      </div>
    `;
  }
  
  // Conclusiones
  content += `
    <div class="section">
      <h2>Conclusiones</h2>
      <p>Basado en los resultados de las pruebas, se pueden extraer las siguientes conclusiones:</p>
      <ul>
  `;
  
  // Rendimiento
  if (performanceReport && performanceReport.tests) {
    const avgTimes = Object.values(performanceReport.tests).map(test => test.average);
    const avgTime = avgTimes.reduce((sum, time) => sum + time, 0) / avgTimes.length;
    
    if (avgTime < 50) {
      content += `<li>El rendimiento general de la aplicación es <strong>excelente</strong>, con tiempos de respuesta promedio por debajo de 50 ms.</li>`;
    } else if (avgTime < 100) {
      content += `<li>El rendimiento general de la aplicación es <strong>muy bueno</strong>, con tiempos de respuesta promedio por debajo de 100 ms.</li>`;
    } else if (avgTime < 200) {
      content += `<li>El rendimiento general de la aplicación es <strong>bueno</strong>, con tiempos de respuesta promedio por debajo de 200 ms.</li>`;
    } else {
      content += `<li>El rendimiento general de la aplicación es <strong>aceptable</strong>, pero podría mejorarse para reducir los tiempos de respuesta promedio (${avgTime.toFixed(2)} ms).</li>`;
    }
  }
  
  // Carga
  if (loadTestReport && loadTestReport.summary) {
    const opsPerSecond = parseFloat(loadTestReport.summary.operationsPerSecond);
    const successRate = parseFloat(loadTestReport.summary.successRate);
    
    if (opsPerSecond > 100) {
      content += `<li>La aplicación maneja <strong>muy bien</strong> la carga, procesando más de 100 operaciones por segundo.</li>`;
    } else if (opsPerSecond > 50) {
      content += `<li>La aplicación maneja <strong>bien</strong> la carga, procesando más de 50 operaciones por segundo.</li>`;
    } else {
      content += `<li>La capacidad de la aplicación para manejar carga es <strong>limitada</strong>, procesando solo ${opsPerSecond.toFixed(2)} operaciones por segundo.</li>`;
    }
    
    if (successRate > 99) {
      content += `<li>La tasa de éxito bajo carga es <strong>excelente</strong> (${successRate}%).</li>`;
    } else if (successRate > 95) {
      content += `<li>La tasa de éxito bajo carga es <strong>buena</strong> (${successRate}%), pero podría mejorarse.</li>`;
    } else {
      content += `<li>La tasa de éxito bajo carga es <strong>preocupante</strong> (${successRate}%) y debería mejorarse.</li>`;
    }
  }
  
  // Integración
  if (integrationTestReport && integrationTestReport.summary) {
    const passRate = (integrationTestReport.summary.passed / integrationTestReport.summary.total) * 100;
    
    if (passRate === 100) {
      content += `<li>Todas las pruebas de integración <strong>pasaron</strong>, lo que indica una buena integración entre los componentes.</li>`;
    } else if (passRate > 90) {
      content += `<li>La mayoría de las pruebas de integración pasaron (${passRate.toFixed(2)}%), lo que indica una <strong>buena</strong> integración entre los componentes con algunos problemas menores.</li>`;
    } else {
      content += `<li>Hay <strong>problemas significativos</strong> en la integración entre los componentes, con solo ${passRate.toFixed(2)}% de las pruebas pasando.</li>`;
    }
  }
  
  // Recursos
  if (resourceMonitorReport && resourceMonitorReport.summary) {
    const avgCpu = resourceMonitorReport.summary.process.cpu.avg;
    const maxCpu = resourceMonitorReport.summary.process.cpu.max;
    const avgMem = resourceMonitorReport.summary.process.memory.rss.avg;
    const maxMem = resourceMonitorReport.summary.process.memory.rss.max;
    
    if (maxCpu < 50) {
      content += `<li>El uso de CPU es <strong>eficiente</strong>, con un máximo de ${maxCpu.toFixed(2)}% y un promedio de ${avgCpu.toFixed(2)}%.</li>`;
    } else if (maxCpu < 80) {
      content += `<li>El uso de CPU es <strong>moderado</strong>, con un máximo de ${maxCpu.toFixed(2)}% y un promedio de ${avgCpu.toFixed(2)}%.</li>`;
    } else {
      content += `<li>El uso de CPU es <strong>intensivo</strong>, con picos de hasta ${maxCpu.toFixed(2)}% y un promedio de ${avgCpu.toFixed(2)}%.</li>`;
    }
    
    if (maxMem < 100) {
      content += `<li>El uso de memoria es <strong>eficiente</strong>, con un máximo de ${maxMem.toFixed(2)} MB y un promedio de ${avgMem.toFixed(2)} MB.</li>`;
    } else if (maxMem < 200) {
      content += `<li>El uso de memoria es <strong>moderado</strong>, con un máximo de ${maxMem.toFixed(2)} MB y un promedio de ${avgMem.toFixed(2)} MB.</li>`;
    } else {
      content += `<li>El uso de memoria es <strong>intensivo</strong>, con picos de hasta ${maxMem.toFixed(2)} MB y un promedio de ${avgMem.toFixed(2)} MB.</li>`;
    }
  }
  
  content += `
      </ul>
      
      <h3>Recomendaciones</h3>
      <ul>
  `;
  
  // Recomendaciones generales
  content += `
        <li>Realizar pruebas periódicas de rendimiento para detectar regresiones.</li>
        <li>Monitorear el uso de recursos en producción para identificar posibles problemas.</li>
        <li>Implementar un sistema de alertas para detectar problemas de rendimiento en tiempo real.</li>
  `;
  
  // Recomendaciones específicas
  if (performanceReport && performanceReport.tests) {
    const slowestTest = Object.entries(performanceReport.tests)
      .sort((a, b) => b[1].average - a[1].average)[0];
    
    if (slowestTest && slowestTest[1].average > 100) {
      content += `<li>Optimizar la operación "${slowestTest[0]}" que tiene un tiempo de respuesta promedio de ${slowestTest[1].average.toFixed(2)} ms.</li>`;
    }
  }
  
  if (loadTestReport && loadTestReport.summary) {
    const successRate = parseFloat(loadTestReport.summary.successRate);
    
    if (successRate < 95) {
      content += `<li>Mejorar la robustez de la aplicación bajo carga para aumentar la tasa de éxito (actualmente ${successRate}%).</li>`;
    }
  }
  
  if (integrationTestReport && integrationTestReport.summary && integrationTestReport.summary.failed > 0) {
    content += `<li>Corregir los problemas de integración identificados en las ${integrationTestReport.summary.failed} pruebas fallidas.</li>`;
  }
  
  if (resourceMonitorReport && resourceMonitorReport.summary) {
    const maxCpu = resourceMonitorReport.summary.process.cpu.max;
    const maxMem = resourceMonitorReport.summary.process.memory.rss.max;
    
    if (maxCpu > 80) {
      content += `<li>Optimizar el uso de CPU para reducir los picos (actualmente ${maxCpu.toFixed(2)}%).</li>`;
    }
    
    if (maxMem > 200) {
      content += `<li>Optimizar el uso de memoria para reducir los picos (actualmente ${maxMem.toFixed(2)} MB).</li>`;
    }
  }
  
  content += `
      </ul>
    </div>
    
    <div class="footer">
      <p>Informe generado para el Asistente de Ventas WhatsApp</p>
      <p>© ${new Date().getFullYear()} Tu Empresa</p>
    </div>
  </body>
  </html>
  `;
  
  // Guardar informe
  fs.writeFileSync(OUTPUT_REPORT, content);
  console.log(`Informe generado en ${OUTPUT_REPORT}`);
}

// Generar informe
generateReport();
