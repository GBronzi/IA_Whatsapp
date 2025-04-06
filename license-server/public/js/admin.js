/**
 * Panel de Administración - Asistente de Ventas WhatsApp
 * 
 * Este script maneja la funcionalidad del panel de administración para
 * gestionar licencias y usuarios.
 */

// Variables globales
let authToken = localStorage.getItem('authToken');
let currentUser = null;

// Elementos DOM
const loginContainer = document.getElementById('login-container');
const mainContainer = document.getElementById('main-container');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const navLinks = document.querySelectorAll('.nav-link');
const sectionContents = document.querySelectorAll('.section-content');

// Modales
const generateLicenseModal = new bootstrap.Modal(document.getElementById('generate-license-modal'));
const addUserModal = new bootstrap.Modal(document.getElementById('add-user-modal'));
const licenseResultModal = new bootstrap.Modal(document.getElementById('license-result-modal'));

// Botones
const generateLicenseBtn = document.getElementById('generate-license-btn');
const newLicenseBtn = document.getElementById('new-license-btn');
const confirmGenerateLicenseBtn = document.getElementById('confirm-generate-license');
const addUserBtn = document.getElementById('add-user-btn');
const newUserBtn = document.getElementById('new-user-btn');
const confirmAddUserBtn = document.getElementById('confirm-add-user');
const copyLicenseBtn = document.getElementById('copy-license-btn');

// Tablas
const licensesTableBody = document.getElementById('licenses-table-body');
const usersTableBody = document.getElementById('users-table-body');

// Contadores
const activeLicensesCount = document.getElementById('active-licenses-count');
const usersCount = document.getElementById('users-count');
const expiredLicensesCount = document.getElementById('expired-licenses-count');

// Información del sistema
const appVersion = document.getElementById('app-version');
const appEnvironment = document.getElementById('app-environment');
const appPort = document.getElementById('app-port');
const sslStatus = document.getElementById('ssl-status');
const dbStatus = document.getElementById('db-status');
const lastUpdate = document.getElementById('last-update');

// Formulario de configuración
const settingsForm = document.getElementById('settings-form');
const appNameInput = document.getElementById('app-name');
const clientUrlInput = document.getElementById('client-url');
const sslEnabledCheckbox = document.getElementById('ssl-enabled');

// Actividad reciente
const recentActivity = document.getElementById('recent-activity');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  // Verificar autenticación
  checkAuth();
  
  // Eventos de navegación
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      // Desactivar todos los enlaces
      navLinks.forEach(l => l.classList.remove('active'));
      
      // Activar enlace actual
      link.classList.add('active');
      
      // Mostrar sección correspondiente
      const sectionId = link.getAttribute('data-section');
      sectionContents.forEach(section => {
        section.classList.add('hidden');
      });
      document.getElementById(`${sectionId}-section`).classList.remove('hidden');
    });
  });
  
  // Evento de login
  loginBtn.addEventListener('click', login);
  
  // Evento de logout
  logoutBtn.addEventListener('click', logout);
  
  // Eventos de formularios
  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      passwordInput.focus();
    }
  });
  
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      login();
    }
  });
  
  // Eventos de botones
  generateLicenseBtn.addEventListener('click', () => generateLicenseModal.show());
  newLicenseBtn.addEventListener('click', () => generateLicenseModal.show());
  confirmGenerateLicenseBtn.addEventListener('click', generateLicense);
  
  addUserBtn.addEventListener('click', () => addUserModal.show());
  newUserBtn.addEventListener('click', () => addUserModal.show());
  confirmAddUserBtn.addEventListener('click', addUser);
  
  copyLicenseBtn.addEventListener('click', copyLicenseKey);
  
  // Evento de formulario de configuración
  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
  });
});

/**
 * Verifica la autenticación del usuario
 */
