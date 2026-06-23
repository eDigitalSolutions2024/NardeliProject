import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../api';

const PURPLE = '#6d28d9';
const GREEN  = '#b7db2d';
const MUTED  = '#64748b';

const CATEGORIAS_PROVEEDORES = [
  'Recinto', 'Mantelería', 'Florería', 'Fotografía y video', 'DJ',
  'Grupo musical', 'Pastelería', 'Banquete', 'Coctelería', 'Decoración',
  'Iluminación', 'Mobiliario decorativa', 'Mesas dulces', 'Mesa Salada',
  'Photo booth', 'Recuerdos', 'Guardería Móvil', 'Animación y accesorios',
  'Event planner', 'Amenización', 'Invitaciones', 'Licor',
];

// ── Helpers de fecha ──────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toISOString().slice(0, 10); } catch { return ''; }
}

// ── Constructor de item para listas dinámicas ─────────────────────────────
const item = (label, checked = false) => ({ label, checked });

// ── Defaults base ─────────────────────────────────────────────────────────
const DEFAULT_TABLA_TRABAJO = {
  fecha_llenado: '', nombre_cliente: '', nombre_festejado: '',
  fecha_evento: '', tipo_evento: '', num_invitados: '',
  montaje: '', num_mesas: '', tipo_mesa: '', num_sillas: '', tipo_sillas: '', color_sillas: '',
  mantel_camino: '', plaque: '', cubierto: '', cristaleria: '', plato_basse: '',
  horario_servir: '', alimentos: '', tiempos: '',
  bebidas:      [item('Vino'), item('Cerveza'), item('Soda')],
  req_tecnicos: [item('Baile en las Nubes'), item('Chisperos'), item('Confeti'), item('Grupo Musical')],
  programa_dj:  [item('Vals'), item('Presentación'), item('Brindis'), item('Baile Moderno'), item('Proyección de video')],
  accesorios:   [],
  servicios:    [item('Candy bar'), item('Barra coctelera'), item('Mesa de postres'), item('Photo booth'), item('Guardarropa')],
  proveedores_externos: '', telefono: '', horario_montaje: '', horario_desmontaje: '', notas: '',
  extras: [],
};

const DEFAULT_DEGUSTACION = {
  nombre_cliente: '', fecha_evento: '', hora: '', tipo_evento: '', aforo: '',
  entradas: [
    item('Elote'), item('Champiñones'), item('Poblana'),
    item('Papa'), item('Espinaca'), item('Zanahoria'),
  ],
  platos_fuertes: [
    item('Cerdo — Chamorro bañado en mole rojo con risotto'),
    item('Pollo — Pechuga empanizada rellena de tocino, espinaca y champiñones'),
    item('Res — Filete bañado de salsa chipotle'),
  ],
  postres: [
    item('Tarta de fruta individual crema pastelera con durazno'),
    item('Volcán de chocolate con nieve en capelo'),
  ],
  observaciones: '',
  firma_chef: '', firma_cliente: '', firma_ventas: '',
  extras: [],
};

const DEFAULT_PROVEEDORES = {
  nombre_anfitriones: '', tipo_evento: '', fecha_evento: '',
  proveedores: CATEGORIAS_PROVEEDORES.map(cat => ({
    categoria: cat, nombre: '', dia: '', telefono: '', notas: '',
  })),
  extras: [],
};

// ── Defaults pre-llenados con datos de la reserva ─────────────────────────
function buildDefaultFromReserva(reserva, tipo) {
  const hoy       = todayISO();
  const fecha     = fmtDate(reserva?.fecha);
  const cliente   = reserva?.cliente    || '';
  const tipoEvt   = reserva?.tipoEvento || '';
  const invitados = String(reserva?.cantidadPersonas ?? '');

  if (tipo === 'tabla-trabajo') {
    return { ...DEFAULT_TABLA_TRABAJO, fecha_llenado: hoy, nombre_cliente: cliente, fecha_evento: fecha, tipo_evento: tipoEvt, num_invitados: invitados };
  }
  if (tipo === 'degustacion') {
    return { ...DEFAULT_DEGUSTACION, nombre_cliente: cliente, fecha_evento: fecha, tipo_evento: tipoEvt, aforo: invitados };
  }
  if (tipo === 'proveedores') {
    return { ...DEFAULT_PROVEEDORES, tipo_evento: tipoEvt, fecha_evento: fecha };
  }
  return { ...DEFAULT_TABLA_TRABAJO };
}

