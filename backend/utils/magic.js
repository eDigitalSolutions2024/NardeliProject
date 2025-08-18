// backend/utils/magic.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/* ======= TUS HELPERS ORIGINALES ======= */
function genToken(len = 32) {
  // token opaco seguro
  return crypto.randomBytes(len).toString('hex');
}
function hashToken(token) {
  // guardamos el hash en DB, no el token plano
  return crypto.createHash('sha256').update(token).digest('hex');
}
function expiresAt(minutes = Number(process.env.MAGIC_LINK_EXPIRES_MIN || 15)) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/* ======= HELPERS QUE ESPERA routes/auth.js ======= */
function generarCodigo(len = 6) {
  // código numérico de N dígitos (con ceros a la izquierda si hace falta)
  let s = '';
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
  return s;
}
async function hashCodigo(code) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(String(code), salt);
}
async function verificarCodigo(hash, code) {
  return bcrypt.compare(String(code), hash);
}

module.exports = {
  // originales
  genToken,
  hashToken,
  expiresAt,
  // compat con auth.js
  generarCodigo,
  hashCodigo,
  verificarCodigo,
};
