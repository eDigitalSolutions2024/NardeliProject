const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8010;

// Middlewares
app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/api/ping', (req, res) => {
  res.send('pong');
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
