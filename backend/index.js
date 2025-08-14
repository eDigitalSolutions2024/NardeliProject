// ✅ 1) Cargar env primero
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 8010;
const FRONT = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

const path = require('path');

// (Opcional) si usarás cookies secure detrás de proxy:
// app.set('trust proxy', 1);

// ✅ 3) Static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ 4) Middlewares
app.use(cors({
  origin: FRONT,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(cookieParser());

// ✅ 5) Rutas
app.get('/api/ping', (_req, res) => res.send('pong'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/login'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/reservas', require('./routes/reservas'));
app.use('/api/productos', require('./routes/productos'));
// Si tienes inventario por separado:
// app.use('/api/inventario', require('./routes/inventario'));

// 404 JSON
app.use((req, res) => {
  res.status(404).json({ msg: 'No encontrado' });
});

// Handler de errores
// (Si alguna ruta hace next(err), caerá aquí)
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ msg: err.message || 'Error del servidor' });
});

// ✅ 6) Conectar DB y arrancar
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    console.error('No se pudo conectar a MongoDB:', e?.message || e);
    process.exit(1);
  });

module.exports = app;
