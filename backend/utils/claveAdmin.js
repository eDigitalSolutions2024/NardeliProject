// Contraseña fija de administrador (DISCOUNT_REMOVAL_PASSWORD en .env) para acciones delicadas.
const crypto = require('crypto');

function validarClaveAdmin(password) {
  const esperada = process.env.DISCOUNT_REMOVAL_PASSWORD || '';
  if (!password || !esperada) return false;
  const a = Buffer.from(String(password));
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { validarClaveAdmin };