// ── Migración de datos guardados con la estructura antigua ────────────────
// Convierte campos booleanos/string del formato viejo a arrays del formato
// nuevo, para que registros anteriores sigan cargando correctamente.
function migrateLegacyData(saved, tipo) {
  const d = { ...saved };

  if (tipo === 'tabla-trabajo') {
    if (!Array.isArray(d.bebidas) && (d.beb_vino !== undefined || d.beb_cerveza !== undefined)) {
      d.bebidas = [
        item('Vino',     !!d.beb_vino),
        item('Cerveza',  !!d.beb_cerveza),
        item('Soda',     !!d.beb_soda),
      ];
    }
    if (!Array.isArray(d.req_tecnicos) && d.req_baile_nubes !== undefined) {
      d.req_tecnicos = [
        item('Baile en las Nubes', !!d.req_baile_nubes),
        item('Chisperos',          !!d.req_chisperos),
        item('Confeti',            !!d.req_confeti),
        item('Grupo Musical',      !!d.req_grupo_musical),
      ];
    }
    if (!Array.isArray(d.programa_dj) && d.prog_vals !== undefined) {
      d.programa_dj = [
        item('Vals',                !!d.prog_vals),
        item('Presentación',        !!d.prog_presentacion),
        item('Brindis',             !!d.prog_brindis),
        item('Baile Moderno',       !!d.prog_baile_moderno),
        item('Proyección de video', !!d.prog_proyeccion),
      ];
    }
  }

  if (tipo === 'degustacion') {
    if (!Array.isArray(d.entradas) && d.ent_elote !== undefined) {
      d.entradas = [
        item('Elote',       !!d.ent_elote),
        item('Champiñones', !!d.ent_champinones),
        item('Poblana',     !!d.ent_poblana),
        item('Papa',        !!d.ent_papa),
        item('Espinaca',    !!d.ent_espinaca),
        item('Zanahoria',   !!d.ent_zanahoria),
      ];
    }
    if (!Array.isArray(d.platos_fuertes) && d.plato_fuerte !== undefined) {
      d.platos_fuertes = [
        item('Cerdo — Chamorro bañado en mole rojo con risotto',                    d.plato_fuerte === 'cerdo'),
        item('Pollo — Pechuga empanizada rellena de tocino, espinaca y champiñones', d.plato_fuerte === 'pollo'),
        item('Res — Filete bañado de salsa chipotle',                               d.plato_fuerte === 'res'),
      ];
    }
    if (!Array.isArray(d.postres) && d.postre !== undefined) {
      d.postres = [
        item('Tarta de fruta individual crema pastelera con durazno', d.postre === 'tarta'),
        item('Volcán de chocolate con nieve en capelo',               d.postre === 'volcan'),
      ];
    }
  }

  return d;
}

// ── Merge datos guardados con defaults ────────────────────────────────────
// Arrays siempre se usan desde BD; booleanos y strings vacíos se rellenan
// con datos de la reserva.
function mergeWithSaved(base, saved) {
  const merged = { ...base };
  Object.keys(saved).forEach(key => {
    const val = saved[key];
    if (Array.isArray(val))                          merged[key] = val;
    else if (typeof val === 'boolean')               merged[key] = val;
    else if (val !== null && val !== undefined && val !== '') merged[key] = val;
  });
  return merged;
}

