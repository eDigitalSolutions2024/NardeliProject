import { aviso, pedirConfirmacion } from '../utils/avisos';
import TimeField from './ui/TimeField';
import { pedirPasswordAdmin } from '../utils/pedirPassword';
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { jwtDecode } from 'jwt-decode';
import dayjs from 'dayjs';
import './Dashboard.css';
import './Calendario.css'; // incluye estilos de .modal-overlay/.modal-content que usa este archivo
import API_BASE_URL, { authHeaders } from '../api';
// imports nuevos arriba
import { animate, stagger } from 'animejs';
import SearchField from './ui/SearchField';
import DateField from './ui/DateField';
import SelectField from './ui/SelectField';
import { LuCalendarDays, LuPartyPopper, LuCalendarCheck, LuFileClock, LuFileText, LuFileDown, LuPencil, LuCheck, LuTrash2, LuHourglass, LuInbox, LuBadgeDollarSign, LuUser, LuPackage, LuGift, LuLayoutDashboard, LuUsers, LuCalendar, LuTrendingUp, LuWarehouse, LuCirclePlus, LuShieldCheck, LuLogOut, LuMenu, LuSun, LuMoon } from 'react-icons/lu';
import { getStoredUser } from '../session';
import { useTema, TEMA_OSCURO_ACTIVO } from '../utils/tema';

const Calendario = lazy(() => import('./Calendario'));
const FormProducto = lazy(() => import('./FormProducto'));
const TablaProductos = lazy(() => import('./TablaProductos'));
const Clientes = lazy(() => import('./Clientes'));
const Reserva = lazy(() => import('./ReservarEvento'));
const Reportes = lazy(() => import('./Reportes'));
const FormAccesorio = lazy(() => import('./FormAccesorio'));
const TablaAccesorios = lazy(() => import('./TablaAccesorios'));
const UsuariosRoles = lazy(() => import('./UsuariosRoles'));

// Marca del menú lateral: 'dorado' (isotipo nítido pintado de dorado) o 'resplandor' (imagen de óvalos con halo).
const MARCA_SIDEBAR = 'dorado';


// Tarjeta de indicador: el número cuenta desde 0 hasta su valor (anime.js).
function KpiCard({ icon, label, value, tono = 'morado' }) {
  const numRef = useRef(null);
  useEffect(() => {
    const el = numRef.current;
    const destino = Number(value) || 0;
    if (!el) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = destino;
      return undefined;
    }
    const obj = { v: 0 };
    const anim = animate(obj, {
      v: destino,
      duration: 1100,
      ease: 'outExpo',
      onUpdate: () => { el.textContent = Math.round(obj.v); },
    });
    return () => anim.pause();
  }, [value]);

  return (
    <div className={`nd-kpi nd-kpi-${tono}`}>
      <span className="nd-kpi-icon">{icon}</span>
      <div className="nd-kpi-info">
        <span className="nd-kpi-label">{label}</span>
        <strong className="nd-kpi-number" ref={numRef}>0</strong>
      </div>
    </div>
  );
}


// Óvalos de fondo (el motivo del logo): solo CSS, se mueven con transform, casi no consumen.
// x/y = posición en %, w = ancho en px, r = giro en grados, d = duración en s, t = tono.
const OVALOS_FONDO = [
  { x: 4,  y: 6,  w: 340, r: -18, d: 38, t: 'm' },
  { x: 70, y: 2,  w: 280, r: 14,  d: 44, t: 'd' },
  { x: 38, y: 24, w: 420, r: -8,  d: 52, t: 'l' },
  { x: 84, y: 36, w: 360, r: 22,  d: 41, t: 'm' },
  { x: 8,  y: 52, w: 300, r: 10,  d: 47, t: 'd' },
  { x: 55, y: 60, w: 380, r: -20, d: 56, t: 'm' },
  { x: 90, y: 78, w: 300, r: 8,   d: 36, t: 'l' },
  { x: 20, y: 84, w: 400, r: -12, d: 49, t: 'd' },
  { x: 62, y: 92, w: 260, r: 18,  d: 43, t: 'l' },
];

