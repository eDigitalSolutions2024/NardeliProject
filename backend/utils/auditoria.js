// Registra en la bitácora las acciones que modifican datos (reservas, pagos, inventario, formatos, checklists).
// Se monta una sola vez en index.js; escribe solo cuando la petición terminó bien (< 400).
const jwt = require('jsonwebtoken');
const JWT_SECRET = require('./jwtSecret');
const bitacora = require('./bitacora');
const { quienDe, registrarCambio } = require('./historialReserva');

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
  ['PATCH',  new RegExp(`^/api/reservas/${ID}/utensilios/${ID}/precio$`), 'precio.cambiar'], // éxito y clave incorrecta los registra la propia ruta; aquí solo los rechazos de permiso
  ['PUT',    new RegExp(`^/api/reservas/${ID}/(utensilios|resumen-accesorios)$`), 'reserva.accesorios'], // su historial lo escribe la propia ruta
  ['PUT',    new RegExp(`^/api/reservas/${ID}/resumen-seleccion$`), 'reserva.accesorios', () => ({ tipo: 'accesorios', accion: 'accessories_update', etiqueta: 'Accesorios actualizados' })],
  ['PATCH',  new RegExp(`^/api/reservas/${ID}/utensilios/${ID}$`), 'reserva.accesorios', (req) => {
    const b = req.body || {};
    const partes = ['cantidad', 'nombre', 'categoria', 'unidad', 'descripcion', 'imagen'].filter((k) => b[k] != null && b[k] !== '').map((k) => (k === 'cantidad' ? `cantidad: ${b[k]}` : k));
    return { tipo: 'producto', accion: 'update', producto: { id: '', nombre: b.nombre || '' }, etiqueta: `Línea de artículo modificada${partes.length ? ` (${partes.join(', ')})` : ''}`, cantidadDespues: b.cantidad != null ? Number(b.cantidad) : undefined };
  }],
  ['POST',   new RegExp(`^/api/reservas/${ID}/accesorios/apply$`), 'reserva.accesorios', (req) => ({ tipo: 'accesorios', accion: 'accessories_update', etiqueta: `Accesorios aplicados como préstamo (${Array.isArray(req.body?.seleccion) ? req.body.seleccion.length : 0} artículos)` })],
  ['PATCH',  new RegExp(`^/api/app/reservas/${ID}/finalizar$`), 'reserva.finalizar', () => ({ tipo: 'estado', accion: 'state_change', etiqueta: 'Evento marcado como finalizado' })],
  ['PATCH',  new RegExp(`^/api/app/reservas/${ID}/posponer-fin$`), 'reserva.posponer_fin', (req) => ({ tipo: 'estado', accion: 'state_change', etiqueta: `Cierre del evento pospuesto ${Number(req.body?.horas) > 0 ? Number(req.body.horas) : 2} h` })],
  ['PATCH',  new RegExp(`^/api/app/reservas/${ID}/reactivar$`), 'reserva.reactivar', () => ({ tipo: 'estado', accion: 'state_change', etiqueta: 'Evento reactivado (se había finalizado)' })],
  ['POST',   new RegExp(`^/api/invitaciones-portal/generar/${ID}$`), 'invitacion.generar_portal', () => ({ tipo: 'invitacion', accion: 'invite_add', etiqueta: 'Enlace de invitaciones del cliente generado' })],
  ['POST',   new RegExp(`^/api/invitaciones-empresa/generar-empresa/${ID}$`), 'invitacion.generar_empresa', () => ({ tipo: 'invitacion', accion: 'invite_add', etiqueta: 'Acceso QR para empresa generado' })],
  ['PATCH',  new RegExp(`^/api/invitaciones-qr-admin/${ID}$`), 'invitacion.editar'],
  ['PATCH',  new RegExp(`^/api/invitaciones-qr-admin/${ID}/cancelar$`), 'invitacion.cancelar'],
  ['POST',   new RegExp(`^/api/invitaciones-qr/${ID}$`), 'invitacion.crear_cliente'],
  ['PATCH',  new RegExp(`^/api/invitaciones-qr/${ID}/${ID}$`), 'invitacion.editar_cliente'],
  ['PATCH',  new RegExp(`^/api/invitaciones-qr/${ID}/${ID}/cancelar$`), 'invitacion.cancelar_cliente'],
  ['PUT',    new RegExp(`^/api/reservas/${ID}/formatos/${ID}$`), 'formato.guardar'],
  ['POST',   /^\/api\/receipts$/, 'pago.recibo_crear'],
  ['DELETE', new RegExp(`^/api/receipts/${ID}$`), 'pago.recibo_eliminar'],
  ['POST',   /^\/api\/productos$/, 'inventario.producto_crear'],
  ['PUT',    new RegExp(`^/api/productos/${ID}$`), 'inventario.producto_editar'],
  ['DELETE', new RegExp(`^/api/productos/${ID}$`), 'inventario.producto_eliminar'],
  ['POST',   /^\/api\/accesorios$/, 'inventario.accesorio_crear'],
  ['PUT',    new RegExp(`^/api/accesorios/${ID}$`), 'inventario.accesorio_editar'],
  ['DELETE', new RegExp(`^/api/accesorios/${ID}$`), 'inventario.accesorio_eliminar'],
  ['POST',   /^\/api\/app\/checklists\/evento\/[^/]+(\/asignar)?$/, 'checklist.crear', () => ({ tipo: 'checklist', accion: 'checklist_change', etiqueta: 'Checklist asignado o creado para el evento' })],
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
  let msgRespuesta = '';
  const jsonOriginal = res.json.bind(res);
  res.json = (cuerpo) => { try { msgRespuesta = String(cuerpo?.msg || ''); } catch { /* sin mensaje */ } return jsonOriginal(cuerpo); };
  res.on('finish', () => {
    const propia = regla[2] === 'precio.cambiar'; // la ruta ya registra sus éxitos y la clave incorrecta
    if (res.statusCode === 401 || res.statusCode === 403) {
      if (propia && /contraseña de administrador/i.test(msgRespuesta)) return;
      const quien = actorDe(req) || 'Desconocido';
      bitacora.registrar({ email: quien }, 'seguridad.rechazado', { accion: regla[2], estado: res.statusCode, motivo: msgRespuesta, ruta });
      return;
    }
    if (res.statusCode >= 400 || propia) return;
    const actor = actorDe(req) || (regla[2] === 'reserva.crear_publica' ? 'Cliente (público)' : 'Desconocido');
    const ids = ruta.split('/').filter((s) => /^[a-f0-9]{24}$/i.test(s));
    const b = req.body || {};
    if (typeof regla[3] === 'function' && ids[0]) {
      try {
        const datos = regla[3](req, ruta);
        if (datos) {
          const q = quienDe(req);
          registrarCambio(ids[0], datos, { id: q.id, email: q.email || actor, role: q.role || (actor === 'Cliente (público)' ? 'cliente' : '') });
        }
      } catch { /* el historial nunca debe romper la respuesta */ }
    }
    bitacora.registrar({ email: actor }, regla[2], {
      id: ids[0] || '',
      nombre: b.nombre || b.cliente || b.nombreCliente || '',
      ruta,
    });
  });
  next();
};
