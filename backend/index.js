const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
connectDB();

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

const usuariosRoutes = require('./routes/usuarios');
app.use('/api/usuarios', usuariosRoutes);

// Usuarios de ejemplo (en un proyecto real usarías una base de datos)
/*const users = [
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
];*/

// Ruta de prueba
app.get('/api/ping', (req, res) => {
  res.send('pong');
});

// Ruta de login
const Usuario = require('./models/Usuario'); // importa el modelo real

app.post('/api/login', async (req, res) => {
  console.log('Se recibió POST a /api/login');
  console.log('BODY recibido:', req.body);

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email y contraseña son requeridos'
    });
  }

  try {
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
    }

    if (usuario.password !== password) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }

    res.json({
      success: true,
      message: 'Login exitoso',
      user: {
        id: usuario._id,
        email: usuario.email,
        name: usuario.fullname,
        role: usuario.role
      }
    });
  } catch (error) {
    console.error('Error en login:', error.message);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});


// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;