// Estrellitas doradas y lilas: parpadean y se desplazan despacio (CSS, casi sin costo).
// Se generan una sola vez con una semilla fija, así siempre quedan en los mismos lugares.
const ESTRELLAS_FONDO = (() => {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  return Array.from({ length: 40 }, (_, i) => ({
    x: Math.round(rnd() * 96),
    y: Math.round(rnd() * 94),
    s: 9 + Math.round(rnd() * 10),
    d: 3.4 + rnd() * 4.2,          // duración del parpadeo (s)
    m: 15 + rnd() * 16,            // duración del desplazamiento (s)
    dx: Math.round((rnd() - 0.5) * 110),
    dy: -Math.round(30 + rnd() * 90),
    c: i % 3 === 0 ? 'l' : 'o',
  }));
})();

const ORDEN_COTIZACIONES = [
  { value: 'fecha_asc', label: 'Fecha del evento ↑' },
  { value: 'fecha_desc', label: 'Fecha del evento ↓' },
  { value: 'cliente_asc', label: 'Cliente A→Z' },
  { value: 'cliente_desc', label: 'Cliente Z→A' },
  { value: 'creacion_desc', label: 'Creadas: más recientes primero' },
  { value: 'creacion_asc', label: 'Creadas: más antiguas primero' },
];

