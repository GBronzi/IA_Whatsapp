/**
 * role-manager.js - Módulo para gestionar roles y permisos
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');

// Configuración
const ROLES_FILE = path.join(__dirname, 'roles.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// Roles predefinidos
const DEFAULT_ROLES = {
    admin: {
        name: 'Administrador',
        description: 'Acceso completo a todas las funcionalidades',
        permissions: [
            'app.start',
            'app.stop',
            'app.settings',
            'app.logs',
            'app.reports',
            'app.notifications',
            'app.users',
            'app.roles',
            'app.license',
            'chat.view',
            'chat.respond',
            'chat.delete',
            'client.view',
            'client.edit',
            'client.delete',
            'data.export',
            'data.import',
            'bitrix.sync'
        ]
    },
    supervisor: {
        name: 'Supervisor',
        description: 'Gestión de operaciones y reportes',
        permissions: [
            'app.start',
            'app.stop',
            'app.logs',
            'app.reports',
            'app.notifications',
            'chat.view',
            'chat.respond',
            'client.view',
            'client.edit',
            'data.export',
            'bitrix.sync'
        ]
    },
    operator: {
        name: 'Operador',
        description: 'Atención de chats y clientes',
        permissions: [
            'app.start',
            'app.stop',
            'app.notifications',
            'chat.view',
            'chat.respond',
            'client.view',
            'bitrix.sync'
        ]
    },
    viewer: {
        name: 'Visualizador',
        description: 'Solo visualización de datos',
        permissions: [
            'app.logs',
            'app.reports',
            'chat.view',
            'client.view'
        ]
    }
};

// Usuario administrador por defecto
const DEFAULT_ADMIN = {
    username: 'admin',
    password: hashPassword('admin123'),
    fullName: 'Administrador',
    email: 'admin@example.com',
    role: 'admin',
    active: true,
    lastLogin: null
};

// Caché de roles y usuarios
let roles = {};
let users = {};

/**
 * Inicializa el gestor de roles y permisos
 * @returns {Promise<boolean>} - true si la inicialización fue exitosa
 */
async function initialize() {
    try {
        // Cargar roles
        await loadRoles();
        
        // Cargar usuarios
        await loadUsers();
        
        // Crear roles y usuarios por defecto si no existen
        await createDefaultRolesIfNeeded();
        await createDefaultAdminIfNeeded();
        
        logger.info('Gestor de roles y permisos inicializado correctamente');
        return true;
    } catch (error) {
        logger.error(`Error al inicializar gestor de roles y permisos: ${error.message}`);
        return false;
    }
}

/**
 * Carga los roles desde el archivo
 * @returns {Promise<boolean>} - true si la carga fue exitosa
 */
async function loadRoles() {
    try {
        // Verificar si existe el archivo
        try {
            await fs.access(ROLES_FILE);
        } catch (error) {
            // Si no existe, crear uno con roles por defecto
            roles = DEFAULT_ROLES;
            await saveRoles();
            return true;
        }
        
        // Leer archivo
        const data = await fs.readFile(ROLES_FILE, 'utf8');
        roles = JSON.parse(data);
        
        logger.info('Roles cargados correctamente');
        return true;
    } catch (error) {
        logger.error(`Error al cargar roles: ${error.message}`);
        return false;
    }
}

/**
 * Guarda los roles en el archivo
 * @returns {Promise<boolean>} - true si se guardaron correctamente
 */
async function saveRoles() {
    try {
        await fs.writeFile(ROLES_FILE, JSON.stringify(roles, null, 2), 'utf8');
        logger.info('Roles guardados correctamente');
        return true;
    } catch (error) {
        logger.error(`Error al guardar roles: ${error.message}`);
        return false;
    }
}

/**
 * Carga los usuarios desde el archivo
 * @returns {Promise<boolean>} - true si la carga fue exitosa
 */
