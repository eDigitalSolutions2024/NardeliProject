// ✅ 1) Cargar env primero
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 8020;
const FRONT = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

const path = require('path');

const invitacionesPortalRoutes = require('./routes/invitacionesPortal');

const invitacionesQRRoutes = require('./routes/invitacionesQR');

const scanInvitacionQRRoutes = require('./routes/scanInvitacionQR');



// (Opcional) si usarás cookies secure detrás de proxy:
// app.set('trust proxy', 1);

// ✅ 3) Static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ 4) Middlewares
const allowedOrigins = [
  FRONT,
  'https://www.sistemanardeli.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://192.168.1.90:3000',
  'http://192.168.1.90:3001',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origen no permitido por CORS: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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


// server.js
app.use('/api/accesorios', require('./routes/accesorios'));

// << montar nueva carpeta de endpoints de recibos (con prefijo /api)
app.use('/api', require('./routes/receipts'));

// ✅ Reportes
app.use('/api/reportes', require('./routes/reportes'));

//Invitaciones QR
app.use('/api/invitaciones-portal', invitacionesPortalRoutes);

//Ingresar código de invitación
app.use('/api/invitaciones-qr', invitacionesQRRoutes);

//scaneo de invitación QR
app.use('/api/scan-invitacion-qr', scanInvitacionQRRoutes);

app.use('/api/app', require('./routes/appDashboard'));

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

// 👇 AGREGA AQUÍ
app.get('/privacy', (req, res) => {
  res.send(`
    <h1>Política de Privacidad - Nardeli</h1>
    <p>Recopilamos nombre y número telefónico para gestionar invitaciones a eventos.</p>
    <p>No compartimos información con terceros.</p>
    <p>Puedes solicitar la eliminación de tus datos en cualquier momento.</p>
    <p>Contacto: soporte@nardeli.mx</p>
  `);
});

// ✅ 6) Conectar DB y arrancar
connectDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});
  })
  .catch((e) => {
    console.error('No se pudo conectar a MongoDB:', e?.message || e);
    process.exit(1);
  });

module.exports = app;