const Dashboard = ({ onLogout }) => {
  const [user, setUser] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showDropdown, setShowDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tema, alternarTema] = useTema();
  const [inventarioTick, setInventarioTick] = useState(0);
  const [accesorioTick, setAccesorioTick] = useState(0);
  const [inventarioTab, setInventarioTab] = useState('producto'); // 'producto' | 'accesorio'
  const listaRef = useRef(null);

  // KPIs / actividad
  const [loadingDash, setLoadingDash] = useState(false);
  const [kpis, setKpis] = useState({
    eventosMes: 0,
    proximosEventos: 0,
  });
  const [actividad, setActividad] = useState([]); // cotizaciones pendientes


  const [searchActividad, setSearchActividad] = useState('');
  const [filtroFechaActividad, setFiltroFechaActividad] = useState(''); // "YYYY-MM-DD"
  const [ordenActividad, setOrdenActividad] = useState('fecha_asc');

  // Mismo candado de 24h que ya usa el backend (ver HOLD_COTIZACION_MS en
  // routes/reservas.js) — se usa solo para resaltar en esta lista, no para
  // bloquear nada aquí.
  const HOLD_COTIZACION_MS = 24 * 60 * 60 * 1000;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const tieneHoldActivo = (a) => {
    if (!a.createdAt || a.holdLiberado) return false;
    return (new Date(a.createdAt).getTime() + HOLD_COTIZACION_MS) > now;
  };



  // === Modal edición cotización ===
  const [showEditCot, setShowEditCot] = useState(false);
  const [cotEdit, setCotEdit] = useState(null);

  // === Tipo de cambio global ===
  const [tipoCambio, setTipoCambio] = useState(18.00);
  const [editandoTC, setEditandoTC] = useState(false);
  const [tcInput, setTcInput] = useState('');

  // Helpers
  const obtenerIcono = (tipo = '') => {
    switch (String(tipo).toLowerCase()) {
      case 'boda': return '💒';
      case 'cumpleaños': return '🎂';
      case 'graduación': return '🎓';
      case 'xv': return '👑';
      case 'reunión': return '💼';
      case 'comedia': return '🤡';
      case 'musica': return '🎶';
      default: return '🎉';
    }
  };


  const eliminarCotizacion = async (id) => {
  if (!id) return;
  const ok = await pedirConfirmacion('¿Eliminar esta cotización? Esta acción no se puede deshacer.');
  if (!ok) return;

  try {
    const resp = await fetch(`${API_BASE_URL}/reservas/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      let err;
      try { err = JSON.parse(txt); } catch { err = { msg: txt || `HTTP ${resp.status}` }; }
      aviso(err?.msg || err?.error || 'No se pudo eliminar la cotización');
      return;
    }

    await cargarDashboardData(); // refresca el panel
    aviso('✅ Cotización eliminada');
  } catch (e) {
    console.error('eliminarCotizacion error:', e);
    aviso('Error de conexión');
  }
};

  const toHHmm = (h) => {
    if (!h) return '';
    const s = String(h).trim().toLowerCase();
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return String(h);
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const isPM = /p\s*\.?\s*m\.?/i.test(s) || /\bpm\b/i.test(s);
    const isAM = /a\s*\.?\s*m\.?/i.test(s) || /\bam\b/i.test(s);
    if (isPM && hh < 12) hh += 12;
    if (isAM && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${mm}`;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser(decoded);
      } catch (error) {
        console.error('Token inválido', error);
      }
    }
  }, []);

  // Permisos vigentes del rol (los define el admin en "Usuarios y roles").
  // Arranca con lo guardado al iniciar sesión y se refresca contra el servidor.
  const [permisos, setPermisos] = useState(() => getStoredUser()?.permisos || {});
  const [rolServidor, setRolServidor] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE_URL}/permisos/me`, { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return;
        setPermisos(d.permisos || {});
        setRolServidor(d.role || null);
      })
      .catch(() => {});
  }, []);

  // ---- Tipo de cambio ----
  useEffect(() => {
    fetch(`${API_BASE_URL}/settings/tipo-cambio`)
      .then(r => r.json())
      .then(d => { if (d.value) setTipoCambio(Number(d.value)); })
      .catch(() => {});
  }, []);

  const guardarTipoCambio = async () => {
    const v = Number(tcInput);
    if (!v || v <= 0) return aviso('Ingresa un valor válido.');
    const token = localStorage.getItem('token') || '';
    const r = await fetch(`${API_BASE_URL}/settings/tipo-cambio`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ value: v }),
    });
    if (r.ok) {
      setTipoCambio(v);
      setEditandoTC(false);
    } else {
      const err = await r.json().catch(() => ({}));
      aviso(err?.error || 'No se pudo guardar.');
    }
  };

  // ---- Carga de datos del dashboard (eventos + cotizaciones) ----
  const cargarDashboardData = async () => {
    const hoy = new Date();
    const iniMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);

    const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0, 0);

    
    const getFecha = (r) => {
      const ymd = r.fechaLocal || String(r.fecha).slice(0, 10); // "YYYY-MM-DD"
      return new Date(`${ymd}T12:00:00`);
    };
    const getCliente = (r) => r.cliente || r.clienteNombre || 'Sin nombre';

    const soloEventos = (arr) =>
      (Array.isArray(arr) ? arr : []).filter(
        r => (r.tipoReserva ?? (r.esCotizacion ? 'cotizacion' : 'evento')) === 'evento'
      );
    const soloCotizaciones = (arr) =>
      (Array.isArray(arr) ? arr : []).filter(
        r => (r.tipoReserva ?? (r.esCotizacion ? 'cotizacion' : 'evento')) === 'cotizacion'
      );

    setLoadingDash(true);
    try {
      const [rawEventos, rawCots] = await Promise.all([
        fetch(`${API_BASE_URL}/reservas?tipo=evento`, { headers: authHeaders() }).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE_URL}/reservas?tipo=cotizacion`, { headers: authHeaders() }).then(r => r.json()).catch(() => []),
      ]);

      const eventos = soloEventos(rawEventos);
      const cotizaciones = soloCotizaciones(rawCots);

      // KPIs (solo eventos)
      const enMes = eventos.filter(r => {
          const f = getFecha(r);
          return f >= hoy0 && f <= finMes;
        });
      const futurosEventos = eventos
        .filter(r => getFecha(r) >= new Date())
        .sort((a,b) => getFecha(a) - getFecha(b));

      setKpis({
        eventosMes: enMes.length,
        proximosEventos: futurosEventos.length,
      });

      // Cotizaciones pendientes (no aceptadas y no canceladas — una
      // cancelada, aunque no esté "aceptada", ya no cuenta como pendiente)
      const pendientes = cotizaciones
        .filter(r => !(r.cotizacion && r.cotizacion.aceptada) && r.estado !== 'cancelada')
        .sort((a,b) => getFecha(a) - getFecha(b));

      const buildPdfUrl = (id) => `${API_BASE_URL}/reservas/${id}/pdf`;

      setActividad(
        pendientes.slice(0).map(r => {
          console.log('cot:', r._id, 'shortId:', r.shortId, 'folio:', r.folio);

          return {
            id: r._id,
            folio: (r.shortId || r.folio || '').toUpperCase(),
            folioLabel: `#${(r.shortId || r.folio || '').toUpperCase()}`,
            titulo: `Cotización - ${getCliente(r)}`,
            subtitulo: `Para el ${dayjs(getFecha(r)).format('DD [de] MMMM [de] YYYY')}`,
            icon: <LuFileText />,
            pdfUrl: buildPdfUrl(r._id),
            cliente: getCliente(r),
            tipoEvento: r.tipoEvento || '',
            ymd: r.fechaLocal || String(r.fecha).slice(0, 10),
            horaInicio: r.horaInicio || '',
            horaFin: r.horaFin || r.horaInicio || '',
            cantidadPersonas: r.cantidadPersonas || 0,
            descripcion: r.descripcion || '',
            createdAt: r.createdAt || null,
            holdLiberado: !!r.holdLiberado,
          };
        })
      );


       



    } catch (e) {
      console.error('Error cargando reservas para dashboard:', e);
    } finally {
      setLoadingDash(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'dashboard') cargarDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const rolActual = rolServidor || user?.role;
  const isAdmin = rolActual === 'admin';
  const isAsistente = rolActual === 'asistente';
  // El admin siempre puede todo; el resto según la tabla de permisos.
  const can = (p) => isAdmin || !!permisos[p];
  const canAny = (...ps) => ps.some(can);

  // `perm`: permisos que habilitan la sección (basta con uno). El servidor
  // también los valida, esto solo evita mostrar menús que no funcionarían.
  const menuItems = [
    { id: 'dashboard', grupo: 'General', label: 'Dashboard', icon: <LuLayoutDashboard />, perm: ['eventos.gestionar', 'clientes.ver', 'calendario.ver', 'cotizaciones.ver_todas'] },
    { id: 'clientes', grupo: 'General', label: 'Clientes', icon: <LuUsers />, perm: ['clientes.ver'] },
    { id: 'calendario', grupo: 'General', label: 'Calendario', icon: <LuCalendar />, perm: ['calendario.ver'] },
    { id: 'reportes', grupo: 'Gestión', label: 'Reportes', icon: <LuTrendingUp />, perm: ['reportes.ver'] },
    { id: 'inventario', grupo: 'Gestión', label: 'Inventario', icon: <LuWarehouse />, perm: ['inventario.gestionar'] },
    { id: 'reservar', grupo: 'Gestión', label: 'Reservar', icon: <LuCirclePlus />, perm: ['cotizaciones.crear'] },
    { id: 'usuarios', grupo: 'Administración', label: 'Usuarios y roles', icon: <LuShieldCheck />, perm: ['usuarios.gestionar'] },
  ];

  const visibleMenuItems = menuItems.filter(i => canAny(...i.perm));

  // Si la sección abierta ya no está permitida (p. ej. el admin apagó un permiso), salta a la primera disponible.
  useEffect(() => {
    if (!visibleMenuItems.length) return;
    if (!visibleMenuItems.some(i => i.id === activeSection)) {
      setActiveSection(visibleMenuItems[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permisos, rolServidor]);

  // ===== Acciones de cotizaciones =====
  const abrirModalEditarCot = (a) => {
    setCotEdit({
      id: a.id,
      cliente: a.cliente,
      tipo: a.tipoEvento,
      fecha: new Date(`${a.ymd}T12:00:00`),
      horaInicio: toHHmm(a.horaInicio),
      horaFin: toHHmm(a.horaFin || a.horaInicio),
      invitados: a.cantidadPersonas,
      descripcion: a.descripcion || '',
    });
    setShowEditCot(true);
  };

  const cerrarModalCot = () => {
    setCotEdit(null);
    setShowEditCot(false);
  };

  const onChangeCot = (e) => {
    const { name, value } = e.target;
    setCotEdit(prev => ({ ...prev, [name]: value }));
  };

  const actualizarCotizacion = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        cliente: cotEdit.cliente,
        tipoEvento: cotEdit.tipo,
        fecha: dayjs(cotEdit.fecha).format('YYYY-MM-DD'),
        horaInicio: toHHmm(cotEdit.horaInicio),
        horaFin: toHHmm(cotEdit.horaFin),
        cantidadPersonas: Number(cotEdit.invitados || 0),
        descripcion: cotEdit.descripcion || '',
        // mantenerla como cotización (no convertir aquí)
        tipoReserva: 'cotizacion',
      };

      const enviar = (adminPassword) => fetch(`${API_BASE_URL}/reservas/${cotEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(adminPassword ? { ...payload, adminPassword } : payload),
      });

      let r = await enviar();

      // Candado blando de 24h: la fecha/horario a la que se está moviendo
      // esta cotización choca con otra cotización reciente. Se pide la
      // contraseña de un administrador para forzar el cambio.
      if (r.status === 401) {
        const err = await r.json().catch(() => ({}));
        if (err.requierePassword) {
          const adminPassword = await pedirPasswordAdmin(
            err.msg || 'Ya existe una cotización reciente para esa fecha. Ingresa la contraseña de un administrador para continuar:'
          );
          if (adminPassword === null) return; // canceló
          if (!adminPassword.trim()) {
            aviso('Debes ingresar una contraseña.');
            return;
          }
          r = await enviar(adminPassword);
        }
      }

      if (!r.ok) {
        const err = await r.json().catch(()=>({}));
        aviso(err?.msg || err?.motivo || err?.error || 'No se pudo actualizar la cotización');
        return;
      }

      cerrarModalCot();
      await cargarDashboardData();
    } catch (err) {
      console.error('actualizarCotizacion error:', err);
      aviso('Error de conexión');
    }
  };

  const convertirACEvento = async (id) => {
    try {
      const cleanId = String(id).replace(/['"]/g, '').trim();
      const url = `${API_BASE_URL}/reservas/${encodeURIComponent(cleanId)}/aceptar-cotizacion`;

      const enviar = (adminPassword) => fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(adminPassword ? { adminPassword } : {})
      });

      let resp = await enviar();

      // Candado blando de 24h: ya existe otra cotización reciente para esa
      // fecha. Se pide contraseña de administrador para forzar la conversión.
      if (resp.status === 401) {
        const err = await resp.json().catch(() => ({}));
        if (err.requierePassword) {
          const adminPassword = await pedirPasswordAdmin(
            err.msg || 'Ya existe una cotización reciente para esa fecha. Ingresa la contraseña de un administrador para continuar:'
          );
          if (adminPassword === null) return; // canceló
          if (!adminPassword.trim()) {
            aviso('Debes ingresar una contraseña.');
            return;
          }
          resp = await enviar(adminPassword);
        }
      }

      if (!resp.ok) {
        const text = await resp.text();
        let errObj;
        try { errObj = JSON.parse(text); } catch { errObj = { msg: text }; }
        aviso(errObj?.msg || errObj?.motivo || errObj?.error || `Error ${resp.status}`);
        return;
      }

      await cargarDashboardData();
      aviso('✅ Cotización convertida a Evento');
    } catch (e) {
      console.error('convertirACEvento error:', e);
      aviso('Error de conexión');
    }
  };

  const abrirPanelArticulosAdmin = () => {
    if (!cotEdit?.id) return;
    const qs = new URLSearchParams({ reservaId: cotEdit.id, mode: 'admin' }).toString();
    window.open(`/cliente/dashboard?${qs}`, '_blank', 'noopener,noreferrer');
  };

 const normalizeFolio = (s) =>
  String(s || '').trim().replace(/^#/, '').toUpperCase();

const actividadFiltrada = actividad
  .filter(a => {
    const q = String(searchActividad || '').trim();
    if (q) {
      const qNorm = normalizeFolio(q);
      const texto = `${a.titulo || ''} ${a.subtitulo || ''} ${a.cliente || ''}`.toLowerCase();
      const folio = normalizeFolio(a.folio);
      // busca por texto normal o por folio
      const coincide = texto.includes(q.toLowerCase()) || (folio && folio.includes(qNorm));
      if (!coincide) return false;
    }

    if (filtroFechaActividad && a.ymd !== filtroFechaActividad) return false;

    return true;
  })
  .sort((a, b) => {
    switch (ordenActividad) {
      case 'fecha_desc':
        return (b.ymd || '').localeCompare(a.ymd || '');
      case 'cliente_asc':
        return (a.cliente || '').localeCompare(b.cliente || '', 'es', { sensitivity: 'base' });
      case 'cliente_desc':
        return (b.cliente || '').localeCompare(a.cliente || '', 'es', { sensitivity: 'base' });
      case 'creacion_desc':
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      case 'creacion_asc':
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      case 'fecha_asc':
      default:
        return (a.ymd || '').localeCompare(b.ymd || '');
    }
  });

  // Las cotizaciones entran escalonadas la primera vez que cargan.
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista || !actividad.length) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    animate(lista.querySelectorAll('.activity-item'), {
      opacity: [0, 1],
      translateY: [18, 0],
      delay: stagger(70),
      duration: 600,
      ease: 'outCubic',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actividad.length > 0]);

  // El menú entra escalonado la primera vez (solo visual).
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    animate('.sidebar-nav .nav-item', { opacity: [0, 1], translateX: [-16, 0], delay: stagger(55, { start: 150 }), duration: 520, ease: 'outCubic' });
  }, []);

  const renderContent = () => {
    switch (activeSection) {
      case 'usuarios':
        return can('usuarios.gestionar') ? <UsuariosRoles currentUser={user} /> : null;
      case 'dashboard':
        return (
          <div className="dashboard-content">
            <div className="nd-welcome">
              <div>
                <h1>Bienvenido, {user?.fullname || user?.email}</h1>
                <p>Panel de control - Salón de Eventos Nardeli</p>
              </div>
              <span className="nd-date-chip">
                <LuCalendarDays />
                {(() => { const f = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }); return f.charAt(0).toUpperCase() + f.slice(1); })()}
              </span>
            </div>

            {/* KPIs */}
            <div className="nd-kpis">
              <KpiCard icon={<LuPartyPopper />} label="Eventos del mes" value={kpis.eventosMes} tono="morado" />
              <KpiCard icon={<LuCalendarCheck />} label="Próximos eventos" value={kpis.proximosEventos} tono="dorado" />
              <KpiCard icon={<LuFileClock />} label="Cotizaciones pendientes" value={actividad.length} tono="lila" />
            </div>

            {/* Widget Tipo de Cambio */}
            <div className="nd-tc">
              <span className="nd-tc-icon"><LuBadgeDollarSign /></span>
              <div className="nd-tc-info">
                <span className="nd-tc-label">Tipo de cambio USD → MXN</span>
                {!editandoTC ? (
                  <span className="nd-tc-value">${tipoCambio.toFixed(2)} MXN</span>
                ) : null}
              </div>

              {isAdmin && !editandoTC && (
                <button className="nd-btn nd-btn-ghost" onClick={() => { setTcInput(tipoCambio); setEditandoTC(true); }}>
                  <LuPencil /> Cambiar
                </button>
              )}

              {isAdmin && editandoTC && (
                <div className="nd-tc-edit">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={tcInput}
                    onChange={e => setTcInput(e.target.value)}
                    className="nd-input nd-input-sm"
                    autoFocus
                  />
                  <button className="nd-btn nd-btn-primary" onClick={guardarTipoCambio}>Guardar</button>
                  <button className="nd-btn nd-btn-ghost" onClick={() => setEditandoTC(false)}>Cancelar</button>
                </div>
              )}

              {!isAdmin && (
                <span className="nd-tc-note">Solo el administrador puede modificarlo</span>
              )}
            </div>

            {/* Cotizaciones pendientes */}
            <div className="nd-panel recent-activity">
              <div className="nd-panel-head">
                <h2>
                  Cotizaciones pendientes
                  <span className="nd-count">{actividadFiltrada.length}</span>
                </h2>

                <div className="nd-toolbar">
                  {loadingDash && <span className="nd-loading">Actualizando…</span>}

                  <SearchField
                    value={searchActividad}
                    onChange={setSearchActividad}
                    placeholder="Buscar por cliente, fecha o texto..."
                  />

                  <DateField
                    value={filtroFechaActividad}
                    onChange={setFiltroFechaActividad}
                    placeholder="Fecha del evento"
                  />

                  <SelectField
                    value={ordenActividad}
                    onChange={setOrdenActividad}
                    options={ORDEN_COTIZACIONES}
                    aria-label="Ordenar por"
                  />
                </div>
              </div>

              <div className="activity-list" ref={listaRef}>
                {actividadFiltrada.length === 0 && (
                  <div className="activity-item nd-empty">
                    <span className="activity-icon"><LuInbox /></span>
                    <div className="activity-details">
                      <p><strong>Sin cotizaciones pendientes</strong></p>
                      <small>
                        {actividad.length === 0
                          ? 'Cuando registres cotizaciones aparecerán aquí.'
                          : 'No hay resultados para ese criterio de búsqueda.'}
                      </small>
                    </div>
                  </div>
                )}

                {actividadFiltrada.map(a => {
                  const holdActivo = tieneHoldActivo(a);
                  return (
                    <div key={a.id} className={`activity-item${holdActivo ? ' activity-item-hold' : ''}`}>
                      <span className="activity-icon">{a.icon}</span>
                      <div className="activity-details">
                        <p>
                          <strong>{a.titulo}</strong>
                          {a.folio && <span className="nd-folio">#{a.folio}</span>}
                          {holdActivo && (
                            <span className="hold-badge" title="Esta fecha todavía tiene prioridad de 24h: se necesita contraseña de admin para tomarla">
                              <LuHourglass /> prioridad 24h
                            </span>
                          )}
                        </p>
                        <small><LuCalendarDays /> {a.subtitulo}</small>
                        <div className="activity-actions">
                          <button className="nd-btn nd-btn-ghost" onClick={() => abrirModalEditarCot(a)}>
                            <LuPencil /> Editar
                          </button>
                          <button className="nd-btn nd-btn-primary" onClick={() => convertirACEvento(a.id)}>
                            <LuCheck /> Convertir a Evento
                          </button>
                          {a.pdfUrl && (
                            <a className="nd-btn nd-btn-ghost btn-pdf-rojo" href={a.pdfUrl} target="_blank" rel="noreferrer">
                              <LuFileDown /> Ver PDF
                            </a>
                          )}
                          {can('eventos.eliminar') && (
                            <button className="nd-btn nd-btn-danger" onClick={() => eliminarCotizacion(a.id)} title="Eliminar cotización">
                              <LuTrash2 /> Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal de edición de cotización */}
            {showEditCot && cotEdit && (
              <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrarModalCot(); }}>
                <div className="modal-content nd-modal">
                  <h2>Editar Cotización</h2>
                  <form onSubmit={actualizarCotizacion} className="nd-form">
                  <div className="nd-grid-2">
                    <label className="nd-field"><span>Cliente</span><input autoFocus type="text" name="cliente" placeholder="Nombre del cliente" value={cotEdit.cliente} onChange={onChangeCot} required /></label>
                    <label className="nd-field"><span>Tipo de evento</span><input type="text" name="tipo" placeholder="Tipo de evento" value={cotEdit.tipo} onChange={onChangeCot} required /></label>
                  </div>
                  <div className="nd-field"><span>Fecha</span><DateField
                      name="fecha"
                      value={dayjs(cotEdit.fecha).format('YYYY-MM-DD')}
                      onChange={(v) => setCotEdit(prev => ({ ...prev, fecha: new Date(`${v}T12:00:00`) }))}
                      required
                      clearable={false}
                      style={{ width: '100%' }}
                    /></div>
                  <div className="nd-grid-2">
                    <div className="nd-field"><span>Hora de inicio</span><TimeField name="horaInicio" value={toHHmm(cotEdit.horaInicio)} onChange={(v) => onChangeCot({ target: { name: 'horaInicio', value: v } })} required clearable={false} style={{ width: '100%' }} /></div>
                    <div className="nd-field"><span>Hora de fin</span><TimeField name="horaFin" value={toHHmm(cotEdit.horaFin)} onChange={(v) => onChangeCot({ target: { name: 'horaFin', value: v } })} required clearable={false} style={{ width: '100%' }} /></div>
                  </div>
                  <label className="nd-field"><span>Invitados</span><input type="number" name="invitados" placeholder="Cantidad de personas" value={cotEdit.invitados} onChange={onChangeCot} required /></label>
                  <label className="nd-field"><span>Observaciones</span><textarea name="descripcion" placeholder="Observaciones" value={cotEdit.descripcion} onChange={onChangeCot} /></label>

                  <div className="nd-form-actions">
                    <button type="button" className="nd-btn nd-btn-ghost nd-btn-block" onClick={abrirPanelArticulosAdmin}>
                      Abrir panel de artículos (admin)
                    </button>
                    <div className="nd-form-actions-main">
                      <button type="button" className="nd-btn nd-btn-ghost" onClick={cerrarModalCot}>Cancelar</button>
                      <button type="submit" className="nd-btn nd-btn-primary">Guardar</button>
                    </div>
                  </div>
                </form>
                </div>
              </div>
            )}
          </div>
        );

      case 'clientes':
        return (
          <div className="dashboard-content nd-wide">
            <h1 className="nd-page-title">Gestión de Clientes</h1>
            <Clientes />
          </div>
        );
      case 'calendario':
        return (
          <div className="dashboard-content">
            <Calendario />
          </div>
        );
      case 'reportes':
        return (
          <div className="dashboard-content">
            <Reportes />
          </div>
        );
      case 'reservar':
        return (
          <div className='dashboard-content'>
            <Reserva />
          </div>
        );
      case 'inventario':
        return (
    <div className='dashboard-content'>
      <div className="nd-welcome">
        <div>
          <h1>Inventario</h1>
          <p>Administra los productos y accesorios disponibles para tus eventos.</p>
        </div>
      </div>

      {/* Selector de formulario */}
      <div className="nd-seg">
        <button className={`nd-seg-btn ${inventarioTab === 'producto' ? 'active' : ''}`} onClick={() => setInventarioTab('producto')}>
          <LuPackage /> Productos
        </button>
        <button className={`nd-seg-btn ${inventarioTab === 'accesorio' ? 'active' : ''}`} onClick={() => setInventarioTab('accesorio')}>
          <LuGift /> Accesorios
        </button>
      </div>

      {inventarioTab === 'producto' ? (
        <>
          <FormProducto onProductoAgregado={() => setInventarioTick(t => t + 1)} />
          <TablaProductos refresh={inventarioTick} />
        </>
      ) : (
        <>
          <FormAccesorio onAccesorioAgregado={() => setAccesorioTick(t => t + 1)} />
          <TablaAccesorios refresh={accesorioTick} />
        </>
      )}
    </div>
  );
      case 'configuracion':
        return (
          <div className="dashboard-content">
            <h1>Configuración</h1>
            <p>Configura las opciones del sistema.</p>
          </div>
        );
      default:
        return <div>Sección no encontrada</div>;
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className='hamburger-wrapper'>
          <button className='hamburger-icon' onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Mostrar u ocultar menú" title="Menú"><LuMenu /></button>
        </div>

        <div className="sidebar-header">
          <div className={`sidebar-mark ${MARCA_SIDEBAR}`} role="img" aria-label="Nardeli" />
          <h2 className="sidebar-brand">Nardeli</h2>
          <p className="sidebar-subtitle">Salón de Eventos</p>
        </div>

        <nav className="sidebar-nav">
          {visibleMenuItems.map((item, i) => (
            <React.Fragment key={item.id}>
              {(i === 0 || item.grupo !== visibleMenuItems[i - 1].grupo) && (
                <div className="nav-group"><span>{item.grupo}</span></div>
              )}
              <button
                className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
                data-tip={item.label}
                aria-label={item.label}
                aria-current={activeSection === item.id ? 'page' : undefined}
                onClick={() => {
                  setActiveSection(item.id);
                }}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            </React.Fragment>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" data-tip={user?.fullname || user?.email}>
            <span className="sidebar-user-avatar" aria-hidden="true">{(user?.fullname || user?.email || '?').trim().charAt(0).toUpperCase()}</span>
            <div className="sidebar-user-info">
              <strong>{user?.fullname || user?.email}</strong>
              <small>{{ admin: 'Administrador', asistente: 'Asistente', cotizador: 'Cotizador' }[rolActual] || 'Usuario'}</small>
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout} data-tip="Cerrar Sesión" aria-label="Cerrar Sesión">
            <span className="nav-icon"><LuLogOut /></span>
            <span className="nav-label">Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="nd-bg" aria-hidden="true">
          {OVALOS_FONDO.map((o, i) => (
            <span
              key={i}
              className={`nd-oval nd-oval-${o.t}`}
              style={{ left: `${o.x}%`, top: `${o.y}%`, width: o.w, height: o.w * 0.58, '--r': `${o.r}deg`, '--d': `${o.d}s`, animationDelay: `${-i * 5}s` }}
            />
          ))}
          {ESTRELLAS_FONDO.map((e, i) => (
            <span
              key={`s${i}`}
              className={`nd-star nd-star-${e.c}`}
              style={{ left: `${e.x}%`, top: `${e.y}%`, '--s': `${e.s}px`, '--d': `${e.d}s`, '--m': `${e.m}s`, '--dx': `${e.dx}px`, '--dy': `${e.dy}px`, animationDelay: `${-i * 0.9}s, ${-i * 1.7}s` }}
            />
          ))}
        </div>

        <header className="main-header">
          <div className="header-left">
            <h1 className="page-title">
              {menuItems.find(item => item.id === activeSection)?.label || 'Dashboard'}
            </h1>
          </div>
          <div className="header-right">
            {TEMA_OSCURO_ACTIVO && <button className="tema-toggle" onClick={alternarTema} title={tema === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} aria-label="Cambiar tema">
              {tema === 'oscuro' ? <LuSun /> : <LuMoon />}
            </button>}
            <div className="user-info">
              <span className="user-avatar"><LuUser /></span>
              <span className="user-name">{user?.fullname || user?.email}</span>
            </div>
          </div>
        </header>

        <main className="content-area">
          <div key={activeSection} className="nd-seccion-anim">
            <Suspense fallback={<div className="sk-carga" role="status" aria-label="Cargando"><span className="sk sk-titulo" /><span className="sk sk-fila" /><span className="sk sk-fila" /><span className="sk sk-fila corta" /></div>}>
              {renderContent()}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