function checkAuth() {
  if (authToken) {
    // Verificar token con el servidor
    fetch('/api/verify-token', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('Token inválido');
      }
    })
    .then(data => {
      if (data.valid) {
        // Token válido, mostrar panel
        currentUser = data.user;
        showDashboard();
        loadDashboardData();
      } else {
        // Token inválido, mostrar login
        localStorage.removeItem('authToken');
        authToken = null;
        showLogin();
      }
    })
    .catch(error => {
      console.error('Error al verificar token:', error);
      localStorage.removeItem('authToken');
      authToken = null;
      showLogin();
    });
  } else {
    // No hay token, mostrar login
    showLogin();
  }
}

/**
 * Inicia sesión con las credenciales proporcionadas
 */
function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!username || !password) {
    showLoginError('Por favor, ingresa usuario y contraseña');
    return;
  }
  
  // Deshabilitar botón de login
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Iniciando sesión...';
  
  // Ocultar mensaje de error
  loginError.classList.add('hidden');
  
  // Enviar solicitud de login
  fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error('Credenciales inválidas');
    }
  })
  .then(data => {
    if (data.success) {
      // Guardar token
      authToken = data.token;
      localStorage.setItem('authToken', authToken);
      
      // Guardar usuario
      currentUser = data.user;
      
      // Mostrar dashboard
      showDashboard();
      loadDashboardData();
      
      // Limpiar campos
      usernameInput.value = '';
      passwordInput.value = '';
    } else {
      showLoginError(data.message || 'Error al iniciar sesión');
    }
  })
  .catch(error => {
    console.error('Error al iniciar sesión:', error);
    showLoginError('Error al iniciar sesión');
  })
  .finally(() => {
    // Restaurar botón de login
    loginBtn.disabled = false;
    loginBtn.textContent = 'Iniciar sesión';
  });
}

/**
 * Cierra la sesión del usuario
 */
function logout() {
  // Eliminar token
  localStorage.removeItem('authToken');
  authToken = null;
  currentUser = null;
  
  // Mostrar login
  showLogin();
}

/**
 * Muestra el formulario de login
 */
function showLogin() {
  loginContainer.classList.remove('hidden');
  mainContainer.classList.add('hidden');
}

/**
 * Muestra el dashboard
 */
function showDashboard() {
  loginContainer.classList.add('hidden');
  mainContainer.classList.remove('hidden');
}

/**
 * Muestra un mensaje de error en el formulario de login
 * @param {string} message - Mensaje de error
 */
function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

/**
 * Carga los datos del dashboard
 */
function loadDashboardData() {
  // Cargar licencias
  loadLicenses();
  
  // Cargar usuarios
  loadUsers();
  
  // Cargar información del sistema
  loadSystemInfo();
  
  // Cargar actividad reciente
  loadRecentActivity();
}

/**
 * Carga la lista de licencias
 */
function loadLicenses() {
  if (!authToken) return;
  
  fetch('/api/licenses', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error('Error al cargar licencias');
    }
  })
  .then(data => {
    if (data.success) {
      // Actualizar contadores
      const active = data.licenses.filter(license => license.status === 'active').length;
      const expired = data.licenses.filter(license => license.status === 'expired').length;
      
      activeLicensesCount.textContent = active;
      expiredLicensesCount.textContent = expired;
      
      // Actualizar tabla de licencias
      updateLicensesTable(data.licenses);
    } else {
      console.error('Error al cargar licencias:', data.message);
    }
  })
  .catch(error => {
    console.error('Error al cargar licencias:', error);
  });
}

/**
 * Carga la lista de usuarios
 */
function loadUsers() {
  if (!authToken) return;
  
  fetch('/api/users', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error('Error al cargar usuarios');
    }
  })
  .then(data => {
    if (data.success) {
      // Actualizar contador
      usersCount.textContent = data.users.length;
      
      // Actualizar tabla de usuarios
      updateUsersTable(data.users);
    } else {
      console.error('Error al cargar usuarios:', data.message);
    }
  })
  .catch(error => {
    console.error('Error al cargar usuarios:', error);
  });
}

/**
 * Carga la información del sistema
 */
