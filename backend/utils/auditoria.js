// Registra en la bitácora las acciones que modifican datos (reservas, pagos, inventario, formatos, checklists).
// Se monta una sola vez en index.js; escribe solo cuando la petición terminó bien (< 400).
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('./jwtSecret');
const bitacora = require('./bitacora');

const ID = '[^/]+';
// [método, ruta (regex), acción]
const REGLAS = [
  ['POST',   /^\/api\/reservas$/, 'reserva.crear'],
  ['POST',   /^\/api\/reservas\/public$/, 'reserva.crear_publica'],
  ['PUT',    new RegExp(`^/api/reservas/${ID}$`), 'reserva.editar'],
  ['DELETE', new RegExp(`^/api/reservas/${ID}$`), 'reserva.eliminar'],
  ['PUT',    new RegExp(`^/api/reservas/${ID}/aceptar-cotizacion$`), 'reserva.aceptar_cotizacion'],
  ['PUT',    new RegExp(`^/api/reservas/${ID}/convertir-a-cotizacion$`), 'reserva.convertir_cotizacion'],
  ['PUT',    new RegExp(`^/api/reservas/${ID}/descuento$`), 'reserva.descuento'],
  ['PATCH',  new RegExp(`^/api/reservas/${ID}/precios$`), 'reserva.precios'],
  ['PATCH',  new RegExp(`^/api/reservas/${ID}/utensilios/${ID}/precio$`), 'reserva.precios'],
  ['PUT',    new RegExp(`^/api/reservas/${ID}/(utensilios|resumen-accesorios|resumen-seleccion)$`), 'reserva.accesorios'],
  ['PATCH',  new RegExp(`^/api/reservas/${ID}/utensilios/${ID}$`), 'reserva.accesorios'],
  ['POST',   new RegExp(`^/api/reservas/${ID}/accesorios/apply$`), 'reserva.accesorios'],
  ['PATCH',  new RegExp(`^/api/app/reservas/${ID}/finalizar$`), 'reserva.finalizar'],
  ['PATCH',  new RegExp(`^/api/app/reservas/${ID}/posponer-fin$`), 'reserva.posponer_fin'],
  ['PATCH',  new RegExp(`^/api/app/reservas/${ID}/reactivar$`), 'reserva.reactivar'],
  ['PUT',    new RegExp(`^/api/reservas/${ID}/formatos/${ID}$`), 'formato.guardar'],
  ['POST',   /^\/api\/receipts$/, 'pago.recibo_crear'],
  ['DELETE', new RegExp(`^/api/receipts/${ID}$`), 'pago.recibo_eliminar'],
  ['POST',   /^\/api\/productos$/, 'inventario.producto_crear'],
  ['PUT',    new RegExp(`^/api/productos/${ID}$`), 'inventario.producto_editar'],
  ['DELETE', new RegExp(`^/api/productos/${ID}$`), 'inventario.producto_eliminar'],
  ['POST',   /^\/api\/accesorios$/, 'inventario.accesorio_crear'],
  ['PUT',    new RegExp(`^/api/accesorios/${ID}$`), 'inventario.accesorio_editar'],
  ['DELETE', new RegExp(`^/api/accesorios/${ID}$`), 'inventario.accesorio_eliminar'],
  ['POST',   /^\/api\/app\/checklists\/evento\/[^/]+(\/asignar)?$/, 'checklist.crear'],
  ['PUT',    new RegExp(`^/api/app/checklists/${ID}$`), 'checklist.editar'],
  ['DELETE', new RegExp(`^/api/app/checklists/${ID}$`), 'checklist.eliminar'],
  ['POST',   /^\/api\/app\/checklist-templates$/, 'checklist.plantilla_crear'],
  ['PUT',    new RegExp(`^/api/app/checklist-templates/${ID}$`), 'checklist.plantilla_editar'],
  ['DELETE', new RegExp(`^/api/app/checklist-templates/${ID}$`), 'checklist.plantilla_eliminar'],
];

function actorDe(req) {
  if (req.user?.email) return req.user.email;
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return '';
    const p = jwt.verify(h.slice(7), JWT_SECRET);
    return p.email || String(p.sub || p.id || '');
  } catch { return ''; }
}

module.exports = function auditar(req, res, next) {
  const ruta = req.originalUrl.split('?')[0].replace(/\/+$/, '');
  const regla = REGLAS.find(([m, rx]) => m === req.method && rx.test(ruta));
  if (!regla) return next();
  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const actor = actorDe(req) || (regla[2] === 'reserva.crear_publica' ? 'Cliente (público)' : 'Desconocido');
    const ids = ruta.split('/').filter((s) => /^[a-f0-9]{24}$/i.test(s));
    const b = req.body || {};
    bitacora.registrar({ email: actor }, regla[2], {
      id: ids[0] || '',
      nombre: b.nombre || b.cliente || b.nombreCliente || '',
      ruta,
    });
  });
  next();
};
