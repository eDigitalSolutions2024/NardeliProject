import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './Calendario.css';

const Calendario = () => {
  const [date, setDate] = useState(new Date());
  
  // Datos de ejemplo para próximos eventos
  const [eventos] = useState([
    {
      id: 1,
      titulo: 'Cumpleaños María González',
      fecha: new Date(2025, 6, 10),
      hora: '18:00',
      tipo: 'cumpleanos',
      icon: '🎂',
      invitados: 50
    },
    {
      id: 2,
      titulo: 'Boda Carlos y Ana',
      fecha: new Date(2025, 6, 15),
      hora: '16:00',
      tipo: 'boda',
      icon: '💒',
      invitados: 120
    },
    {
      id: 3,
      titulo: 'Graduación Universidad',
      fecha: new Date(2025, 6, 20),
      hora: '10:00',
      tipo: 'graduacion',
      icon: '🎓',
      invitados: 200
    },
    {
      id: 4,
      titulo: 'Quinceañera Sofía',
      fecha: new Date(2025, 6, 25),
      hora: '19:00',
      tipo: 'quinceanera',
      icon: '👑',
      invitados: 80
    },
    {
      id: 5,
      titulo: 'Reunión Empresarial',
      fecha: new Date(2025, 6, 30),
      hora: '14:00',
      tipo: 'empresarial',
      icon: '💼',
      invitados: 30
    }
  ]);

  // Función para formatear fecha
  const formatearFecha = (fecha) => {
    return fecha.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Función para obtener eventos del día seleccionado
  const getEventosDelDia = (fechaSeleccionada) => {
    return eventos.filter(evento => 
      evento.fecha.toDateString() === fechaSeleccionada.toDateString()
    );
  };

  // Función para verificar si una fecha tiene eventos
  const tieneFecha = ({ date, view }) => {
    if (view === 'month') {
      return eventos.some(evento => 
        evento.fecha.toDateString() === date.toDateString()
      );
    }
    return false;
  };

  const eventosDelDia = getEventosDelDia(date);

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
                <p className="evento-fecha">
                  {formatearFecha(evento.fecha)}
                </p>
                <div className="evento-detalles">
                  <span className="evento-hora">⏰ {evento.hora}</span>
                  <span className="evento-invitados">👥 {evento.invitados}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Panel del Calendario */}
      <div className="calendario-panel">
        <div className="calendario-header">
          <h2>Calendario de Eventos</h2>
          <p className="calendario-subtitle">
            Selecciona una fecha para ver los eventos programados
          </p>
        </div>
        
        <div className="calendario-wrapper">
          <Calendar 
            onChange={setDate} 
            value={date}
            tileClassName={tieneFecha}
            locale="es-ES"
            navigationLabel={({ date, view, label }) => {
              if (view === 'month') {
                return date.toLocaleDateString('es-ES', { 
                  month: 'long', 
                  year: 'numeric' 
                }).toUpperCase();
              }
              return label;
            }}
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
                      <small>{evento.hora} - {evento.invitados} invitados</small>
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