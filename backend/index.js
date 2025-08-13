// ✅ 1) Cargar env primero
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');

// ✅ 2) Conectar a DB (ya con MONGO_URI disponible)
connectDB();

const app = express();
const PORT = process.env.PORT || 8010;
const FRONT = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

// (Opcional) si usarás cookies secure detrás de proxy:
// app.set('trust proxy', 1);

// ✅ 3) Static
app.use('/uploads', express.static('uploads'));

// ✅ 4) Middlewares (una sola config de CORS)
app.use(cors({
  origin: FRONT,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(cookieParser());

// ✅ 5) Rutas
const authRoutes = require('./routes/auth');
const loginRoutes = require('./routes/login');
const usuariosRoutes = require('./routes/usuarios');
const reservasRoutes = require('./routes/reservas');
const productosRoutes = require('./routes/productos');

app.use('/api/auth', authRoutes);
app.use('/api', loginRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/productos', productosRoutes);

// ✅ 6) Healthcheck
app.get('/api/ping', (_req, res) => res.send('pong'));

// ✅ 7) Servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;