function loadSystemInfo() {
  if (!authToken) return;
  
  fetch('/api/system-info', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error('Error al cargar información del sistema');
    }
  })
  .then(data => {
    if (data.success) {
      // Actualizar información del sistema
      appVersion.textContent = data.version || '1.0.0';
      appEnvironment.textContent = data.environment || 'Desarrollo';
      appPort.textContent = data.port || '3000';
      sslStatus.textContent = data.ssl ? 'Activado' : 'Desactivado';
      dbStatus.textContent = data.dbConnected ? 'Conectada' : 'Desconectada';
      lastUpdate.textContent = new Date(data.lastUpdate || Date.now()).toLocaleDateString();
      
      // Actualizar formulario de configuración
      appNameInput.value = data.appName || 'Asistente de Ventas WhatsApp';
      clientUrlInput.value = data.clientUrl || 'http://localhost:8080';
      sslEnabledCheckbox.checked = data.ssl || false;
    } else {
      console.error('Error al cargar información del sistema:', data.message);
    }
  })
  .catch(error => {
    console.error('Error al cargar información del sistema:', error);
  });
}

/**
 * Carga la actividad reciente
 */
function loadRecentActivity() {
  if (!authToken) return;
  
  fetch('/api/recent-activity', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error('Error al cargar actividad reciente');
    }
  })
  .then(data => {
    if (data.success && data.activities.length > 0) {
      // Actualizar lista de actividad reciente
      recentActivity.innerHTML = '';
      
      data.activities.forEach(activity => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        
        const timestamp = new Date(activity.timestamp).toLocaleString();
        li.innerHTML = `
          <div class="d-flex justify-content-between">
            <span>${activity.description}</span>
            <small class="text-muted">${timestamp}</small>
          </div>
        `;
        
        recentActivity.appendChild(li);
      });
    } else {
      recentActivity.innerHTML = '<li class="list-group-item">No hay actividad reciente</li>';
    }
  })
  .catch(error => {
    console.error('Error al cargar actividad reciente:', error);
    recentActivity.innerHTML = '<li class="list-group-item">Error al cargar actividad reciente</li>';
  });
}

/**
 * Actualiza la tabla de licencias
 * @param {Array} licenses - Lista de licencias
 */
function updateLicensesTable(licenses) {
  if (!licenses || licenses.length === 0) {
    licensesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay licencias disponibles</td></tr>';
    return;
  }
  
  licensesTableBody.innerHTML = '';
  
  licenses.forEach(license => {
    const tr = document.createElement('tr');
    
    // Formatear fecha de expiración
    let expiryText = 'Permanente';
    if (license.expiryDate && license.expiryDate !== 'permanent') {
      expiryText = new Date(license.expiryDate).toLocaleDateString();
    }
    
    // Formatear fecha de última activación
    let lastActivatedText = 'Nunca';
    if (license.lastActivated) {
      lastActivatedText = new Date(license.lastActivated).toLocaleDateString();
    }
    
    // Determinar clase de estado
    let statusClass = '';
    switch (license.status) {
      case 'active':
        statusClass = 'status-active';
        break;
      case 'inactive':
        statusClass = 'status-inactive';
        break;
      case 'expired':
        statusClass = 'status-expired';
        break;
      case 'revoked':
        statusClass = 'status-revoked';
        break;
    }
    
    tr.innerHTML = `
      <td>${license.key.substring(0, 10)}...</td>
      <td>${license.userName || 'No asignado'}</td>
      <td><span class="status-badge ${statusClass}">${license.status}</span></td>
      <td>${expiryText}</td>
      <td>${lastActivatedText}</td>
      <td>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary view-license-btn" data-id="${license.key}">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-outline-danger revoke-license-btn" data-id="${license.key}" ${license.status === 'revoked' ? 'disabled' : ''}>
            <i class="bi bi-x-circle"></i>
          </button>
        </div>
      </td>
    `;
    
    licensesTableBody.appendChild(tr);
  });
  
  // Añadir eventos a los botones
  document.querySelectorAll('.view-license-btn').forEach(btn => {
    btn.addEventListener('click', () => viewLicense(btn.getAttribute('data-id')));
  });
  
  document.querySelectorAll('.revoke-license-btn').forEach(btn => {
    btn.addEventListener('click', () => revokeLicense(btn.getAttribute('data-id')));
  });
}