async function loadUsers() {
    try {
        // Verificar si existe el archivo
        try {
            await fs.access(USERS_FILE);
        } catch (error) {
            // Si no existe, crear uno con usuario admin por defecto
            users = { admin: DEFAULT_ADMIN };
            await saveUsers();
            return true;
        }
        
        // Leer archivo
        const data = await fs.readFile(USERS_FILE, 'utf8');
        users = JSON.parse(data);
        
        logger.info('Usuarios cargados correctamente');
        return true;
    } catch (error) {
        logger.error(`Error al cargar usuarios: ${error.message}`);
        return false;
    }
}

/**
 * Guarda los usuarios en el archivo
 * @returns {Promise<boolean>} - true si se guardaron correctamente
 */
async function saveUsers() {
    try {
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
        logger.info('Usuarios guardados correctamente');
        return true;
    } catch (error) {
        logger.error(`Error al guardar usuarios: ${error.message}`);
        return false;
    }
}

/**
 * Crea los roles por defecto si no existen
 * @returns {Promise<boolean>} - true si se crearon correctamente
 */
async function createDefaultRolesIfNeeded() {
    try {
        let modified = false;
        
        // Verificar si existen todos los roles por defecto
        for (const [roleId, roleData] of Object.entries(DEFAULT_ROLES)) {
            if (!roles[roleId]) {
                roles[roleId] = roleData;
                modified = true;
            }
        }
        
        // Guardar si se modificaron
        if (modified) {
            await saveRoles();
        }
        
        return true;
    } catch (error) {
        logger.error(`Error al crear roles por defecto: ${error.message}`);
        return false;
    }
}

/**
 * Crea el usuario administrador por defecto si no existe
 * @returns {Promise<boolean>} - true si se creó correctamente
 */
async function createDefaultAdminIfNeeded() {
    try {
        // Verificar si existe el usuario admin
        if (!users.admin) {
            users.admin = DEFAULT_ADMIN;
            await saveUsers();
        }
        
        return true;
    } catch (error) {
        logger.error(`Error al crear usuario admin por defecto: ${error.message}`);
        return false;
    }
}

/**
 * Hashea una contraseña
 * @param {string} password - Contraseña a hashear
 * @returns {string} - Hash de la contraseña
 */
function hashPassword(password) {
    return crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');
}

/**
 * Verifica las credenciales de un usuario
 * @param {string} username - Nombre de usuario
 * @param {string} password - Contraseña
 * @returns {Object|null} - Datos del usuario si las credenciales son válidas, null en caso contrario
 */
function verifyCredentials(username, password) {
    try {
        // Verificar si existe el usuario
        if (!users[username]) {
            return null;
        }
        
        // Verificar si el usuario está activo
        if (!users[username].active) {
            return null;
        }
        
        // Verificar contraseña
        const hashedPassword = hashPassword(password);
        if (users[username].password !== hashedPassword) {
            return null;
        }
        
        // Actualizar último login
        users[username].lastLogin = new Date().toISOString();
        saveUsers().catch(error => {
            logger.error(`Error al guardar último login: ${error.message}`);
        });
        
        // Devolver datos del usuario (sin contraseña)
        const { password: _, ...userData } = users[username];
        return userData;
    } catch (error) {
        logger.error(`Error al verificar credenciales: ${error.message}`);
        return null;
    }
}

/**
 * Verifica si un usuario tiene un permiso específico
 * @param {string} username - Nombre de usuario
 * @param {string} permission - Permiso a verificar
 * @returns {boolean} - true si el usuario tiene el permiso
 */
function hasPermission(username, permission) {
    try {
        // Verificar si existe el usuario
        if (!users[username]) {
            return false;
        }
        
        // Verificar si el usuario está activo
        if (!users[username].active) {
            return false;
        }
        
        // Obtener rol del usuario
        const role = users[username].role;
        
        // Verificar si existe el rol
        if (!roles[role]) {
            return false;
        }
        
        // Verificar si el rol tiene el permiso
        return roles[role].permissions.includes(permission);
    } catch (error) {
        logger.error(`Error al verificar permiso: ${error.message}`);
        return false;
    }
}

/**
 * Obtiene todos los permisos de un usuario
 * @param {string} username - Nombre de usuario
 * @returns {Array} - Lista de permisos
 */
