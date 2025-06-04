const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8010;

// Middlewares
const allowedOrigins = [
  'http://localhost:3000',               // Para desarrollo local
  'https://centrodeeventosnardeli.com',
  'http://centrodeeventosnardeli.com'    // Producción (ajusta si usas HTTP o dominio diferente)
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Usuarios de ejemplo (en un proyecto real usarías una base de datos)
const users = [
  {
    id: 1,
    email: 'admin1@gmail.com',
    password: '123456', // En producción, siempre hashear contraseñas
    name: 'Eduardo Olivas'
  },
  {
    id: 2,
    email: 'admin@honeywell.com',
    password: 'admin123',
    name: 'Administrador'
  }
];

// Ruta de prueba
app.get('/api/ping', (req, res) => {
  res.send('pong');
});

// Ruta de login
app.post('/api/login', (req, res) => {
  console.log('Se recibió POST a /api/login');
  console.log('BODY recibido:', req.body); 
  const { email, password } = req.body;
  
  // Validar que se envíen email y password
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email y contraseña son requeridos'
    });
  }
  
  // Buscar usuario
  const user = users.find(u => u.email === email && u.password === password);
  
  if (user) {
    // Login exitoso
    res.json({
      success: true,
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } else {
    // Credenciales incorrectas
    res.status(401).json({
      success: false,
      message: 'Credenciales incorrectas'
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;