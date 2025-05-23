import React, { useState } from 'react';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('http://localhost:8010/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Login exitoso:', data);
      } else {
        console.error('Error en login');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-left">
        </div>
        
        <div className="login-right">
          <div className="login-form-container">
            <h1 className="welcome-text">Bienvenido a</h1>
            <h2 className="brand-name">Honeywell</h2>
            <p className="tagline">THE POWER OF <span className="connected">CONNECTED</span></p>
            
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <div className="input-container">
                  <span className="input-icon">👤</span> 
                  <input
                    type="email"
                    name="email"
                    placeholder="eolivas@edigitalsolutions.com.mx"
                    value={formData.email}
                    onChange={handleChange}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <div className="input-container">
                  <span className="input-icon">🔒</span>
                  <input
                    type="password"
                    name="password"
                    placeholder="••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              
              <button type="submit" className="login-button">
                Ingresar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;