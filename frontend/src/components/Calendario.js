import React, { useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './Calendario.css';

const Calendario = () => {
  const [date, setDate] = useState(new Date());

  return (
    <div className="calendario-container">
      <h2><center>Calendario de Eventos</center></h2>
      <Calendar onChange={setDate} value={date} />
      <p className="fecha-seleccionada">
        Fecha seleccionada: {date.toLocaleDateString()}
      </p>
    </div>
  );
};

export default Calendario;
