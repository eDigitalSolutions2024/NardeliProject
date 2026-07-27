// Fuente única del secreto usado para firmar/verificar JWT en todo el backend.
// Antes cada archivo tenía su propio fallback hardcodeado y distinto entre sí
// (p. ej. 'secreto-temporal', 'clave-super-secreta', 'secret'), lo cual significaba
// que si faltaba JWT_SECRET en el entorno, el sistema quedaba firmando/verificando
// tokens con un valor público visible en el código fuente, sin avisar.
if (!process.env.JWT_SECRET) {
  console.error(
    '⚠️  JWT_SECRET no está definido en las variables de entorno. ' +
    'Se está usando un valor temporal inseguro — configura JWT_SECRET en el .env antes de producción.'
  );
}

module.exports = process.env.JWT_SECRET || 'nardeli-dev-only-inseguro-configura-JWT_SECRET';
