import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {

    const navigate = useNavigate();

  return (
    <div className="home-container">
      <header className="home-header">
        <button className="home-button" onClick={() => navigate('/reservar')}>
            Reservar un Evento
        </button>
        <h1>Bienvenido a Salón de Eventos Nardeli</h1>
        <p>Donde tus momentos se vuelven inolvidables.</p>
      </header>

      <section className="home-section">
        <h2>Nuestros Servicios</h2>
        <ul>
          <li>Organización de eventos sociales y corporativos</li>
        </ul>
      </section>

      <section className="home-section">
        <h2>Contáctanos</h2>
        <p>📍 Ciudad Juárez, Chihuahua</p>
        <p>📞 (656) 123-4567</p>
        <p>✉️ contacto@nardeli.com</p>
      </section>
    </div>
  );
};

export default Home;
