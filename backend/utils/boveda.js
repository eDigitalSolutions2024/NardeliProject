// Bóveda de contraseñas: guarda la contraseña ACTUAL de cada usuario cifrada (AES-256-GCM) para que
// el administrador pueda consultarla desde "Usuarios y roles". Nunca se guarda en texto plano.
// La llave sale de PASSWORD_VAULT_KEY (recomendado definirla en el .env); si falta, se deriva de JWT_SECRET.
// Ojo: si esa llave cambia, las contraseñas ya cifradas dejan de poder leerse (el login no se afecta: usa el hash).
const crypto = require('crypto');
const JWT_SECRET = require('./jwtSecret');

const llave = () =>
  crypto.createHash('sha256').update('nardeli-password-vault|' + (process.env.PASSWORD_VAULT_KEY || JWT_SECRET)).digest();

function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', llave(), iv);
  const enc = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

function descifrar(valor) {
  if (!valor) return null;
  try {
    const [iv, tag, enc] = String(valor).split('.').map((x) => Buffer.from(x, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', llave(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

module.exports = { cifrar, descifrar };
