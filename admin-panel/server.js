/**
 * server.js - Servidor principal para el panel de administración
 */

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const authManager = require('../auth-manager');
const config = require('../config');

// Crear aplicación Express
const app = express();
const PORT = process.env.ADMIN_PORT || 3000;

// Configurar middleware
app.use(helmet()); // Seguridad
app.use(morgan('combined')); // Logging
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? config.ADMIN_ALLOWED_ORIGINS : '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configurar motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configurar sesión
app.use(session({
  secret: config.SESSION_SECRET || 'asistente-ventas-whatsapp-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Configurar Passport
app.use(passport.initialize());
app.use(passport.session());

// Estrategia de autenticación local
passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      // Autenticar usuario
      const authResult = await authManager.authenticateUser(username, password);
      
      if (!authResult.success) {
        return done(null, false, { message: authResult.message });
      }
      
      if (authResult.requiresTwoFactor) {
        return done(null, { 
          id: authResult.user.id,
          username: authResult.user.username,
          requiresTwoFactor: true 
        });
      }
      
      return done(null, authResult.user);
    } catch (error) {
      return done(error);
    }
  }
));

// Serialización y deserialización de usuario
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    // Buscar usuario por ID
    const users = authManager.getAllUsers();
    const user = users.find(u => u.id === id);
    
    if (!user) {
      return done(null, false);
    }
    
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Middleware para verificar autenticación
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Middleware para verificar rol de administrador
function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  res.status(403).render('error', { 
    message: 'Acceso denegado', 
    error: { status: 403, stack: '' } 
  });
}

// Rutas
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { 
    title: 'Iniciar sesión',
    error: req.query.error 
  });
});

app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    
    if (!user) {
      return res.redirect('/login?error=' + encodeURIComponent(info.message));
    }
    
    if (user.requiresTwoFactor) {
      req.session.twoFactorUser = user;
      return res.redirect('/verify-2fa');
    }
    
    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      return res.redirect('/dashboard');
    });
  })(req, res, next);
});

app.get('/verify-2fa', (req, res) => {
  if (!req.session.twoFactorUser) {
    return res.redirect('/login');
  }
  
  res.render('verify-2fa', { 
    title: 'Verificación de dos factores',
    username: req.session.twoFactorUser.username,
    error: req.query.error 
  });
});

app.post('/verify-2fa', async (req, res, next) => {
  if (!req.session.twoFactorUser) {
    return res.redirect('/login');
  }
  
  const { code } = req.body;
  const { username } = req.session.twoFactorUser;
  
  try {
    const result = await authManager.verifyTwoFactorCode(username, code);
    
    if (!result.success) {
      return res.redirect('/verify-2fa?error=' + encodeURIComponent(result.message));
    }
    
    req.logIn(result.user, (err) => {
      if (err) {
        return next(err);
      }
      
      // Limpiar datos de sesión
      delete req.session.twoFactorUser;
      
      return res.redirect('/dashboard');
    });
  } catch (error) {
    next(error);
  }
});

app.get('/logout', (req, res) => {
  req.logout(() => {
    res.redirect('/login');
  });
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.render('dashboard', { 
    title: 'Panel de control',
    user: req.user 
  });
});

// Cargar rutas
const apiRoutes = require('./routes/api');
const clientsRoutes = require('./routes/clients');
const analyticsRoutes = require('./routes/analytics');
const settingsRoutes = require('./routes/settings');
const predictiveRoutes = require('./routes/predictive');

app.use('/api', apiRoutes);
app.use('/clients', isAuthenticated, clientsRoutes);
app.use('/analytics', isAuthenticated, analyticsRoutes);
app.use('/settings', isAuthenticated, isAdmin, settingsRoutes);
app.use('/predictive', isAuthenticated, predictiveRoutes);

// Manejo de errores
app.use((req, res, next) => {
  res.status(404).render('error', { 
    message: 'Página no encontrada', 
    error: { status: 404, stack: '' } 
  });
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  const stack = process.env.NODE_ENV === 'production' ? '' : err.stack;
  
  res.status(status).render('error', { 
    message: err.message, 
    error: { status, stack } 
  });
});

// Iniciar servidor
async function startServer() {
  try {
    // Inicializar gestor de autenticación
    await authManager.initialize();
    
    // Verificar si hay usuarios, si no, crear uno por defecto
    const users = authManager.getAllUsers();
    
    if (users.length === 0) {
      console.log('No hay usuarios, creando usuario administrador por defecto...');
      
      await authManager.createUser({
        username: 'admin',
        password: 'admin123',
        fullName: 'Administrador',
        email: 'admin@example.com',
        role: 'admin'
      });
      
      console.log('Usuario administrador creado con éxito.');
      console.log('Usuario: admin');
      console.log('Contraseña: admin123');
      console.log('¡Cambie esta contraseña inmediatamente después de iniciar sesión!');
    }
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`Servidor del panel de administración iniciado en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Iniciar servidor si este archivo es ejecutado directamente
if (require.main === module) {
  startServer();
}

module.exports = app;
