const mongoose = require('mongoose');

// Conexión propia y aislada para los datos de Toro Checklist (distinta de la
// conexión por defecto que usa el resto del backend de Nardeli para
// eventos_Nardeli). Vive en el mismo proceso/instancia, pero en su propia
// base de datos — así los dos sistemas no comparten ni mezclan datos.
const TORO_MONGODB_URI = process.env.TORO_MONGODB_URI || 'mongodb://localhost:27017/toro_checklist';

const toroConnection = mongoose.createConnection(TORO_MONGODB_URI);

toroConnection.on('connected', () => {
  console.log(`✅ [Toro] MongoDB conectado: ${TORO_MONGODB_URI}`);
});

toroConnection.on('error', (err) => {
  console.error('❌ [Toro] Error de conexión a MongoDB:', err.message);
});

module.exports = toroConnection;
