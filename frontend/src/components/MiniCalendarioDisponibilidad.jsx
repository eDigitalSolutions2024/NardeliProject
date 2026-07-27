import React, { useEffect, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './MiniCalendarioDisponibilidad.css';

const pad2 = (n) => String(n).padStart(2, '0');
const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function resumenTooltip(items) {
  const evento = items.find((i) => i.ocupaFecha);
  if (evento) {
    const horario = evento.horaInicio || evento.horaFin
      ? `${evento.horaInicio || '?'} - ${evento.horaFin || '?'}`
      : 'Horario N/D';
    const invitados = evento.cantidadPersonas != null ? `${evento.cantidadPersonas} invitados` : '';
    return [
      `Evento: ${evento.tipoEvento || 'N/D'}`,
      `Cliente: ${evento.cliente || 'N/D'}`,
      horario,
      invitados,
    ].filter(Boolean).join(' · ');
  }
  return items
    .map((c) => `Cotización: ${c.cliente || 'N/D'} (${c.tipoEvento || 'evento'})`)
    .join(' | ');
}

/**
 * Mini calendario de disponibilidad para la pantalla "Reservar Evento".
 * Recibe el estado de disponibilidad (cacheado por mes) desde el padre
 * mediante useDisponibilidadReservas, para no duplicar peticiones/caché.
 */
const MiniCalendarioDisponibilidad = ({
  fecha,
  onSeleccionarFecha,
  excluirId = null,
  porFecha,
  estadoFecha,
  precargarDesde,
}) => {
  const [activeStartDate, setActiveStartDate] = useState(() => {
    const base = fecha ? new Date(`${fecha}T12:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    precargarDesde(activeStartDate.getFullYear(), activeStartDate.getMonth(), 2);
  }, [activeStartDate, precargarDesde]);

  const valorSeleccionado = fecha ? new Date(`${fecha}T12:00:00`) : null;

  const handleChange = (d) => {
    onSeleccionarFecha(toYmd(d));
  };

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return null;
    const { ocupado, cotizaciones } = estadoFecha(toYmd(date), excluirId);
    if (ocupado) return 'mcd-tile-ocupado';
    if (cotizaciones.length > 0) return 'mcd-tile-cotizacion';
    return 'mcd-tile-disponible';
  };

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const items = (porFecha.get(toYmd(date)) || []).filter(
      (i) => !excluirId || String(i.id) !== String(excluirId)
    );
    if (items.length === 0) return null;
    return <span className="mcd-tile-overlay" title={resumenTooltip(items)} />;
  };

  return (
    <div className="mcd-container">
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
        <span><i className="mcd-dot mcd-dot-disponible" /> Disponible</span>
        <span><i className="mcd-dot mcd-dot-cotizacion" /> Con cotización</span>
        <span><i className="mcd-dot mcd-dot-ocupado" /> Ocupado</span>
      </div>
    </div>
  );
};

export default MiniCalendarioDisponibilidad;