/**
 * Actualiza la tabla de usuarios
 * @param {Array} users - Lista de usuarios
 */
function updateUsersTable(users) {
  if (!users || users.length === 0) {
    usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No hay usuarios disponibles</td></tr>';
    return;
  }
  
  usersTableBody.innerHTML = '';
  
  users.forEach(user => {
    const tr = document.createElement('tr');
    
    // Formatear fecha de creación
    let createdAtText = 'Desconocido';
    if (user.createdAt) {
      createdAtText = new Date(user.createdAt).toLocaleDateString();
    }
    
    tr.innerHTML = `
      <td>${user.id.substring(0, 8)}</td>
      <td>${user.username}</td>
      <td>${user.role}</td>
      <td>${createdAtText}</td>
      <td>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary edit-user-btn" data-id="${user.id}">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn btn-outline-danger delete-user-btn" data-id="${user.id}" ${user.id === currentUser?.id ? 'disabled' : ''}>
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;
    
    usersTableBody.appendChild(tr);
  });
  
  // Añadir eventos a los botones
  document.querySelectorAll('.edit-user-btn').forEach(btn => {
    btn.addEventListener('click', () => editUser(btn.getAttribute('data-id')));
  });
  
  document.querySelectorAll('.delete-user-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteUser(btn.getAttribute('data-id')));
  });
}

/**
 * Genera una nueva licencia
 */
function generateLicense() {
  if (!authToken) return;
  
  const appName = document.getElementById('license-app-name').value.trim();
  const userName = document.getElementById('license-username').value.trim();
  const expiryDays = parseInt(document.getElementById('license-expiry').value);
  
  if (!appName || !userName) {
    alert('Por favor, completa todos los campos');
    return;
  }
  
  // Deshabilitar botón
  confirmGenerateLicenseBtn.disabled = true;
  confirmGenerateLicenseBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generando...';
  
  // Enviar solicitud
  fetch('/api/generate-license', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      appName,
      userName,
      expiryDays
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error('Error al generar licencia');
    }
  })
  .then(data => {
    if (data.success) {
      // Ocultar modal de generación
      generateLicenseModal.hide();
      
      // Mostrar licencia generada
      document.getElementById('license-key-result').value = data.licenseKey;
      licenseResultModal.show();
      
      // Recargar licencias
      loadLicenses();
      
      // Limpiar formulario
      document.getElementById('license-username').value = '';
      document.getElementById('license-expiry').value = '365';
    } else {
      alert(data.message || 'Error al generar licencia');
    }
  })
  .catch(error => {
    console.error('Error al generar licencia:', error);
    alert('Error al generar licencia');
  })
  .finally(() => {
    // Restaurar botón
    confirmGenerateLicenseBtn.disabled = false;
    confirmGenerateLicenseBtn.textContent = 'Generar';
  });
}

/**
 * Añade un nuevo usuario
 */
function addUser() {
  if (!authToken) return;
  
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value.trim();
  const role = document.getElementById('user-role').value;
  
  if (!username || !password) {
    alert('Por favor, completa todos los campos');
    return;
  }
  
  // Deshabilitar botón
  confirmAddUserBtn.disabled = true;
  confirmAddUserBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Añadiendo...';
  
  // Enviar solicitud
  fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      username,
      password,
      role
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error('Error al añadir usuario');
    }
  })
  .then(data => {
    if (data.success) {
      // Ocultar modal
      addUserModal.hide();
      
      // Recargar usuarios
      loadUsers();
      
      // Limpiar formulario
      document.getElementById('new-username').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('user-role').value = 'user';
    } else {
      alert(data.message || 'Error al añadir usuario');
    }
  })
  .catch(error => {
    console.error('Error al añadir usuario:', error);
    alert('Error al añadir usuario');
  })
  .finally(() => {
    // Restaurar botón
    confirmAddUserBtn.disabled = false;
    confirmAddUserBtn.textContent = 'Añadir';
  });
}

/**
 * Copia la clave de licencia al portapapeles
 */
function copyLicenseKey() {
  const licenseKey = document.getElementById('license-key-result').value;
  
  if (!licenseKey) return;
  
  // Copiar al portapapeles
  navigator.clipboard.writeText(licenseKey)
    .then(() => {
      // Cambiar texto del botón temporalmente
      copyLicenseBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i> Copiado';
      
      // Restaurar texto después de 2 segundos
      setTimeout(() => {
        copyLicenseBtn.innerHTML = '<i class="bi bi-clipboard me-2"></i> Copiar';
      }, 2000);
    })
    .catch(error => {
      console.error('Error al copiar al portapapeles:', error);
      alert('Error al copiar al portapapeles');
    });
}

/**
 * Guarda la configuración del sistema
 */
function saveSettings() {
  if (!authToken) return;
  
  const appName = appNameInput.value.trim();
  const clientUrl = clientUrlInput.value.trim();
  const sslEnabled = sslEnabledCheckbox.checked;
  
  // Enviar solicitud
  fetch('/api/settings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      appName,
      clientUrl,
      sslEnabled
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error('Error al guardar configuración');
    }
  })
  .then(data => {
    if (data.success) {
      alert('Configuración guardada correctamente');
      
      // Recargar información del sistema
      loadSystemInfo();
    } else {
      alert(data.message || 'Error al guardar configuración');
    }
  })
  .catch(error => {
    console.error('Error al guardar configuración:', error);
    alert('Error al guardar configuración');
  });
}

/**
 * Muestra los detalles de una licencia
 * @param {string} licenseKey - Clave de licencia
 */
function viewLicense(licenseKey) {
  if (!authToken || !licenseKey) return;
  
  // Implementar visualización de detalles de licencia
  alert('Función no implementada: Ver detalles de licencia ' + licenseKey);
}

/**
 * Revoca una licencia
 * @param {string} licenseKey - Clave de licencia
 */
function revokeLicense(licenseKey) {
  if (!authToken || !licenseKey) return;
  
  if (!confirm('¿Estás seguro de que deseas revocar esta licencia? Esta acción no se puede deshacer.')) {
    return;
  }
  
  // Enviar solicitud
  fetch('/api/revoke-license', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      licenseKey,
      reason: 'Revocada por administrador'
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error('Error al revocar licencia');
    }
  })
  .then(data => {
    if (data.success) {
      alert('Licencia revocada correctamente');
      
      // Recargar licencias
      loadLicenses();
    } else {
      alert(data.message || 'Error al revocar licencia');
    }
  })
  .catch(error => {
    console.error('Error al revocar licencia:', error);
    alert('Error al revocar licencia');
  });
}

/**
 * Edita un usuario
 * @param {string} userId - ID del usuario
 */
function editUser(userId) {
  if (!authToken || !userId) return;
  
  // Implementar edición de usuario
  alert('Función no implementada: Editar usuario ' + userId);
}

/**
 * Elimina un usuario
 * @param {string} userId - ID del usuario
 */
function deleteUser(userId) {
  if (!authToken || !userId) return;
  
  if (!confirm('¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.')) {
    return;
  }
  
  // Enviar solicitud
  fetch(`/api/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error('Error al eliminar usuario');
    }
  })
  .then(data => {
    if (data.success) {
      alert('Usuario eliminado correctamente');
      
      // Recargar usuarios
      loadUsers();
    } else {
      alert(data.message || 'Error al eliminar usuario');
    }
  })
  .catch(error => {
    console.error('Error al eliminar usuario:', error);
    alert('Error al eliminar usuario');
  });
}
