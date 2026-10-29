import MostrarMas from './ui/MostrarMas';
import useMostrarMas from './ui/useMostrarMas';
import { aviso, pedirConfirmacion } from '../utils/avisos';
import TimeField from './ui/TimeField';
import DateField from './ui/DateField';
import SearchField from './ui/SearchField';
import React, { useState, useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { LuHeart, LuCake, LuGraduationCap, LuCrown, LuBriefcase, LuLaugh, LuMusic, LuPartyPopper, LuClock, LuUsers, LuPencil, LuTrash2, LuRepeat, LuCalendarDays, LuX, LuChevronLeft, LuChevronRight, LuCalendarX } from 'react-icons/lu';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './Calendario.css';
import API_BASE_URL, { authHeaders } from '../api';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useNavigate } from 'react-router-dom';

dayjs.extend(utc);
dayjs.extend(timezone);

const Calendario = () => {
  const navigate = useNavigate();

  const [date, setDate] = useState(new Date());
  const [eventos, setEventos] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [reservaEditando, setReservaEditando] = useState(null);
  const [activeStartDate, setActiveStartDate] = useState(null);
  const [searchEventos, setSearchEventos] = useState('');
  const [eventoRapido, setEventoRapido] = useState(null);
  const listaRef = useRef(null);

  const usuario = JSON.parse(localStorage.getItem('user') || '{}');
const role = usuario.role;

  const obtenerIcono = (tipo) => {
    switch ((tipo || '').toLowerCase()) {
      case 'boda': return <LuHeart />;
      case 'cumpleaños': return <LuCake />;
      case 'graduación': return <LuGraduationCap />;
      case 'xv': return <LuCrown />;
      case 'reunión': return <LuBriefcase />;
      case 'comedia': return <LuLaugh />;
      case 'musica': return <LuMusic />;
      default: return <LuPartyPopper />;
    }
  };

  // normaliza “06:33 p. m.” -> “18:33”, “06:33 a. m.” -> “06:33”
  const toHHmm = (h) => {
    if (!h) return '';
    const s = String(h).trim().toLowerCase();
    const m = s.match(/^(\d{1,2}):(\d{2})/);
    if (!m) return String(h); // ya vendrá “HH:mm” en la mayoría
    let hh = parseInt(m[1], 10);
    const mm = m[2];
    const isPM = /p\s*\.?\s*m\.?/i.test(s) || /\bpm\b/i.test(s);
    const isAM = /a\s*\.?\s*m\.?/i.test(s) || /\bam\b/i.test(s);
    if (isPM && hh < 12) hh += 12;
    if (isAM && hh === 12) hh = 0;
    return `${String(hh).padStart(2, '0')}:${mm}`;
  };

  const obtenerEventos = async () => {
    try {
      // Pide solo EVENTOS; si el backend no filtra, más abajo filtramos en front.
      const response = await fetch(`${API_BASE_URL}/reservas?tipo=evento`, { headers: authHeaders() });
      const data = await response.json();

      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      // Filtro robusto en front por si el backend ignora el query param
      const arr = Array.isArray(data) ? data : [];
      const soloEventos = arr.filter(r =>
        (r.tipoReserva ?? (r.esCotizacion ? 'cotizacion' : 'evento')) === 'evento'
      );

      const formateados = soloEventos
        .map((reserva) => {
          const ymd = reserva.fechaLocal || String(reserva.fecha).slice(0, 10);
          const hi = reserva.horaInicio || reserva.hora || reserva.horaEntrada || '';
          const hf = reserva.horaFin || reserva.horaSalida || reserva.hora || '';
          const fecha = new Date(`${ymd}T12:00:00`);
          const fechaComparar = new Date(fecha);
          fechaComparar.setHours(0, 0, 0, 0);
          return {
            id: reserva._id,
            titulo: `${reserva.tipoEvento} - ${reserva.cliente}`,
            ymd,
            fecha,
            horaInicio: toHHmm(hi),
            horaFin: toHHmm(hf || hi), // fallback si no había fin
            tipo: (reserva.tipoEvento || '').toLowerCase(),
            icon: obtenerIcono(reserva.tipoEvento),
            invitados: reserva.cantidadPersonas,
            cliente: reserva.cliente,
            tipoEvento: reserva.tipoEvento,
            tipoReserva: reserva.tipoReserva || 'evento',
            telefono: reserva.telefono || '',
            pasado: fechaComparar < hoy, // solo se usa para marcar el calendario en gris
          };
        });

      // Se guardan TODOS los eventos (pasados y futuros): los pasados solo
      // se usan para pintar el calendario en gris, no aparecen en el panel de lista.
      setEventos(formateados);
    } catch (error) {
      console.error('Error al cargar reservas:', error);
    }
  };

  useEffect(() => { obtenerEventos(); }, []);

  const manejarEliminar = async (id) => {
    if (await pedirConfirmacion('¿Estás seguro de eliminar esta reserva?')) {
      try {
        const response = await fetch(`${API_BASE_URL}/reservas/${id}`, { method: 'DELETE', headers: authHeaders() });
        if (response.ok) setEventos(prev => prev.filter(e => e.id !== id));
        else aviso('Error al eliminar la reserva.');
      } catch (error) {
        console.error('Error al eliminar:', error);
      }
    }
  };
const convertirACotizacion = async (id) => {
  const ok = await pedirConfirmacion('¿Convertir este evento a cotización?');
  if (!ok) return;
  try {
    const resp = await fetch(`${API_BASE_URL}/reservas/${id}/convertir-a-cotizacion`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      // body: JSON.stringify({ nota: 'Opcional: texto para la cotización' })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      aviso(err?.msg || 'No se pudo convertir a cotización.');
      return;
    }
    await obtenerEventos(); // ya no aparecerá en “eventos”
  } catch (e) {
    console.error(e);
    aviso('Error al convertir a cotización');
  }
};

  const manejarEditar = (evento) => {
    setReservaEditando({
      id: evento.id,
      cliente: evento.cliente,
      tipo: evento.tipoEvento || evento.tipo,
      fecha: new Date(`${evento.ymd}T12:00:00`),
      horaInicio: toHHmm(evento.horaInicio || evento.hora),
      horaFin: toHHmm(evento.horaFin || evento.hora),
      invitados: evento.invitados || evento.cantidadPersonas,
      telefono: evento.telefono || ''
    });
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setReservaEditando(null);
    setMostrarModal(false);
  };

  const handleEditarChange = (e) => {
    const { name, value } = e.target;
    setReservaEditando(prev => ({ ...prev, [name]: value }));
  };

  const rangoIgual = (hi, hf) => toHHmm(hi) === toHHmm(hf);

  const actualizarReserva = async (e) => {
    e.preventDefault();

    if (rangoIgual(reservaEditando.horaInicio, reservaEditando.horaFin)) {
      const seguir = await pedirConfirmacion('La hora de inicio y fin son iguales. ¿Deseas continuar?');
      if (!seguir) return;
    }

    try {
      const payload = {
        cliente: reservaEditando.cliente,
        tipoEvento: reservaEditando.tipo,
        fecha: dayjs(reservaEditando.fecha).format('YYYY-MM-DD'),
        horaInicio: toHHmm(reservaEditando.horaInicio),
        horaFin: toHHmm(reservaEditando.horaFin),
        cantidadPersonas: Number(reservaEditando.invitados || 0),
        // Se reenvía el teléfono real del cliente (si lo tenemos) para no
        // generar un "cambio" falso al comparar contra el valor guardado.
        ...(reservaEditando.telefono ? { telefono: reservaEditando.telefono } : {})
      };

      const response = await fetch(`${API_BASE_URL}/reservas/${reservaEditando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Refrescamos desde el servidor para mantener consistencia
        cerrarModal();
        await obtenerEventos();
      } else {
        const err = await response.json().catch(() => ({}));
        aviso(err.msg || 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error al actualizar:', error);
    }
  };


  const seleccionarFechaEvento = (ev) => {
  // ev.ymd viene como "YYYY-MM-DD"
  const d = new Date(`${ev.ymd}T12:00:00`); // noon para evitar TZ
  setDate(d); // ← selecciona la fecha (tile --active)

  // Mueve el calendario al mes correspondiente
  const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  setActiveStartDate(startOfMonth);
};


  const formatearFecha = (valor) => {
    if (!valor) return '';
    let d;
    if (valor instanceof Date) d = valor;
    else if (typeof valor === 'string') d = new Date((valor.length > 10 ? valor : `${valor}T12:00:00`));
    else if (typeof valor === 'number') d = new Date(valor);
    else return '';
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Solo los eventos futuros/hoy se listan en el panel "Próximos Eventos"
  const eventosFuturos = eventos.filter(evento => !evento.pasado);

  const getEventosDelDia = (fechaSeleccionada) =>
    eventos.filter(evento => evento.fecha.toDateString() === fechaSeleccionada.toDateString());

  const tieneFecha = ({ date, view }) => {
    if (view !== 'month') return null;
    const delDia = eventos.filter(evento => evento.fecha.toDateString() === date.toDateString());
    if (delDia.length === 0) return null;
    // Si al menos uno es futuro/hoy se marca normal; si todos son pasados, se marca en gris
    return delDia.some(evento => !evento.pasado) ? 'evento' : 'evento-pasado';
  };

  const eventosDelDia = getEventosDelDia(date);

  // Las tarjetas de eventos entran escalonadas cuando llegan los datos (solo visual).
  useEffect(() => {
    const lista = listaRef.current;
    if (!lista || eventos.length === 0) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    animate(lista.querySelectorAll('.evento-card'), { opacity: [0, 1], translateY: [14, 0], delay: stagger(60), duration: 500, ease: 'outCubic' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventos.length > 0]);

  const eventosFiltrados = eventosFuturos.filter((e) => {
  if (eventoRapido) return e.id === eventoRapido;
  if (!searchEventos.trim()) return true;
  const texto = `${e.titulo || ''} ${e.cliente || ''} ${formatearFecha(e.ymd)}`.toLowerCase();
  return texto.includes(searchEventos.toLowerCase());
});

  const seleccionarEventoRapido = (id) => {
    setEventoRapido(prev => prev === id ? null : id);
    setSearchEventos('');
  };

  // Botón para ir al Panel (DashboardCliente) con reservaId y modo admin
  const irAlPanelAdmin = () => {
    if (!reservaEditando?.id) return;
    const qs = new URLSearchParams({
      reservaId: reservaEditando.id,
      mode: 'admin'
    }).toString();
    // navigate(`/cliente/dashboard?${qs}`);
    window.open(`/cliente/dashboard?${qs}`, '_blank', 'noopener,noreferrer');
  };

  const mEv = useMostrarMas(eventosFiltrados); // en teléfono: de 5 en 5

  return (
    <div className="calendario-container">
      {/* Panel de Próximos Eventos */}
      <div className="eventos-panel">
        <div
  className="eventos-header"
  style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  }}
>
  <div>
    <h2>Próximos Eventos</h2>
    <span className="eventos-count">
      {eventosFiltrados.length} de {eventosFuturos.length} eventos
    </span>
    {eventoRapido && (
      <span
        style={{
          marginLeft: 8,
          background: '#f0a500',
          color: '#fff',
          borderRadius: 12,
          padding: '2px 10px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
        onClick={() => setEventoRapido(null)}
        title="Limpiar filtro rápido"
      >
        Filtro rápido <LuX />
      </span>
    )}
  </div>

  {!eventoRapido && (
  <SearchField
    value={searchEventos}
    onChange={setSearchEventos}
    placeholder="Buscar por cliente, fecha o tipo..."
    size="sm"
  />
  )}
</div>


        <div className="eventos-lista" ref={listaRef}>
  {eventosFiltrados.length === 0 ? (
    <div className="evento-card">
      <div className="evento-info">
        <h3 className="evento-titulo">Sin resultados</h3>
        <p className="evento-fecha">
          {eventosFuturos.length === 0
            ? 'Cuando registres eventos aparecerán aquí.'
            : 'No hay eventos que coincidan con ese criterio de búsqueda.'}
        </p>
      </div>
    </div>
  ) : (
    mEv.visibles.map((evento) => (
      <div
        key={evento.id}
        className={`evento-card evento-${evento.tipo}`}
        onClick={() => seleccionarFechaEvento(evento)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) =>
          (e.key === 'Enter' || e.key === ' ') && seleccionarFechaEvento(evento)
        }
      >
        <div className="evento-icon">{evento.icon}</div>
        <div className="evento-info">
          <h3 className="evento-titulo">{evento.titulo}</h3>
          <p className="evento-fecha">{formatearFecha(evento.ymd)}</p>
          <div className="evento-detalles">
            <span className="evento-hora">
              <LuClock /> {toHHmm(evento.horaInicio)} – {toHHmm(evento.horaFin)}
            </span>
            <span className="evento-invitados"><LuUsers /> {evento.invitados}</span>
          </div>
          <div className="evento-acciones">
            <button
              onClick={(e) => {
                e.stopPropagation();
                manejarEditar(evento);
              }}
            >
              <LuPencil /> Editar
            </button>
            {/* Solo administrador puede eliminar */}
{role !== 'asistente' && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      manejarEliminar(evento.id);
    }}
  >
    <LuTrash2 /> Eliminar
  </button>
)}
            {role === 'admin' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  convertirACotizacion(evento.id);
                }}
              >
                <LuRepeat /> A cotización
              </button>
            )}
          </div>
        </div>
      </div>
    ))
  )}
  <MostrarMas m={mEv} />
</div>


        {mostrarModal && reservaEditando && (
          <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrarModal(); }}>
            <div className="modal-content nd-modal">
              <h2>Editar Reserva</h2>
              <form onSubmit={actualizarReserva} className="nd-form">
                  <div className="nd-grid-2">
                    <label className="nd-field"><span>Cliente</span><input autoFocus type="text" name="cliente" placeholder="Nombre del cliente" value={reservaEditando.cliente} onChange={handleEditarChange} required /></label>
                    <label className="nd-field"><span>Tipo de evento</span><input type="text" name="tipo" placeholder="Tipo de evento" value={reservaEditando.tipo} onChange={handleEditarChange} required /></label>
                  </div>
                  <div className="nd-field"><span>Fecha</span><DateField
                  name="fecha"
                  value={dayjs(reservaEditando.fecha).format('YYYY-MM-DD')}
                  onChange={(v) => handleEditarChange({ target: { name: 'fecha', value: v } })}
                  required
                  clearable={false}
                  style={{ width: '100%' }}
                /></div>
                  <div className="nd-grid-2">
                    <div className="nd-field"><span>Hora de inicio</span><TimeField name="horaInicio" value={toHHmm(reservaEditando.horaInicio)} onChange={(v) => handleEditarChange({ target: { name: 'horaInicio', value: v } })} required clearable={false} style={{ width: '100%' }} /></div>
                    <div className="nd-field"><span>Hora de fin</span><TimeField name="horaFin" value={toHHmm(reservaEditando.horaFin)} onChange={(v) => handleEditarChange({ target: { name: 'horaFin', value: v } })} required clearable={false} style={{ width: '100%' }} /></div>
                  </div>
                  <label className="nd-field"><span>Invitados</span><input type="number" name="invitados" placeholder="Cantidad de personas" value={reservaEditando.invitados} onChange={handleEditarChange} required /></label>

                  <div className="nd-form-actions">
                    <button type="button" className="nd-btn nd-btn-ghost nd-btn-block" onClick={irAlPanelAdmin}>
                      Abrir panel de artículos (admin)
                    </button>
                    <div className="nd-form-actions-main">
                      <button type="button" className="nd-btn nd-btn-ghost" onClick={cerrarModal}>Cancelar</button>
                      <button type="submit" className="nd-btn nd-btn-primary">Guardar</button>
                    </div>
                  </div>
                </form>
            </div>
          </div>
        )}
      </div>

      {/* Panel del Calendario */}
      <div className="calendario-panel">
        <div className="calendario-header">
          <h2>Calendario de Eventos</h2>
          <p className="calendario-subtitle">Selecciona una fecha para ver los eventos programados</p>
        </div>

        <div className="calendario-wrapper">
          <Calendar
            onChange={setDate}
            value={date}
            tileClassName={tieneFecha}
            locale="es-ES"
            navigationLabel={({ date, view, label }) =>
              view === 'month'
                ? date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()
                : label
            }
            prev2Label={null}
            next2Label={null}
            prevLabel={<LuChevronLeft />}
            nextLabel={<LuChevronRight />}
            activeStartDate={activeStartDate || undefined}
            onActiveStartDateChange={({ activeStartDate }) => setActiveStartDate(activeStartDate)}
          />

        </div>

        <div className="fecha-seleccionada">
          <div className="fecha-info">
            <h3><LuCalendarDays /> {(() => { const f = String(formatearFecha(date)); return f.charAt(0).toUpperCase() + f.slice(1); })()}</h3>
            {eventosDelDia.length > 0 ? (
              <div className="eventos-dia">
                <h4>Eventos programados:</h4>
                {eventosDelDia.map((evento) => (
                  <div
                    key={evento.id}
                    className="evento-dia-item"
                    onClick={() => seleccionarEventoRapido(evento.id)}
                    title="Clic para acceso rápido"
                    style={{
                      cursor: 'pointer',
                      borderRadius: 8,
                      padding: '4px 8px',
                      background: eventoRapido === evento.id ? '#fff3cd' : 'transparent',
                      border: eventoRapido === evento.id ? '1.5px solid #f0a500' : '1.5px solid transparent',
                      transition: 'background 0.2s',
                    }}
                  >
                    <span className="evento-dia-icon">{evento.icon}</span>
                    <div className="evento-dia-info">
                      <strong>{evento.titulo}</strong>
                      <small>
                        {toHHmm(evento.horaInicio)} – {toHHmm(evento.horaFin)} · {evento.invitados} invitados
                      </small>
                      {eventoRapido === evento.id && (
                        <small style={{ display: 'block', color: '#f0a500', fontWeight: 600 }}>
                          ← ver en Próximos Eventos
                        </small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="sin-eventos"><LuCalendarX /> No hay eventos programados para esta fecha</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendario;
