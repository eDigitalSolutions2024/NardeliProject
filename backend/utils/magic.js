// backend/utils/magic.js
const crypto = require('crypto');

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

module.exports = { genToken, hashToken, expiresAt };
