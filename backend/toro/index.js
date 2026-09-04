const express = require('express');

// Fuerza la conexión a Mongo de Toro en cuanto este módulo se carga (al
// arrancar el servidor principal, cuando index.js hace require('./toro')).
require('./db');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'toro-checklist' }));
router.use('/areas', require('./routes/areas'));
router.use('/submissions', require('./routes/submissions'));

module.exports = router;