function getUserPermissions(username) {
    try {
        // Verificar si existe el usuario
        if (!users[username]) {
            return [];
        }
        
        // Verificar si el usuario está activo
        if (!users[username].active) {
            return [];
        }
        
        // Obtener rol del usuario
        const role = users[username].role;
        
        // Verificar si existe el rol
        if (!roles[role]) {
            return [];
        }
        
        // Devolver permisos del rol
        return [...roles[role].permissions];
    } catch (error) {
        logger.error(`Error al obtener permisos de usuario: ${error.message}`);
        return [];
    }
}

/**
 * Crea un nuevo usuario
 * @param {Object} userData - Datos del usuario
 * @returns {boolean} - true si se creó correctamente
 */
async function createUser(userData) {
    try {
        // Validar datos requeridos
        if (!userData.username || !userData.password || !userData.role) {
            throw new Error('Faltan datos requeridos');
        }
        
        // Verificar si ya existe el usuario
        if (users[userData.username]) {
            throw new Error('El usuario ya existe');
        }
        
        // Verificar si existe el rol
        if (!roles[userData.role]) {
            throw new Error('El rol no existe');
        }
        
        // Crear usuario
        users[userData.username] = {
            username: userData.username,
            password: hashPassword(userData.password),
            fullName: userData.fullName || userData.username,
            email: userData.email || '',
            role: userData.role,
            active: userData.active !== undefined ? userData.active : true,
            lastLogin: null
        };
        
        // Guardar usuarios
        await saveUsers();
        
        logger.info(`Usuario creado: ${userData.username}`);
        return true;
    } catch (error) {
        logger.error(`Error al crear usuario: ${error.message}`);
        return false;
    }
}

/**
 * Actualiza un usuario existente
 * @param {string} username - Nombre de usuario
 * @param {Object} userData - Datos a actualizar
 * @returns {Promise<boolean>} - true si se actualizó correctamente
 */
async function updateUser(username, userData) {
    try {
        // Verificar si existe el usuario
        if (!users[username]) {
            throw new Error('El usuario no existe');
        }
        
        // Actualizar datos
        if (userData.fullName !== undefined) {
            users[username].fullName = userData.fullName;
        }
        
        if (userData.email !== undefined) {
            users[username].email = userData.email;
        }
        
        if (userData.role !== undefined) {
            // Verificar si existe el rol
            if (!roles[userData.role]) {
                throw new Error('El rol no existe');
            }
            
            users[username].role = userData.role;
        }
        
        if (userData.active !== undefined) {
            users[username].active = userData.active;
        }
        
        if (userData.password) {
            users[username].password = hashPassword(userData.password);
        }
        
        // Guardar usuarios
        await saveUsers();
        
        logger.info(`Usuario actualizado: ${username}`);
        return true;
    } catch (error) {
        logger.error(`Error al actualizar usuario: ${error.message}`);
        return false;
    }
}

/**
 * Elimina un usuario
 * @param {string} username - Nombre de usuario
 * @returns {Promise<boolean>} - true si se eliminó correctamente
 */
async function deleteUser(username) {
    try {
        // Verificar si existe el usuario
        if (!users[username]) {
            throw new Error('El usuario no existe');
        }
        
        // No permitir eliminar el usuario admin
        if (username === 'admin') {
            throw new Error('No se puede eliminar el usuario administrador');
        }
        
        // Eliminar usuario
        delete users[username];
        
        // Guardar usuarios
        await saveUsers();
        
        logger.info(`Usuario eliminado: ${username}`);
        return true;
    } catch (error) {
        logger.error(`Error al eliminar usuario: ${error.message}`);
        return false;
    }
}

/**
 * Obtiene todos los usuarios
 * @returns {Array} - Lista de usuarios
 */
function getAllUsers() {
    try {
        // Devolver usuarios sin contraseñas
        return Object.entries(users).map(([username, userData]) => {
            const { password, ...rest } = userData;
            return rest;
        });
    } catch (error) {
        logger.error(`Error al obtener usuarios: ${error.message}`);
        return [];
    }
}

