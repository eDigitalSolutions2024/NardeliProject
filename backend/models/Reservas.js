// models/Reservas.js
const mongoose = require('mongoose');

// -------- Subdocumento de utensilios --------
// IMPORTANTE: NO desactives _id (lo usamos en PATCH /utensilios/:lineId)
const utensilioSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto' },
    nombre: { type: String, required: true, trim: true },
    cantidad: { type: Number, required: true, min: 0 },
    unidad: { type: String, default: 'pza' },
    categoria: { type: String, default: 'general' },
    precio: { type: Number, min: 0, default: 0 },
    descripcion: { type: String, default: '' },
    imagen: { type: String, default: '' },

    aplicarDescuento: { type: Boolean, default: false },

    fechaAgregado:{ type:Date, default:Date.now}
  },
  { _id: true } // <- necesario para editar líneas por ID
);

const ResumenAccesorio = new mongoose.Schema({
  accesorioId: String,
  nombre: String,
  categoria: String,
  unidad: String,
  cantidad: Number,
  precioReposicion: Number,
  descripcion: String,
  imagen: String,
  esPrestamo: { type: Boolean, default: true }
}, { _id: false });

//====== ARRGEGLO DE HISTORIAL ======
const historialCambioSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: ['edicion', 'whatsapp_alerta'],
      required: true,
    },

    campo: { type: String, default: '' },
    etiqueta: { type: String, default: '' },

    antes: { type: mongoose.Schema.Types.Mixed, default: null },
    despues: { type: mongoose.Schema.Types.Mixed, default: null },

    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
    usuarioNombre: { type: String, default: 'Sistema' },

    fecha: { type: Date, default: Date.now },

    destino: { type: String, default: '' },
    mensaje: { type: String, default: '' },
    estado: {
      type: String,
      enum: ['pendiente', 'enviado', 'error'],
      default: 'pendiente',
    },
    error: { type: String, default: '' },
  },
  { _id: true }
);

