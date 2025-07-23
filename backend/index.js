const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
connectDB();

const app = express();
const PORT = process.env.PORT || 8010;

// ✅ CORS configurado correctamente
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// ✅ Middlewares
app.use(express.json());

// ✅ Rutas
const authRoutes = require('./routes/auth');
const loginRoutes = require('./routes/login');
const usuariosRoutes = require('./routes/usuarios');

app.use('/api/auth', authRoutes);
app.use('/api', loginRoutes);
app.use('/api/usuarios', usuariosRoutes);

// ✅ Ruta de prueba
app.get('/api/ping', (req, res) => {
  res.send('pong');
});

// ✅ Servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = app;
