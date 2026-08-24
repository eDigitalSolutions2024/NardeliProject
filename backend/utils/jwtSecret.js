// Fuente única del secreto usado para firmar/verificar JWT en todo el backend.
// Antes cada archivo tenía su propio fallback hardcodeado y distinto entre sí
// (p. ej. 'secreto-temporal', 'clave-super-secreta', 'secret'), lo cual significaba
// que si faltaba JWT_SECRET en el entorno, el sistema quedaba firmando/verificando
// tokens con un valor público visible en el código fuente, sin avisar.
//
// Falla rápido en vez de solo avisar: un JWT_SECRET faltante es crítico — con el
// valor hardcodeado anterior, cualquiera podía forjar un token de admin y usarlo
// contra las rutas de staff (incluyendo las que emiten/rotan credenciales de la
// Partner API y editan/cancelan invitaciones).
if (!process.env.JWT_SECRET) {
  console.error(
    '❌ JWT_SECRET no está definido en las variables de entorno. ' +
    'Configúralo en el .env antes de arrancar el servidor — no hay valor por defecto.'
  );
  process.exit(1);
}

module.exports = process.env.JWT_SECRET;