// -------- Esquema principal de Reserva --------
const reservaSchema = new mongoose.Schema(
  {
    // Datos de la persona / autenticación opcional
    clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },

    // Folio corto para buscar y mostrar en PDF (últimos 8 del _id)
    shortId: { type: String, uppercase: true, trim: true, index: true },

    // Datos básicos
    cliente: { type: String, required: true, trim: true },
    correo: { type: String, required: true, lowercase: true, trim: true, index: true },
    telefono: { type: String, required: true, trim: true },

    // Evento
    tipoEvento: { type: String, required: true, trim: true },
    fecha: { type: Date, required: true, index: true },
    horaInicio: { type: String, required: true }, // "HH:mm"
    horaFin: { type: String, required: true },    // "HH:mm"
    cantidadPersonas: { type: Number, required: true, min: 0 },
    descripcion: { type: String, default: '' },

    // Ítems seleccionados
    utensilios: { type: [utensilioSchema], default: [] },

    resumenSeleccion: {
    accesorios: { type: [ResumenAccesorio], default: [] } // ✅ tipado y con default correcto
  },

    // Estado de la reserva de flujo interno (para /reservas/activa)
    estado: {
      type: String,
      enum: ['borrador', 'confirmada', 'cancelada', 'finalizado'],
      default: 'confirmada',
      index: true,
    },

    // Se recalcula solo en los hooks pre-save/pre-findOneAndUpdate a partir
    // de `tipoReserva` + `estado` (true solo si es un EVENTO confirmado, no
    // cancelado). Existe únicamente para poder tener un índice único PARCIAL
    // de fecha+horaInicio — Mongo no permite "$ne" en
    // partialFilterExpression, así que necesitamos un campo plano de
    // igualdad. No se edita a mano en ningún lado.
    //
    // OJO: las cotizaciones NO ponen este flag en true. Según los datos de
    // producción, es normal tener varias cotizaciones activas para la misma
    // fecha (varios prospectos preguntando por el mismo sábado) — eso NO es
    // un bug. Lo único que de verdad no puede duplicarse es un EVENTO ya
    // confirmado. El candado de "cotización reciente" (24h) que exige
    // contraseña de admin para forzar vive solo a nivel de aplicación en
    // routes/reservas.js, no aquí.
    ocupaEventoFecha: { type: Boolean, default: false },

    // Se pone en true cuando otro cliente le ganó la fecha con la
    // contraseña de administrador (ver liberarHoldDeCotizaciones en
    // routes/reservas.js). La cotización NO se cancela ni se oculta: sigue
    // viva en la lista de pendientes y el staff la puede editar para
    // moverla a otra fecha. Solo deja de contar para el candado de 24h, así
    // que ya no le exige contraseña a nadie más ni muestra el badge.
    holdLiberado: { type: Boolean, default: false },

    // Confirmación de cierre del evento (app de invitaciones)
    finalizacion: {
      confirmadoEn: { type: Date, default: null },
      confirmadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
      pospuestoHasta: { type: Date, default: null },
    },

    // Cotización / Evento
    tipoReserva: {
      type: String,
      enum: ['cotizacion', 'evento'],
      default: 'evento',
      index: true,
    },
    cotizacion: {
      aceptada: { type: Boolean, default: false },
      aceptadaEn: { type: Date, default: null },
      nota: { type: String, default: '' },
    },

    // Precios / Descuento global (persistente)
    precios: {
      moneda: { type: String, default: 'MXN' },
      descuento: {
        tipo: { type: String, enum: ['monto', 'porcentaje'], default: 'monto' },
        valor: { type: Number, default: 0, min: 0 }, // % o monto según 'tipo'
        motivo: { type: String, default: '' },
      },
      // opcionales por si los quieres guardar además del virtual
      subtotal: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },

    // Archivos / otros
    pdfUrl: { type: String, default: null },
    pdfPath: { type: String, default: null },

    //Historial
    historialCambios: { type: [historialCambioSchema], default: [] },
  },
  {
    timestamps: true,            // createdAt / updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// -------- Virtuales útiles (no pisan precios.subtotal/total) --------
reservaSchema.virtual('subTotal').get(function () {
  const items = this.utensilios || [];
  return items.reduce((acc, it) => {
    const p = Number(it?.precio || 0);
    const q = Number(it?.cantidad || 0);
    return acc + p * q;
  }, 0);
});

reservaSchema.virtual('descuentoCalculado').get(function () {
  const d = this.precios?.descuento;
  if (!d || !Number.isFinite(d.valor) || d.valor <= 0) return 0;

  // El descuento solo aplica sobre los productos marcados con
  // aplicarDescuento (ver PUT /reservas/:id/utensilios), no sobre el
  // subtotal completo — si no, un 20% en un solo producto se cobraba
  // como 20% de TODO el pedido.
  const items = this.utensilios || [];
  const stDescuento = items.reduce((acc, it) => {
    if (!it?.aplicarDescuento) return acc;
    const p = Number(it?.precio || 0);
    const q = Number(it?.cantidad || 0);
    return acc + p * q;
  }, 0);

  if (d.tipo === 'porcentaje') {
    const pct = Math.max(0, Math.min(100, Number(d.valor)));
    return Math.min(stDescuento, stDescuento * (pct / 100));
  }
  const monto = Math.max(0, Number(d.valor));
  return Math.min(stDescuento, monto);
});

reservaSchema.virtual('totalVirtual').get(function () {
  const st = Number(this.subTotal || 0);
  const desc = Number(this.descuentoCalculado || 0);
  return Math.max(0, st - desc);
});

// -------- Índices de ayuda --------
reservaSchema.index({ fecha: 1, horaInicio: 1 });
reservaSchema.index({ tipoReserva: 1, fecha: 1 });
reservaSchema.index({ shortId: 1 }, { unique: true, sparse: true });

// Candado real contra choques de fecha+hora entre EVENTOS: Mongo garantiza
// esto de forma atómica incluso si dos requests llegan al mismo tiempo
// desde computadoras distintas (el chequeo en código, por rápido que sea,
// siempre tiene una ventana entre "leer" y "guardar" — este índice no).
// Solo aplica cuando ocupaEventoFecha:true, es decir, solo a EVENTOS
// confirmados (no cancelados) — las cotizaciones nunca activan este
// candado duro, pueden convivir varias en la misma fecha. Verificado contra
// producción: 0 eventos duplicados existentes, así que este índice se puede
// crear sin conflicto.
// Esto NO detecta traslapes con horaInicio distinto (ej. 18:00-20:00 vs
// 19:00-21:00) — ese caso lo sigue cubriendo únicamente el chequeo en
// código de checarEventoEnFecha.
reservaSchema.index(
  { fecha: 1, horaInicio: 1 },
  { unique: true, partialFilterExpression: { ocupaEventoFecha: true } }
);

reservaSchema.pre('save', function(next) {
  if (!this.shortId) {
    this.shortId = String(this._id).slice(-8).toUpperCase();
  }
  this.ocupaEventoFecha = this.tipoReserva === 'evento' && this.estado !== 'cancelada';
  next();
});

// Varias rutas actualizan con findByIdAndUpdate/findOneAndUpdate en vez de
// .save() (esas NO disparan el pre('save') de arriba) — este hook hace lo
// mismo para que `ocupaEventoFecha` nunca quede desincronizado de
// `tipoReserva`/`estado`, sin importar por cuál ruta se cancele, reactive o
// convierta una reserva. Si la actualización solo trae uno de los dos
// campos, se consulta el documento actual para completar el que falta.
reservaSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate() || {};
  let nuevoEstado = update.estado ?? update.$set?.estado;
  let nuevoTipo = update.tipoReserva ?? update.$set?.tipoReserva;

  if (nuevoEstado === undefined && nuevoTipo === undefined) return next();

  if (nuevoEstado === undefined || nuevoTipo === undefined) {
    const actual = await this.model.findOne(this.getQuery()).select('estado tipoReserva').lean();
    if (actual) {
      if (nuevoEstado === undefined) nuevoEstado = actual.estado;
      if (nuevoTipo === undefined) nuevoTipo = actual.tipoReserva;
    }
  }

  const ocupa = nuevoTipo === 'evento' && nuevoEstado !== 'cancelada';
  if (update.$set) {
    update.$set.ocupaEventoFecha = ocupa;
  } else {
    update.ocupaEventoFecha = ocupa;
  }
  next();
});

module.exports = mongoose.model('Reserva', reservaSchema);