/**
 * Obtiene todos los roles
 * @returns {Object} - Roles
 */
function getAllRoles() {
    return { ...roles };
}

/**
 * Crea un nuevo rol
 * @param {string} roleId - ID del rol
 * @param {Object} roleData - Datos del rol
 * @returns {Promise<boolean>} - true si se creó correctamente
 */
async function createRole(roleId, roleData) {
    try {
        // Validar datos requeridos
        if (!roleId || !roleData.name || !roleData.permissions) {
            throw new Error('Faltan datos requeridos');
        }
        
        // Verificar si ya existe el rol
        if (roles[roleId]) {
            throw new Error('El rol ya existe');
        }
        
        // Crear rol
        roles[roleId] = {
            name: roleData.name,
            description: roleData.description || '',
            permissions: roleData.permissions
        };
        
        // Guardar roles
        await saveRoles();
        
        logger.info(`Rol creado: ${roleId}`);
        return true;
    } catch (error) {
        logger.error(`Error al crear rol: ${error.message}`);
        return false;
    }
}

/**
 * Actualiza un rol existente
 * @param {string} roleId - ID del rol
 * @param {Object} roleData - Datos a actualizar
 * @returns {Promise<boolean>} - true si se actualizó correctamente
 */
async function updateRole(roleId, roleData) {
    try {
        // Verificar si existe el rol
        if (!roles[roleId]) {
            throw new Error('El rol no existe');
        }
        
        // No permitir modificar roles predefinidos
        if (Object.keys(DEFAULT_ROLES).includes(roleId)) {
            throw new Error('No se pueden modificar los roles predefinidos');
        }
        
        // Actualizar datos
        if (roleData.name !== undefined) {
            roles[roleId].name = roleData.name;
        }
        
        if (roleData.description !== undefined) {
            roles[roleId].description = roleData.description;
        }
        
        if (roleData.permissions !== undefined) {
            roles[roleId].permissions = roleData.permissions;
        }
        
        // Guardar roles
        await saveRoles();
        
        logger.info(`Rol actualizado: ${roleId}`);
        return true;
    } catch (error) {
        logger.error(`Error al actualizar rol: ${error.message}`);
        return false;
    }
}

/**
 * Elimina un rol
 * @param {string} roleId - ID del rol
 * @returns {Promise<boolean>} - true si se eliminó correctamente
 */
async function deleteRole(roleId) {
    try {
        // Verificar si existe el rol
        if (!roles[roleId]) {
            throw new Error('El rol no existe');
        }
        
        // No permitir eliminar roles predefinidos
        if (Object.keys(DEFAULT_ROLES).includes(roleId)) {
            throw new Error('No se pueden eliminar los roles predefinidos');
        }
        
        // Verificar si hay usuarios con este rol
        const usersWithRole = Object.values(users).filter(user => user.role === roleId);
        if (usersWithRole.length > 0) {
            throw new Error('No se puede eliminar el rol porque hay usuarios que lo utilizan');
        }
        
        // Eliminar rol
        delete roles[roleId];
        
        // Guardar roles
        await saveRoles();
        
        logger.info(`Rol eliminado: ${roleId}`);
        return true;
    } catch (error) {
        logger.error(`Error al eliminar rol: ${error.message}`);
        return false;
    }
}

/**
 * Obtiene todos los permisos disponibles
 * @returns {Array} - Lista de permisos
 */
function getAllPermissions() {
    // Obtener todos los permisos únicos de todos los roles
    const allPermissions = new Set();
    
    Object.values(roles).forEach(role => {
        role.permissions.forEach(permission => {
            allPermissions.add(permission);
        });
    });
    
    return Array.from(allPermissions).sort();
}

module.exports = {
    initialize,
    verifyCredentials,
    hasPermission,
    getUserPermissions,
    createUser,
    updateUser,
    deleteUser,
    getAllUsers,
    getAllRoles,
    createRole,
    updateRole,
    deleteRole,
    getAllPermissions
};
