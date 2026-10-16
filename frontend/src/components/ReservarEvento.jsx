import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import API_BASE_URL, { authHeaders } from '../api';
import useDisponibilidadReservas from '../hooks/useDisponibilidadReservas';
import MiniCalendarioDisponibilidad from './MiniCalendarioDisponibilidad';
import './Reservar.css';

const BORRADOR_KEY = 'nardeli_reserva_borrador';

const camposSignificativos = ['cliente', 'correo', 'tipoEvento', 'fecha', 'telefono', 'cantidadPersonas', 'descripcion', 'notaCotizacion'];
const tieneContenido = (data) => camposSignificativos.some(k => String(data[k] || '').trim() !== '');

const formInicial = {
  cliente: '',
  correo: '',
  tipoEvento: '',
  fecha: '',
  horaInicio: '',
  horaFin: '',
  telefono: '',
  cantidadPersonas: '',
  descripcion: '',
  tipoReserva: 'cotizacion',
  notaCotizacion: ''
};
// ✅ Cuando quieras activar el envío de código, descomenta la línea de abajo:
// import { iniciarAccesoPorCorreo } from '../api/auth';

// Contador en vivo de cuánto le queda al candado de 24h de una cotización
// (ver HOLD_COTIZACION_MS en el backend). Puramente informativo, se
// actualiza cada segundo; cuando llega a 0 muestra que la fecha ya quedó
// libre sin necesidad de contraseña.
function ContadorHold({ expiraEn }) {
  const [restanteMs, setRestanteMs] = useState(() => (expiraEn ? new Date(expiraEn).getTime() - Date.now() : null));

  useEffect(() => {
    if (!expiraEn) return;
    const tick = () => setRestanteMs(new Date(expiraEn).getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiraEn]);

  if (!expiraEn || restanteMs === null) return null;

  if (restanteMs <= 0) {
    return <span className="cotizacion-hold cotizacion-hold-libre">🟢 fecha ya libre</span>;
  }

  const h = Math.floor(restanteMs / 3600000);
  const m = Math.floor((restanteMs % 3600000) / 60000);
  const s = Math.floor((restanteMs % 60000) / 1000);
  return (
    <span className="cotizacion-hold" title="Después de este tiempo cualquiera puede cotizar esta fecha sin contraseña">
      ⏳ libre en {h}h {m}m {s}s
    </span>
  );
}

// soloCotizacion: usado por el rol 'cotizador' — fuerza tipo cotización y oculta el toggle de evento.
const ReservarEvento = ({ soloCotizacion = false }) => {
  const [formData, setFormData] = useState(() => {
    try {
      const guardado = localStorage.getItem(BORRADOR_KEY);
      return guardado ? { ...formInicial, ...JSON.parse(guardado) } : formInicial;
    } catch {
      return formInicial;
    }
  });

  const [tieneBorrador, setTieneBorrador] = useState(() => {
    try {
      const guardado = localStorage.getItem(BORRADOR_KEY);
      return guardado ? tieneContenido(JSON.parse(guardado)) : false;
    } catch { return false; }
  });
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();

  const { porFecha, estadoFecha, precargarDesde } = useDisponibilidadReservas();

  // Precarga el mes de la fecha elegida (por si el usuario la escribe a mano
  // y cae fuera del rango que el mini calendario ya trae precargado).
  useEffect(() => {
    if (!formData.fecha) return;
    const d = new Date(`${formData.fecha}T12:00:00`);
    if (isNaN(d)) return;
    precargarDesde(d.getFullYear(), d.getMonth(), 0);
  }, [formData.fecha, precargarDesde]);

  const estadoFechaActual = formData.fecha
    ? estadoFecha(formData.fecha, { horaInicio: formData.horaInicio, horaFin: formData.horaFin })
    : null;
  const horarioCompleto = !!(formData.horaInicio && formData.horaFin);

  useEffect(() => {
    if (tieneContenido(formData)) {
      localStorage.setItem(BORRADOR_KEY, JSON.stringify(formData));
      setTieneBorrador(true);
    } else {
      localStorage.removeItem(BORRADOR_KEY);
      setTieneBorrador(false);
    }
  }, [formData]);

  const limpiarBorrador = () => {
    localStorage.removeItem(BORRADOR_KEY);
    setFormData(formInicial);
    setTieneBorrador(false);
    setMensaje('');
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Toggle del checkbox “¿Es cotización?”
    if (name === 'esCotizacion' && type === 'checkbox') {
      setFormData(prev => ({ ...prev, tipoReserva: checked ? 'cotizacion' : 'evento' }));
      if (mensaje) setMensaje('');
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
    if (mensaje) setMensaje('');
  };

  const handleFechaCalendario = (fechaStr) => {
    setFormData(prev => ({ ...prev, fecha: fechaStr }));
    if (mensaje) setMensaje('');
  };

  // Lee el token del localStorage y extrae el role del payload (sin verificar firma)
function getSessionRole() {
  try {
    const t = localStorage.getItem('token');
    if (!t) return null;
    const [, payloadB64] = t.split('.');
    if (!payloadB64) return null;
    const json = JSON.parse(atob(payloadB64));
    // según cómo firmes el JWT, intenta en estas rutas:
    return json.role || json.rol || json?.user?.role || null;
  } catch {
    return null;
  }
}

// Deriva el "mode" para el dashboard en función del rol
function getDashboardModeFromRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'cotizador') return 'cotizador';
  return (r === 'admin' || r === 'asistente') ? 'admin' : 'user';
}

  const abrirEventoExistente = (evento) => {
    if (!evento?.id) return;
    const mode = getDashboardModeFromRole(getSessionRole());
    const params = new URLSearchParams({
      reservaId: String(evento.id),
      mode,
      tipo: evento.tipoReserva || 'evento'
    }).toString();
    window.open(`/cliente/dashboard?${params}`, '_blank', 'noopener,noreferrer');
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');

    // Validación previa (front): solo bloquea si el horario elegido se
    // traslapa con un evento ya existente ese día. El backend vuelve a
    // validar de todos modos (es la autoridad final).
    const chequeo = estadoFecha(formData.fecha, {
      horaInicio: formData.horaInicio,
      horaFin: formData.horaFin
    });
    if (chequeo?.ocupado) {
      const ev = chequeo.conflicto;
      await Swal.fire({
        icon: 'error',
        title: 'Horario ya ocupado',
        text: `Ya existe un evento (${ev?.tipoEvento || 'evento'} - ${ev?.cliente || 'cliente'}) en ese horario. Selecciona otro horario o fecha.`,
        confirmButtonColor: '#7b247f'
      });
      return;
    }

    setEnviando(true);

    const action = e.nativeEvent?.submitter?.dataset?.action || 'dashboard';
    const esEvento = !soloCotizacion && (formData.tipoReserva || 'evento') === 'evento';

    // Abre pre-ventana SOLO para EVENTO (para el dashboard)
    let prewin = null;
    if (action === 'dashboard') {
      prewin = window.open('about:blank', '_blank');
    }

    try {
      const payload = {
        cliente: formData.cliente.trim(),
        correo: (formData.correo || '').trim().toLowerCase(),
        tipoEvento: formData.tipoEvento.trim(),
        fecha: formData.fecha,                 // "YYYY-MM-DD"
        horaInicio: formData.horaInicio,       // "HH:mm"
        horaFin: formData.horaFin,             // "HH:mm"
        telefono: formData.telefono.trim(),
        cantidadPersonas: Number(formData.cantidadPersonas || 0),
        descripcion: formData.descripcion?.trim() || '',
        tipoReserva: soloCotizacion ? 'cotizacion' : formData.tipoReserva,
        notaCotizacion: (soloCotizacion || formData.tipoReserva === 'cotizacion')
          ? (formData.notaCotizacion || '').trim()
          : ''
      };

      const enviarReserva = (adminPassword, fechaOverride) => fetch(`${API_BASE_URL}/reservas`, {
        method: 'POST',
        // Con sesión iniciada se manda el token para que la cotización quede a nombre de quien la capturó.
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          ...payload,
          ...(fechaOverride ? { fecha: fechaOverride } : {}),
          ...(adminPassword ? { adminPassword } : {})
        })
      });

      let response = await enviarReserva();

      // Candado blando de 24h: ya existe una cotización reciente para esa
      // fecha. Se pide la contraseña de un administrador para forzar, o se
      // ofrece cambiar la fecha de ESTA reserva (la que se está creando) a
      // otro día, sin tocar la cotización existente de nadie más.
      if (response.status === 401) {
        const err = await response.json().catch(() => ({}));
        if (err.requierePassword) {
          // La pestaña en blanco solo tiene sentido si la reserva se va a
          // guardar de verdad — mientras se decide qué hacer no hay nada
          // que mostrar ahí, así que la cerramos.
          if (prewin) { prewin.close(); prewin = null; }

          const expiraEnMs = err.holdExpiraEn ? new Date(err.holdExpiraEn).getTime() : null;
          let intervalId = null;
          let nuevaFechaElegida = null;

          const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
          const parseYmd = (s) => {
            const [y, m, d] = String(s || '').split('-').map(Number);
            return (y && m && d) ? new Date(y, m - 1, d) : null;
          };
          const fmtYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const fmtBonito = (d) => `${d.getDate()} de ${MESES_ES[d.getMonth()]} de ${d.getFullYear()}`;

          const { value: adminPassword, isConfirmed } = await Swal.fire({
            icon: 'warning',
            title: 'Fecha reciente en cotización',
            width: 440,
            html: `
              <style>
                .nd-swal-msg { margin:0 0 10px; font-size:14px; line-height:1.5; color:#333; text-align:left; }
                .nd-swal-countdown { background:#fff4e5; border:1px solid #f3c98a; color:#a66a00; font-weight:700; font-size:13px; padding:8px 12px; border-radius:10px; text-align:left; margin-bottom:16px; }
                .nd-swal-section { background:#faf7fb; border:1px solid #ecdcf2; border-radius:12px; padding:14px; margin-bottom:12px; text-align:left; }
                .nd-swal-section-label { font-size:12px; font-weight:800; color:#5c1a5f; text-transform:uppercase; letter-spacing:.03em; margin-bottom:8px; display:flex; align-items:center; gap:6px; }
                .nd-swal-input { width:100%; box-sizing:border-box; padding:10px 12px; border-radius:9px; border:1px solid #d9c3e0; font-size:14px; background:#fff; font-family:inherit; }
                .nd-swal-input:focus { outline:none; border-color:#7b247f; box-shadow:0 0 0 3px rgba(123,36,127,.15); }
                .nd-swal-divider { display:flex; align-items:center; gap:10px; margin:14px 0; color:#b9a7c0; font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; }
                .nd-swal-divider::before, .nd-swal-divider::after { content:''; flex:1; height:1px; background:#e9dcee; }

                .nd-date-selected { width:100%; box-sizing:border-box; padding:9px 12px; border-radius:9px; border:1px solid #d9c3e0; background:#fff; font-size:13.5px; font-weight:700; color:#5c1a5f; margin-bottom:8px; }
                .nd-date-panel { background:#fff; border:1px solid #e4cdec; border-radius:12px; padding:10px; }
                .nd-date-panel-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; font-weight:700; font-size:13px; color:#5c1a5f; }
                .nd-date-panel-header button { border:none; background:#f3e8fb; color:#7b247f; width:26px; height:26px; border-radius:7px; cursor:pointer; font-size:15px; line-height:1; }
                .nd-date-panel-header button:hover { background:#e4cdec; }
                .nd-date-panel-weekdays { display:grid; grid-template-columns:repeat(7,1fr); text-align:center; font-size:10.5px; font-weight:700; color:#a991b0; margin-bottom:4px; }
                .nd-date-panel-days { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
                .nd-cal-day { aspect-ratio:1; border:none; background:transparent; border-radius:7px; font-size:12.5px; cursor:pointer; color:#333; }
                .nd-cal-day:hover:not(:disabled) { background:#f3e8fb; }
                .nd-cal-day-empty { visibility:hidden; cursor:default; }
                .nd-cal-day-hoy { font-weight:800; color:#7b247f; }
                .nd-cal-day-sel { background:#7b247f !important; color:#fff !important; font-weight:800; }
                .nd-cal-day-pasado { color:#ddd; cursor:not-allowed; }

                .nd-swal-btn-secondary { width:100%; margin-top:10px; padding:10px; border-radius:9px; border:none; background:#6b2c5e; color:#fff; font-weight:700; font-size:13.5px; cursor:pointer; }
                .nd-swal-btn-secondary:disabled { background:#d9c3e0; cursor:not-allowed; }
                .nd-swal-btn-secondary:not(:disabled):hover { filter:brightness(1.08); }
                .nd-swal-msg-small { font-size:11.5px; margin-top:6px; color:#c0392b; min-height:14px; }
              </style>

              <p class="nd-swal-msg">${err.msg || 'Ya existe una cotización reciente para esa fecha. Ingresa la contraseña de un administrador para continuar.'}</p>
              ${expiraEnMs ? `
                <div class="nd-swal-countdown">⏳ La fecha queda libre en: <span id="hold-countdown">calculando…</span></div>
              ` : ''}

              <div class="nd-swal-section">
                <div class="nd-swal-section-label">🔑 Forzar con contraseña de administrador</div>
                <input id="swal-admin-password" type="password" class="nd-swal-input" placeholder="Contraseña de administrador">
              </div>

              <div class="nd-swal-divider">o</div>

              <div class="nd-swal-section">
                <div class="nd-swal-section-label">📅 Cambia la fecha de esta reserva</div>
                <div class="nd-date-selected" id="nd-date-trigger-text">Elige una fecha…</div>
                <div class="nd-date-panel">
                  <div class="nd-date-panel-header">
                    <button type="button" id="nd-cal-prev">‹</button>
                    <span id="nd-cal-month-label"></span>
                    <button type="button" id="nd-cal-next">›</button>
                  </div>
                  <div class="nd-date-panel-weekdays">
                    <span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span>
                  </div>
                  <div class="nd-date-panel-days" id="nd-cal-days"></div>
                </div>
                <button type="button" id="swal-cambiar-fecha-btn" class="nd-swal-btn-secondary" disabled>Usar esta fecha</button>
                <div id="swal-cambiar-fecha-msg" class="nd-swal-msg-small"></div>
              </div>
            `,
            showCancelButton: true,
            confirmButtonColor: '#7b247f',
            confirmButtonText: 'Continuar con contraseña',
            cancelButtonText: 'Cerrar',
            focusConfirm: false,
            preConfirm: () => document.getElementById('swal-admin-password')?.value || '',
            didOpen: () => {
              document.getElementById('swal-admin-password')?.focus();

              if (expiraEnMs) {
                const el = document.getElementById('hold-countdown');
                if (el) {
                  const tick = () => {
                    const restante = expiraEnMs - Date.now();
                    if (restante <= 0) {
                      el.textContent = 'ya pasó la ventana de 24h — recarga e intenta de nuevo';
                      if (intervalId) clearInterval(intervalId);
                      return;
                    }
                    const h = Math.floor(restante / 3600000);
                    const m = Math.floor((restante % 3600000) / 60000);
                    const s = Math.floor((restante % 60000) / 1000);
                    el.textContent = `${h}h ${m}m ${s}s`;
                  };
                  tick();
                  intervalId = setInterval(tick, 1000);
                }
              }

              // ---- Mini calendario propio (reemplaza el <input type="date"> nativo) ----
              const fechaActual = parseYmd(payload.fecha) || new Date();
              const vista = { year: fechaActual.getFullYear(), month: fechaActual.getMonth() };
              let seleccionada = null;

              const panelDias = document.getElementById('nd-cal-days');
              const labelMes = document.getElementById('nd-cal-month-label');
              const triggerText = document.getElementById('nd-date-trigger-text');
              const btnUsar = document.getElementById('swal-cambiar-fecha-btn');
              const msgFecha = document.getElementById('swal-cambiar-fecha-msg');

              const renderCalendario = () => {
                if (!panelDias || !labelMes) return;
                const nombreMes = MESES_ES[vista.month];
                labelMes.textContent = `${nombreMes[0].toUpperCase()}${nombreMes.slice(1)} ${vista.year}`;

                const primerDia = new Date(vista.year, vista.month, 1);
                const offset = (primerDia.getDay() + 6) % 7; // semana empieza en lunes
                const diasEnMes = new Date(vista.year, vista.month + 1, 0).getDate();
                const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

                let html = '';
                for (let i = 0; i < offset; i++) html += '<span class="nd-cal-day nd-cal-day-empty"></span>';
                for (let d = 1; d <= diasEnMes; d++) {
                  const fechaCelda = new Date(vista.year, vista.month, d);
                  const clases = ['nd-cal-day'];
                  if (fechaCelda.getTime() === hoy.getTime()) clases.push('nd-cal-day-hoy');
                  if (seleccionada && fechaCelda.getTime() === seleccionada.getTime()) clases.push('nd-cal-day-sel');
                  const esPasado = fechaCelda < hoy;
                  if (esPasado) clases.push('nd-cal-day-pasado');
                  html += `<button type="button" class="${clases.join(' ')}" data-d="${d}" ${esPasado ? 'disabled' : ''}>${d}</button>`;
                }
                panelDias.innerHTML = html;

                panelDias.querySelectorAll('.nd-cal-day:not(.nd-cal-day-empty):not(:disabled)').forEach((btn) => {
                  btn.addEventListener('click', () => {
                    seleccionada = new Date(vista.year, vista.month, Number(btn.dataset.d));
                    renderCalendario();
                    if (triggerText) triggerText.textContent = fmtBonito(seleccionada);
                    if (btnUsar) btnUsar.disabled = false;
                    if (msgFecha) msgFecha.textContent = '';
                  });
                });
              };

              renderCalendario();

              document.getElementById('nd-cal-prev')?.addEventListener('click', () => {
                vista.month -= 1;
                if (vista.month < 0) { vista.month = 11; vista.year -= 1; }
                renderCalendario();
              });
              document.getElementById('nd-cal-next')?.addEventListener('click', () => {
                vista.month += 1;
                if (vista.month > 11) { vista.month = 0; vista.year += 1; }
                renderCalendario();
              });

              btnUsar?.addEventListener('click', () => {
                if (!seleccionada) return;
                const v = fmtYmd(seleccionada);
                if (v === payload.fecha) {
                  if (msgFecha) msgFecha.textContent = 'Elige una fecha distinta a la actual.';
                  return;
                }
                nuevaFechaElegida = v;
                Swal.close();
              });
            },
            willClose: () => {
              if (intervalId) clearInterval(intervalId);
            }
          });

          if (isConfirmed && adminPassword) {
            // Se vuelve a abrir justo al confirmar, pegada al clic (sigue
            // contando como gesto del usuario para que el navegador no la
            // bloquee como popup).
            if (action === 'dashboard') {
              prewin = window.open('about:blank', '_blank');
            }
            response = await enviarReserva(adminPassword);
          } else if (nuevaFechaElegida) {
            // Se eligió otra fecha para ESTA reserva — se reintenta con esa
            // fecha, sin contraseña, sin tocar la cotización existente.
            setFormData((prev) => ({ ...prev, fecha: nuevaFechaElegida }));
            if (action === 'dashboard') {
              prewin = window.open('about:blank', '_blank');
            }
            response = await enviarReserva(undefined, nuevaFechaElegida);
          } else {
            return;
          }
        }
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (prewin) prewin.close();

        if (response.status === 400 || response.status === 409) {
          await Swal.fire({
            icon: 'error',
            title: 'Horario ya ocupado',
            text: err.msg || 'Ya existe un evento en ese horario. Selecciona otro horario o fecha.',
            confirmButtonColor: '#7b247f'
          });
        } else if (response.status === 401 && err.requierePassword) {
          // Pasa cuando se eligió otra fecha pero ESA fecha también tiene
          // una cotización reciente — hay que intentar con otra.
          await Swal.fire({
            icon: 'warning',
            title: 'Esa fecha también está en conflicto',
            text: err.msg || 'Sigue habiendo una cotización reciente para esa fecha. Elige otra.',
            confirmButtonColor: '#7b247f'
          });
        } else if (response.status === 401) {
          await Swal.fire({
            icon: 'error',
            title: 'Contraseña incorrecta',
            text: err.msg || 'La contraseña de administrador no es correcta.',
            confirmButtonColor: '#7b247f'
          });
        } else {
          setMensaje(err.msg || 'No se pudo crear la reserva.');
        }
        return;
      }

      const data = await response.json();
      const reservaId = data?.id || data?.reserva?._id || data?._id;

      if (!reservaId) {
        console.warn('Respuesta sin ID de reserva:', data);
        setMensaje('Reserva creada, pero no se recibió el ID.');
        if (prewin) prewin.close();
        return;
      }

      // Limpiar formulario y borrador
      localStorage.removeItem(BORRADOR_KEY);
      setFormData(formInicial);
      setTieneBorrador(false);

// ── Ir al dashboard (evento o cotización) con modo por rol ───────────────
      if (action === 'dashboard') {
        const role = getSessionRole();
        const mode = getDashboardModeFromRole(role);
        const params = new URLSearchParams({
          reservaId: String(reservaId),
          mode,
          tipo: esEvento ? 'evento' : 'cotizacion'
        }).toString();
        const url = `/cliente/dashboard?${params}`;
        if (prewin && !prewin.closed) {
          prewin.location.replace(url);
          prewin.focus();
        } else {
          window.open(url, '_blank');
        }
        return;
      }

      // Si no se pidió dashboard, deja el mensaje informativo
      setMensaje(esEvento
        ? '✅ Evento creado correctamente.'
        : '✅ Cotización guardada correctamente.'
      );
      /*
      try {
        const r = await iniciarAccesoPorCorreo({
          correo: payload.correo,
          nombre: payload.cliente,
          telefono: payload.telefono,
        });
        console.log('auth/start =>', r);
        setMensaje('Te enviamos un código a tu correo para ingresar.');
      } catch (err) {
        console.error('auth/start error =>', err);
        setMensaje(err.message || 'No se pudo enviar el código. Puedes reintentar más tarde.');
      }
      navigate(`/ingresar-codigo?email=${encodeURIComponent(payload.correo)}&reservaId=${encodeURIComponent(reservaId)}`);
      */
      return;

    } catch (error) {
      console.error('Error al guardar:', error);
      setMensaje('❌ Error de conexión');
      if (prewin) prewin.close();
    } finally {
      setEnviando(false);
    }
  };

  const esCotizacion = soloCotizacion || formData.tipoReserva === 'cotizacion';

  return (
    <div className="reserva-form-container">
      <h2>{soloCotizacion ? 'Nueva cotización' : 'Reservar Evento'}</h2>

      {tieneBorrador && (
        <div style={{
          background: '#fff8e1',
          border: '1px solid #f0a500',
          borderRadius: 8,
          padding: '8px 14px',
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 13,
        }}>
          <span>📋 Tienes datos guardados de un formulario anterior.</span>
          <button
            type="button"
            onClick={limpiarBorrador}
            style={{
              background: 'none',
              border: 'none',
              color: '#c0392b',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Limpiar ✕
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Toggle cotización/evento */}
        {!soloCotizacion && (
        <label style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <input
            type="checkbox"
            name="esCotizacion"
            checked={esCotizacion}
            onChange={handleChange}
          />
          ¿Es cotización? <small style={{opacity:.7}}>
            {esCotizacion ? '(se guardará como Cotización)' : '(se guardará como Evento)'}
          </small>
        </label>
        )}

        {/* Nota solo para cotización */}
        {esCotizacion && (
          <textarea
            name="notaCotizacion"
            placeholder="Notas de la cotización (opcional)"
            value={formData.notaCotizacion}
            onChange={handleChange}
            style={{ width:'100%', marginBottom:12 }}
          />
        )}

        <input name="cliente" type="text" placeholder="Nombre del cliente " value={formData.cliente} onChange={handleChange} required />
        <input name="correo" type="email" placeholder="Correo electrónico" value={formData.correo} onChange={handleChange} required />
        <input name="tipoEvento" type="text" placeholder="Tipo de evento" value={formData.tipoEvento} onChange={handleChange} required />
        <input name="telefono" type="tel" placeholder="Número de teléfono" value={formData.telefono} onChange={handleChange} required />
        <input name="cantidadPersonas" type="number" min="1" placeholder="Cantidad de personas" value={formData.cantidadPersonas} onChange={handleChange} required />
        <div className="fecha-disponibilidad-wrapper">
          <div className="fecha-campo">
            <label className="fecha-campo-label">Fecha del evento</label>
            <input name="fecha" type="date" value={formData.fecha} onChange={handleChange} required />

            {formData.fecha && estadoFechaActual && (
              <>
                {horarioCompleto ? (
                  <div className={`fecha-estado-badge ${estadoFechaActual.ocupado ? 'ocupado' : 'disponible'}`}>
                    {estadoFechaActual.ocupado ? '🔴 Horario ocupado' : '🟢 Fecha y horario disponibles'}
                  </div>
                ) : (
                  estadoFechaActual.eventos.length > 0 && (
                    <div className="fecha-estado-badge neutral">
                      🟡 Ya hay {estadoFechaActual.eventos.length} evento(s) ese día — indica el horario para verificar
                    </div>
                  )
                )}

                {estadoFechaActual.eventos.length > 0 && (
                  <div className="eventos-dia-lista">
                    {estadoFechaActual.eventos.map((ev) => {
                      const enConflicto = horarioCompleto && estadoFechaActual.conflicto?.id === ev.id;
                      return (
                        <div key={ev.id} className={`evento-existente-card ${enConflicto ? 'conflicto' : ''}`}>
                          <strong>{ev.tipoEvento || 'Evento'}</strong>
                          <span>Cliente: {ev.cliente || 'N/D'}</span>
                          <span>Invitados: {ev.cantidadPersonas ?? 'N/D'}</span>
                          <span>Horario: {ev.horaInicio || '?'} – {ev.horaFin || '?'}</span>
                          {enConflicto && <span className="conflicto-tag">⛔ Se empalma con tu horario</span>}
                          <button
                            type="button"
                            className="evento-existente-btn"
                            onClick={() => abrirEventoExistente(ev)}
                          >
                            Ver evento
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {estadoFechaActual.cotizaciones.length > 0 && (
                  <div className="cotizaciones-dia-lista">
                    <small className="cotizaciones-dia-titulo">
                      💬 Cotizaciones ese día (solo referencia, no bloquean):
                    </small>
                    {estadoFechaActual.cotizaciones.map((c) => (
                      <div key={c.id} className="cotizacion-existente-card">
                        <span>{c.tipoEvento || 'Evento'} — {c.cliente || 'N/D'}</span>
                        <span className="cotizacion-hora">{c.horaInicio || '?'}–{c.horaFin || '?'}</span>
                        <ContadorHold expiraEn={c.holdExpiraEn} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="fecha-calendario">
            <MiniCalendarioDisponibilidad
              fecha={formData.fecha}
              onSeleccionarFecha={handleFechaCalendario}
              porFecha={porFecha}
              precargarDesde={precargarDesde}
            />
          </div>
        </div>
        <input name="horaInicio" type="time" value={formData.horaInicio} onChange={handleChange} required />
        <input name="horaFin" type="time" value={formData.horaFin} onChange={handleChange} required />
        <textarea name="descripcion" placeholder="Observaciones" value={formData.descripcion} onChange={handleChange} />

        <button type="submit" data-action="dashboard" disabled={enviando}>
          {enviando ? 'Guardando…' : (esCotizacion ? 'Guardar cotización' : 'Reservar')}
        </button>
      </form>

      {mensaje && <p>{mensaje}</p>}
    </div>
  );
};

export default ReservarEvento;
