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
app.use('/api/media', express.static(path.join(__dirname, 'uploads')));

// ✅ 4) Middlewares
const allowedOrigins = [
  FRONT,
  'https://sistemanardeli.com',
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

app.use(express.json({ limit: '20mb' })); // firma de encuestas y fotos de evidencia de Toro Checklist en base64 exceden el límite default de 100kb
app.use(cookieParser());

// ✅ 5) Rutas
app.get('/api/ping', (_req, res) => res.send('pong'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/login'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/reservas', require('./routes/reservas'));
app.use('/api/reservas', require('./routes/formatosReserva'));
app.use('/api/productos', require('./routes/productos'));


// server.js
app.use('/api/accesorios', require('./routes/accesorios'));

// << montar nueva carpeta de endpoints de recibos (con prefijo /api)
app.use('/api', require('./routes/receipts'));

// ✅ Reportes
app.use('/api/reportes', require('./routes/reportes'));

//Invitaciones QR
app.use('/api/invitaciones-portal', invitacionesPortalRoutes);

//Acceso QR delegado a empresas partner (crear/editar/eliminar QR de un evento)
app.use('/api/invitaciones-empresa', require('./routes/invitacionesEmpresa'));

//Ingresar código de invitación
app.use('/api/invitaciones-qr', invitacionesQRRoutes);

//Vista de admin: todas las invitaciones de una reserva (cliente + empresas partner)
app.use('/api/invitaciones-qr-admin', require('./routes/invitacionesQRAdmin'));

//scaneo de invitación QR
app.use('/api/scan-invitacion-qr', scanInvitacionQRRoutes);

app.use('/api/app', require('./routes/appDashboard'));
app.use('/api/app', require('./routes/appChecklists'));
app.use('/api/app', require('./routes/appEncuestas'));
app.use('/api/settings', require('./routes/settings'));

// Toro Checklist — sistema independiente (Restaurante El Toro Bronco Real),
// misma instancia/proceso pero con su propia base de datos (ver toro/db.js).
app.use('/api/toro', require('./toro'));

// Si tienes inventario por separado:
// app.use('/api/inventario', require('./routes/inventario'));

app.get('/privacy', (req, res) => {
  res.send(`
    <h1>Política de Privacidad - Nardeli</h1>
    <p>Recopilamos nombre y número telefónico para gestionar invitaciones a eventos.</p>
    <p>No compartimos información con terceros.</p>
    <p>Puedes solicitar la eliminación de tus datos en cualquier momento.</p>
    <p>Contacto: soporte@nardeli.mx</p>
  `);
});

// ✅ 6) Jobs y endpoints admin — DEBEN registrarse antes del catch-all 404 de abajo,
// si no, Express nunca los alcanza (cualquier app.use()/app.post() registrado después
// del catch-all queda muerto para siempre).
const { startCleanupJob, cleanupOldEventPhotos } = require('./jobs/cleanupPhotos');
const { startSyncJob, syncPartnerInvitationsFull } = require('./jobs/syncPartnerInvitations');
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('./utils/jwtSecret');

// Endpoint manual para forzar limpieza (útil para pruebas)
app.post('/api/admin/cleanup-photos', async (_req, res) => {
  try {
    await cleanupOldEventPhotos();
    res.json({ ok: true, msg: 'Limpieza ejecutada' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fuerza un resync completo con la Partner API (ej. unas horas antes de un evento, para
// asegurar que el lector tenga el estado más reciente antes de que empiece la ventana de
// baja/nula conectividad en el venue). Requiere staff — dispara escrituras en InvitacionQR.
app.post('/api/admin/sync-partner-invitations', async (req, res) => {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!t) return res.status(401).json({ ok: false, msg: 'No autorizado' });
  try {
    const payload = jwt.verify(t, JWT_SECRET);
    if (payload.role !== 'admin' && payload.role !== 'asistente') {
      return res.status(403).json({ ok: false, msg: 'Requiere permisos de staff' });
    }
  } catch {
    return res.status(401).json({ ok: false, msg: 'Token inválido' });
  }

  try {
    const result = await syncPartnerInvitationsFull();
    if (!result.ok) {
      return res.status(502).json({ ok: false, msg: 'No se pudo sincronizar con Partner API' });
    }
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[sync-partner] Error en resync manual:', e.message);
    res.status(500).json({ ok: false, msg: 'Error al sincronizar' });
  }
});

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

connectDB()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
      startCleanupJob();
      startSyncJob();
    });
  })
  .catch((e) => {
    console.error('No se pudo conectar a MongoDB:', e?.message || e);
    process.exit(1);
  });

module.exports = app;
