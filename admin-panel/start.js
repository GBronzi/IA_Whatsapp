/**
 * start.js - Script para iniciar el panel de administración
 */

const server = require('./server');

// Iniciar servidor
server.listen(process.env.ADMIN_PORT || 3000, () => {
  console.log(`Panel de administración iniciado en http://localhost:${process.env.ADMIN_PORT || 3000}`);
});
