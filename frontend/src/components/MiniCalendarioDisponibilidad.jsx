import React, { useEffect, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './MiniCalendarioDisponibilidad.css';

const pad2 = (n) => String(n).padStart(2, '0');
const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function resumenTooltip(eventos, cotizaciones) {
  const partes = [];
  eventos.forEach((e) => {
    const horario = e.horaInicio || e.horaFin ? `${e.horaInicio || '?'}-${e.horaFin || '?'}` : 'sin horario';
    partes.push(`Evento: ${e.tipoEvento || 'N/D'} · ${e.cliente || 'N/D'} · ${horario}`);
  });
  cotizaciones.forEach((c) => {
    partes.push(`Cotización (ref.): ${c.cliente || 'N/D'} · ${c.tipoEvento || 'evento'}`);
  });
  return partes.join('\n');
}

/**
 * Mini calendario de disponibilidad para la pantalla "Reservar Evento".
 * Recibe el estado de disponibilidad (cacheado por mes) desde el padre
 * mediante useDisponibilidadReservas, para no duplicar peticiones/caché.
 *
 * Un día con evento se marca solo como referencia (no bloquea): el choque
 * real depende del horario elegido y se resuelve en el panel de estado.
 */
const MiniCalendarioDisponibilidad = ({
  fecha,
  onSeleccionarFecha,
  excluirId = null,
  porFecha,
  precargarDesde,
}) => {
  const [activeStartDate, setActiveStartDate] = useState(() => {
    const base = fecha ? new Date(`${fecha}T12:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    precargarDesde(activeStartDate.getFullYear(), activeStartDate.getMonth(), 2);
  }, [activeStartDate, precargarDesde]);

  // Si la fecha llega desde afuera (p. ej. el usuario la escribe en el input
  // nativo) y cae en otro mes, el calendario navega ahí en tiempo real.
  useEffect(() => {
    if (!fecha) return;
    const base = new Date(`${fecha}T12:00:00`);
    if (isNaN(base)) return;
    setActiveStartDate((prev) => (
      prev.getFullYear() === base.getFullYear() && prev.getMonth() === base.getMonth()
        ? prev
        : new Date(base.getFullYear(), base.getMonth(), 1)
    ));
  }, [fecha]);

  const valorSeleccionado = fecha ? new Date(`${fecha}T12:00:00`) : null;

  const handleChange = (d) => {
    onSeleccionarFecha(toYmd(d));
  };

  const itemsDelDia = (date) => (porFecha.get(toYmd(date)) || []).filter(
    (i) => !excluirId || String(i.id) !== String(excluirId)
  );

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return null;
    const items = itemsDelDia(date);
    if (items.some((i) => i.esEvento)) return 'mcd-tile-evento';
    if (items.length > 0) return 'mcd-tile-cotizacion';
    return 'mcd-tile-disponible';
  };

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const items = itemsDelDia(date);
    if (items.length === 0) return null;
    const eventos = items.filter((i) => i.esEvento);
    const cotizaciones = items.filter((i) => !i.esEvento);
    return (
      <span className="mcd-tile-overlay" title={resumenTooltip(eventos, cotizaciones)}>
        <span className="mcd-tile-dots">
          {eventos.length > 0 && <i className="mcd-mini-dot mcd-mini-dot-evento" />}
          {cotizaciones.length > 0 && <i className="mcd-mini-dot mcd-mini-dot-cotizacion" />}
        </span>
      </span>
    );
  };

  return (
    <div className="mcd-container">
      <div className="mcd-header">
        <span className="mcd-header-icon">📅</span>
        <span>Disponibilidad</span>
      </div>

      <Calendar
        onChange={handleChange}
        value={valorSeleccionado}
        tileClassName={tileClassName}
        tileContent={tileContent}
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
        activeStartDate={activeStartDate}
        onActiveStartDateChange={({ activeStartDate: d }) => setActiveStartDate(d)}
      />

      <div className="mcd-leyenda">
        <span className="mcd-leyenda-chip"><i className="mcd-dot mcd-dot-disponible" /> Disponible</span>
        <span className="mcd-leyenda-chip"><i className="mcd-dot mcd-dot-evento" /> Con evento</span>
        <span className="mcd-leyenda-chip"><i className="mcd-dot mcd-dot-cotizacion" /> Con cotización</span>
      </div>
    </div>
  );
};

export default MiniCalendarioDisponibilidad;
