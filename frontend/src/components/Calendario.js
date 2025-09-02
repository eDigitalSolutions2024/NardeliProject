import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './Calendario.css';
import API_BASE_URL from '../api';
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

  const obtenerIcono = (tipo) => {
    switch ((tipo || '').toLowerCase()) {
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
      const response = await fetch(`${API_BASE_URL}/reservas?tipo=evento`);
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
          return {
            id: reserva._id,
            titulo: `${reserva.tipoEvento} - ${reserva.cliente}`,
            ymd,
            fecha: new Date(`${ymd}T12:00:00`),
            horaInicio: toHHmm(hi),
            horaFin: toHHmm(hf || hi), // fallback si no había fin
            tipo: (reserva.tipoEvento || '').toLowerCase(),
            icon: obtenerIcono(reserva.tipoEvento),
            invitados: reserva.cantidadPersonas,
            cliente: reserva.cliente,
            tipoEvento: reserva.tipoEvento,
            tipoReserva: reserva.tipoReserva || 'evento',
          };
        })
        .filter(evento => {
          const fechaEvento = new Date(evento.fecha);
          fechaEvento.setHours(0, 0, 0, 0);
          return fechaEvento >= hoy; // solo próximos
        });

      setEventos(formateados);
    } catch (error) {
      console.error('Error al cargar reservas:', error);
    }
  };

  useEffect(() => { obtenerEventos(); }, []);

  const manejarEliminar = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar esta reserva?')) {
      try {
        const response = await fetch(`${API_BASE_URL}/reservas/${id}`, { method: 'DELETE' });
        if (response.ok) setEventos(prev => prev.filter(e => e.id !== id));
        else alert('Error al eliminar la reserva.');
      } catch (error) {
        console.error('Error al eliminar:', error);
      }
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
      invitados: evento.invitados || evento.cantidadPersonas
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
      const seguir = window.confirm('La hora de inicio y fin son iguales. ¿Deseas continuar?');
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
        telefono: "N/A"
      };

      const response = await fetch(`${API_BASE_URL}/reservas/${reservaEditando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Refrescamos desde el servidor para mantener consistencia
        cerrarModal();
        await obtenerEventos();
      } else {
        alert('Error al actualizar');
      }
    } catch (error) {
      console.error('Error al actualizar:', error);
    }
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

  const getEventosDelDia = (fechaSeleccionada) =>
    eventos.filter(evento => evento.fecha.toDateString() === fechaSeleccionada.toDateString());

  const tieneFecha = ({ date, view }) =>
    view === 'month' && eventos.some(evento => evento.fecha.toDateString() === date.toDateString()) ? 'evento' : null;

  const eventosDelDia = getEventosDelDia(date);

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

  return (
    <div className="calendario-container">
      {/* Panel de Próximos Eventos */}
      <div className="eventos-panel">
        <div className="eventos-header">
          <h2>Próximos Eventos</h2>
          <span className="eventos-count">{eventos.length} eventos</span>
        </div>

        <div className="eventos-lista">
          {eventos.map((evento) => (
            <div key={evento.id} className={`evento-card evento-${evento.tipo}`}>
              <div className="evento-icon">{evento.icon}</div>
              <div className="evento-info">
                <h3 className="evento-titulo">{evento.titulo}</h3>
                <p className="evento-fecha">{formatearFecha(evento.ymd)}</p>
                <div className="evento-detalles">
                  <span className="evento-hora">⏰ {toHHmm(evento.horaInicio)} – {toHHmm(evento.horaFin)}</span>
                  <span className="evento-invitados">👥 {evento.invitados}</span>
                </div>
                <div className="evento-acciones">
                  <button onClick={() => manejarEditar(evento)}>✏️ Editar</button>
                  <button onClick={() => manejarEliminar(evento.id)}>🗑️ Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {mostrarModal && reservaEditando && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Editar Reserva</h2>
              <form onSubmit={actualizarReserva}>
                <input
                  type="text"
                  name="cliente"
                  placeholder="Nombre del cliente"
                  value={reservaEditando.cliente}
                  onChange={handleEditarChange}
                  required
                />
                <input
                  type="text"
                  name="tipo"
                  placeholder="Tipo de evento"
                  value={reservaEditando.tipo}
                  onChange={handleEditarChange}
                  required
                />
                <input
                  type="date"
                  name="fecha"
                  value={dayjs(reservaEditando.fecha).format('YYYY-MM-DD')}
                  onChange={handleEditarChange}
                  required
                />

                {/* Horas separadas */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Hora inicio</label>
                    <input
                      type="time"
                      name="horaInicio"
                      value={toHHmm(reservaEditando.horaInicio)}
                      onChange={handleEditarChange}
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Hora fin</label>
                    <input
                      type="time"
                      name="horaFin"
                      value={toHHmm(reservaEditando.horaFin)}
                      onChange={handleEditarChange}
                      required
                    />
                  </div>
                </div>

                <input
                  type="number"
                  name="invitados"
                  placeholder="Cantidad de personas"
                  value={reservaEditando.invitados}
                  onChange={handleEditarChange}
                  required
                />

                <div className="modal-actions" style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
                  <button type="button" className="btn btn-outline-secondary" onClick={irAlPanelAdmin}>
                    Abrir panel de artículos (admin)
                  </button>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="submit">Guardar</button>
                    <button type="button" onClick={cerrarModal}>Cancelar</button>
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
            prevLabel="‹"
            nextLabel="›"
          />
        </div>

        <div className="fecha-seleccionada">
          <div className="fecha-info">
            <h3>📅 {formatearFecha(date)}</h3>
            {eventosDelDia.length > 0 ? (
              <div className="eventos-dia">
                <h4>Eventos programados:</h4>
                {eventosDelDia.map((evento) => (
                  <div key={evento.id} className="evento-dia-item">
                    <span className="evento-dia-icon">{evento.icon}</span>
                    <div className="evento-dia-info">
                      <strong>{evento.titulo}</strong>
                      <small>
                        {toHHmm(evento.horaInicio)} – {toHHmm(evento.horaFin)} · {evento.invitados} invitados
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="sin-eventos">No hay eventos programados para esta fecha</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendario;