// ── Estilos ───────────────────────────────────────────────────────────────
const S = {
  inp: { width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' },
  label:    { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 },
  field:    { marginBottom: 12 },
  row2:     { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 },
  row3:     { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 },
  secTitle: {
    background: '#f3e8ff', color: PURPLE, fontWeight: 700, fontSize: 12,
    padding: '5px 10px', borderRadius: 4, marginTop: 18, marginBottom: 10,
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  btn: { padding: '9px 22px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' },
  textarea: { width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', minHeight: 64 },
};

// ── Micro-componentes ─────────────────────────────────────────────────────
function F({ label, children }) {
  return <div style={S.field}><label style={S.label}>{label}</label>{children}</div>;
}
function Inp({ label, value, onChange, type = 'text', ...rest }) {
  return (
    <F label={label}>
      <input type={type} value={value ?? ''} onChange={onChange} style={S.inp} {...rest} />
    </F>
  );
}

// ── Lista dinámica de opciones con checkbox (o radio para single) ──────────
// Cada ítem: { label: string, checked: boolean }
// - Puedes editar el texto de cada opción
// - Puedes marcarla / desmarcarla
// - Puedes agregar nuevas opciones
// - Puedes eliminar cualquier opción
function DynamicChecklist({ label, items = [], onChange, single = false }) {
  const toggle = (i) => {
    const next = items.map((it, idx) => ({
      ...it,
      checked: single
        ? (idx === i ? !it.checked : false)   // radio: solo uno activo
        : (idx === i ? !it.checked : it.checked),
    }));
    onChange(next);
  };

  const updateLabel = (i, val) => {
    const next = [...items];
    next[i] = { ...next[i], label: val };
    onChange(next);
  };

  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

  const add = () => onChange([...items, { label: '', checked: false }]);

  return (
    <div style={S.field}>
      {label && <div style={S.label}>{label}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: it.checked ? '#ede9fe' : '#faf5ff',
              border: `1.5px solid ${it.checked ? PURPLE : '#e5e7eb'}`,
              borderRadius: 6, padding: '5px 8px',
              transition: 'background 0.15s, border-color 0.15s',
              flex: '0 1 auto', maxWidth: '100%',
            }}
          >
            <input
              type={single ? 'radio' : 'checkbox'}
              checked={!!it.checked}
              onChange={() => toggle(i)}
              style={{ accentColor: PURPLE, flexShrink: 0, width: 14, height: 14 }}
            />
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={e => updateLabel(i, e.currentTarget.textContent.trim())}
              dangerouslySetInnerHTML={{ __html: it.label || '' }}
              data-placeholder="Nueva opción"
              style={{
                fontSize: 12, color: it.checked ? '#4c1d95' : '#1e293b',
                fontWeight: it.checked ? 600 : 400,
                outline: 'none', cursor: 'text', wordBreak: 'break-word',
                minWidth: 60, lineHeight: '1.4',
              }}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              title="Quitar"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#c4b5fd', fontSize: 13, padding: 0,
                lineHeight: 1, flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        style={{ ...S.btn, background: '#f3e8ff', color: PURPLE, fontSize: 11, padding: '5px 12px' }}
      >
        + Agregar opción
      </button>
    </div>
  );
}

// ── Sección de campos extra libres (al final de cada formulario) ───────────
function DynamicExtras({ extras = [], onChange }) {
  const add    = () => onChange([...extras, { label: '', value: '' }]);
  const remove = (i) => onChange(extras.filter((_, idx) => idx !== i));
  const update = (i, field, val) => {
    const next = [...extras];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <>
      <div style={S.secTitle}>Campos adicionales</div>
      {extras.length === 0 && (
        <p style={{ color: MUTED, fontSize: 12, margin: '0 0 8px' }}>
          Sin campos adicionales. Agrega los que necesites para este evento.
        </p>
      )}
      {extras.map((ex, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
          <F label="Nombre del campo">
            <input value={ex.label || ''} onChange={e => update(i, 'label', e.target.value)} style={S.inp} placeholder="Ej. Color de alfombra" />
          </F>
          <F label="Valor">
            <input value={ex.value || ''} onChange={e => update(i, 'value', e.target.value)} style={S.inp} placeholder="Ej. Rojo vino" />
          </F>
          <button
            type="button"
            onClick={() => remove(i)}
            style={{ ...S.btn, background: '#fee2e2', color: '#dc2626', padding: '8px 12px', marginBottom: 12 }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        style={{ ...S.btn, background: '#f3e8ff', color: PURPLE, fontSize: 12, padding: '7px 16px' }}
      >
        + Agregar campo
      </button>
    </>
  );
}

// ── Componente principal ──────────────────────────────────────────────────
export default function FormulariosNardeli({ reservaId }) {
  const [activeForm, setActiveForm] = useState('tabla-trabajo');
  const [formData,   setFormData]   = useState(() => buildDefaultFromReserva(null, 'tabla-trabajo'));
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState('');

  useEffect(() => {
    if (!reservaId) return;
    let alive = true;
    setLoading(true);
    setMsg('');

    (async () => {
      try {
        const opts = { credentials: 'include' };
        const [rReserva, rFormato] = await Promise.all([
          fetch(`${API_BASE_URL}/reservas/${reservaId}`, opts),
          fetch(`${API_BASE_URL}/reservas/${reservaId}/formatos/${activeForm}`, opts),
        ]);
        const reserva = rReserva.ok ? await rReserva.json() : null;
        const formato = rFormato.ok ? await rFormato.json() : null;
        if (!alive) return;

        const base = buildDefaultFromReserva(reserva, activeForm);

        if (formato?.ok && formato.data && Object.keys(formato.data).length > 0) {
          // Convertir datos guardados con la estructura anterior al formato actual
          const savedData = migrateLegacyData(formato.data, activeForm);

          if (activeForm === 'proveedores' && Array.isArray(savedData.proveedores)) {
            const savedMap = {};
            savedData.proveedores.forEach(p => { savedMap[p.categoria] = p; });
            const provs = CATEGORIAS_PROVEEDORES.map(cat =>
              savedMap[cat] || { categoria: cat, nombre: '', dia: '', telefono: '', notas: '' }
            );
            setFormData({ ...mergeWithSaved(base, savedData), proveedores: provs });
          } else {
            setFormData(mergeWithSaved(base, savedData));
          }
        } else {
          setFormData(base);
        }
      } catch {
        if (alive) setFormData(buildDefaultFromReserva(null, activeForm));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [reservaId, activeForm]);

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const setProveedor = (index, field, value) =>
    setFormData(prev => {
      const provs = [...(prev.proveedores || [])];
      provs[index] = { ...provs[index], [field]: value };
      return { ...prev, proveedores: provs };
    });

  const guardar = async () => {
    if (!reservaId) return;
    setSaving(true);
    setMsg('');
    try {
      const r = await fetch(`${API_BASE_URL}/reservas/${reservaId}/formatos/${activeForm}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const d = await r.json();
      setMsg(r.ok && d.ok ? '✓ Guardado correctamente' : `Error: ${d.msg || 'No se pudo guardar'}`);
    } catch {
      setMsg('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const generarPDF = () => {
    if (!reservaId) return;
    window.open(`${API_BASE_URL}/reservas/${reservaId}/formatos/${activeForm}/pdf`, '_blank');
  };

  const tabs = [
    { key: 'tabla-trabajo', label: 'Tabla de Trabajo' },
    { key: 'degustacion',   label: 'Degustación' },
    { key: 'proveedores',   label: 'Mis Proveedores' },
  ];

  return (
    <div style={{ padding: '0 0 32px' }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: `2px solid ${PURPLE}22`, marginBottom: 20 }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveForm(t.key)}
            style={{
              padding: '8px 20px', border: 'none', borderRadius: '6px 6px 0 0',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', marginRight: 2,
              background: activeForm === t.key ? PURPLE : '#f3e8ff',
              color:      activeForm === t.key ? '#fff'  : PURPLE,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: MUTED, padding: 24 }}>Cargando datos de la reserva…</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 24px', border: '1px solid #ede9fe' }}>
          {activeForm === 'tabla-trabajo' && <FormTablaTrabajoContent data={formData} set={set} />}
          {activeForm === 'degustacion'   && <FormDegustacionContent   data={formData} set={set} />}
          {activeForm === 'proveedores'   && <FormProveedoresContent   data={formData} set={set} setProveedor={setProveedor} />}

          <DynamicExtras
            extras={formData.extras || []}
            onChange={extras => set('extras', extras)}
          />

          {msg && (
            <div style={{
              margin: '16px 0 4px', padding: '8px 14px', borderRadius: 6,
              background: msg.startsWith('✓') ? '#f0fdf4' : '#fef2f2',
              color:      msg.startsWith('✓') ? '#166534' : '#dc2626',
              fontWeight: 600, fontSize: 13,
            }}>
              {msg}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              style={{ ...S.btn, background: PURPLE, color: '#fff' }}
              onClick={guardar}
              disabled={saving}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              style={{ ...S.btn, background: GREEN, color: '#1a1a1a' }}
              onClick={generarPDF}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              Generar PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulario 1: Tabla de Trabajo ────────────────────────────────────────
function FormTablaTrabajoContent({ data, set }) {
  const inp = (field, label, type = 'text') => (
    <Inp label={label} type={type} value={data[field]} onChange={e => set(field, e.target.value)} />
  );

  return (
    <>
      <div style={S.secTitle}>Datos generales</div>
      <div style={S.row2}>
        {inp('fecha_llenado', 'Fecha de llenado', 'date')}
        {inp('fecha_evento',  'Fecha del evento',  'date')}
      </div>
      <div style={S.row2}>
        {inp('nombre_cliente',   'Nombre del cliente')}
        {inp('nombre_festejado', 'Nombre del festejado')}
      </div>
      <div style={S.row2}>
        {inp('tipo_evento',   'Tipo de evento')}
        {inp('num_invitados', 'Núm. de invitados', 'number')}
      </div>

      <div style={S.secTitle}>Montaje</div>
      <div style={S.row3}>
        {inp('montaje',    'Montaje')}
        {inp('num_mesas',  'Núm. de mesas',  'number')}
        {inp('tipo_mesa',  'Tipo de mesa')}
      </div>
      <div style={S.row3}>
        {inp('num_sillas', 'Núm. de sillas', 'number')}
        {inp('tipo_sillas',  'Tipo de sillas')}
        {inp('color_sillas', 'Color de sillas')}
      </div>

      <div style={S.secTitle}>Mantelería y vajilla</div>
      <div style={S.row3}>
        {inp('mantel_camino', 'Mantel / Camino')}
        {inp('plaque',        'Plaque')}
        {inp('cubierto',      'Cubierto')}
      </div>
      <div style={S.row2}>
        {inp('cristaleria', 'Cristalería')}
        {inp('plato_basse', 'Plato Basse')}
      </div>

      <div style={S.secTitle}>Servicio y alimentos</div>
      <div style={S.row2}>
        {inp('horario_servir', 'Horario de servir')}
        <F label="Tiempos">
          <select value={data.tiempos || ''} onChange={e => set('tiempos', e.target.value)} style={S.inp}>
            <option value="">— Seleccionar —</option>
            <option value="1">1 tiempo</option>
            <option value="2">2 tiempos</option>
            <option value="3">3 tiempos</option>
            <option value="buffet-pizza">Buffet de pizza</option>
            <option value="buffet-desayuno">Buffet desayuno</option>
            <option value="taquiza">Taquiza</option>
          </select>
        </F>
      </div>
      <F label="Alimentos">
        <textarea value={data.alimentos || ''} onChange={e => set('alimentos', e.target.value)} style={S.textarea} />
      </F>

      <div style={S.secTitle}>Bebidas</div>
      <DynamicChecklist
        items={data.bebidas || []}
        onChange={v => set('bebidas', v)}
      />

      <div style={S.secTitle}>Requerimientos técnicos</div>
      <DynamicChecklist
        items={data.req_tecnicos || []}
        onChange={v => set('req_tecnicos', v)}
      />

      <div style={S.secTitle}>Programa DJ</div>
      <DynamicChecklist
        items={data.programa_dj || []}
        onChange={v => set('programa_dj', v)}
      />

      <div style={S.secTitle}>Accesorios</div>
      <DynamicChecklist
        items={data.accesorios || []}
        onChange={v => set('accesorios', v)}
      />

      <div style={S.secTitle}>Servicios</div>
      <DynamicChecklist
        items={data.servicios || []}
        onChange={v => set('servicios', v)}
      />

      <div style={S.secTitle}>Proveedores externos y logística</div>
      <F label="Proveedor(es) externo(s)">
        <textarea value={data.proveedores_externos || ''} onChange={e => set('proveedores_externos', e.target.value)} style={S.textarea} />
      </F>
      <div style={S.row3}>
        {inp('telefono',           'Teléfono')}
        {inp('horario_montaje',    'Horario de montaje')}
        {inp('horario_desmontaje', 'Horario de desmontaje')}
      </div>
      <F label="Notas adicionales">
        <textarea value={data.notas || ''} onChange={e => set('notas', e.target.value)} style={S.textarea} />
      </F>
    </>
  );
}

// ── Formulario 2: Degustación ─────────────────────────────────────────────
function FormDegustacionContent({ data, set }) {
  const inp = (field, label, type = 'text') => (
    <Inp label={label} type={type} value={data[field]} onChange={e => set(field, e.target.value)} />
  );

  return (
    <>
      <div style={S.secTitle}>Datos del evento</div>
      <div style={S.row2}>
        {inp('nombre_cliente', 'Nombre del cliente')}
        {inp('fecha_evento',   'Fecha del evento', 'date')}
      </div>
      <div style={S.row3}>
        {inp('hora',        'Hora',          'time')}
        {inp('tipo_evento', 'Tipo de evento')}
        {inp('aforo',       'Aforo',         'number')}
      </div>

      <div style={S.secTitle}>Elección de entrada — Crema de temporada</div>
      <DynamicChecklist
        items={data.entradas || []}
        onChange={v => set('entradas', v)}
      />

      <div style={S.secTitle}>Plato fuerte</div>
      <DynamicChecklist
        items={data.platos_fuertes || []}
        onChange={v => set('platos_fuertes', v)}
        single
      />

      <div style={S.secTitle}>Postre</div>
      <DynamicChecklist
        items={data.postres || []}
        onChange={v => set('postres', v)}
        single
      />

      <div style={S.secTitle}>Observaciones</div>
      <F label="Observaciones">
        <textarea value={data.observaciones || ''} onChange={e => set('observaciones', e.target.value)} style={S.textarea} />
      </F>

      <div style={S.secTitle}>Firmas</div>
      <div style={S.row3}>
        {inp('firma_chef',    'Chef')}
        {inp('firma_cliente', 'Cliente')}
        {inp('firma_ventas',  'Ventas')}
      </div>
    </>
  );
}

// ── Formulario 3: Mis Proveedores ─────────────────────────────────────────
function FormProveedoresContent({ data, set, setProveedor }) {
  const inp = (field, label, type = 'text') => (
    <Inp label={label} type={type} value={data[field]} onChange={e => set(field, e.target.value)} />
  );

  return (
    <>
      <div style={S.secTitle}>Datos del evento</div>
      <div style={S.row3}>
        {inp('nombre_anfitriones', 'Nombre del/los anfitrión(es)')}
        {inp('tipo_evento',        'Tipo de evento')}
        {inp('fecha_evento',       'Fecha del evento', 'date')}
      </div>

      <div style={S.secTitle}>Directorio de proveedores</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: PURPLE, color: '#fff' }}>
              <th style={TH}>Categoría</th>
              <th style={TH}>Nombre proveedor</th>
              <th style={TH}>Día del evento</th>
              <th style={TH}>Teléfono</th>
              <th style={TH}>Notas</th>
            </tr>
          </thead>
          <tbody>
            {(data.proveedores || []).map((prov, i) => (
              <tr key={prov.categoria} style={{ background: i % 2 === 0 ? '#faf5ff' : '#fff' }}>
                <td style={{ ...TD, fontWeight: 600, color: '#5b21b6', whiteSpace: 'nowrap' }}>{prov.categoria}</td>
                <td style={TD}><input value={prov.nombre   || ''} onChange={e => setProveedor(i, 'nombre',   e.target.value)} style={{ ...S.inp, padding: '4px 6px', fontSize: 11 }} /></td>
                <td style={TD}><input value={prov.dia      || ''} onChange={e => setProveedor(i, 'dia',      e.target.value)} style={{ ...S.inp, padding: '4px 6px', fontSize: 11 }} /></td>
                <td style={TD}><input value={prov.telefono || ''} onChange={e => setProveedor(i, 'telefono', e.target.value)} style={{ ...S.inp, padding: '4px 6px', fontSize: 11 }} /></td>
                <td style={TD}><input value={prov.notas    || ''} onChange={e => setProveedor(i, 'notas',    e.target.value)} style={{ ...S.inp, padding: '4px 6px', fontSize: 11 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const TH = { padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: 11, borderBottom: '2px solid #5b21b6' };
const TD = { padding: '4px 6px', borderBottom: '1px solid #ede9fe', verticalAlign: 'middle' };
