import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import './Login.css';
import salon from '../assets/salon.jpg';
import API_BASE_URL from '../api';



const Login = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    password: ''
  });

  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const endpoint = isLogin 
        ? `${API_BASE_URL}/login` 
        : `${API_BASE_URL}/usuarios/registro`;

      const payload = isLogin 
        ? formData 
        : {
            name: formData.fullname,
            email: formData.email,
            password: formData.password
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('DATA COMPLETA:', data);
        console.log('Operación exitosa:', data);

        if (isLogin) {
          localStorage.setItem('token', data.token); // ✅ Guarda el token

          const userData = {
            fullname: data.user?.name || 'Usuario',
            email: data.user?.email,
            role: data.user?.role,
            id: data.user?.id
          };

          localStorage.setItem('user', JSON.stringify(userData));
          
          onLoginSuccess(userData);
        } else {
          // Modo registro: mostrar mensaje y volver a login
          alert('🎉 Usuario registrado correctamente');
          setIsLogin(true); // Cambia a vista de inicio de sesión
          setFormData({ fullname: '', email: '', password: '' }); // Limpia campos
        }
      }

    } catch (error) {
      console.error('Error:', error);
      setError('Error de conexión. Por favor intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

    useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      // Guardar token
      localStorage.setItem('token', token);

      // Decodificar para obtener el rol u otros datos
      const decoded = jwtDecode(token);
      console.log('Usuario autenticado:', decoded);

      // Redirigir según el rol (opcional)
      if (decoded.role === 'admin') {
        window.location.href = '/admin/dashboard';
      } else {
        window.location.href = '/dashboard';
      }
    }
  }, []);


  // ⬇️ Aquí seguiría tu return (...)
  return (
    <div className="login-container" style={{
      backgroundImage: `url(${salon})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      <div className="login-card">
        <div className="login-left">
          <div className='ilustration'>
          </div>
        </div>
        
        <div className="login-right">
          <div className="login-form-container">
            <h1 className="welcome-text">Bienvenido a</h1>
            <h2 className="brand-name">Nardeli</h2>
            <p className="tagline">salon de <span className="connected">eventos</span></p>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="login-form">
              <div className='form-toggle'>
                <button 
                  type="button" 
                  className={isLogin ? 'toggle-btn active' : 'toggle-btn'}
                  onClick={() => {
                    setIsLogin(true);
                    setError('');
                  }}
                >
                  Iniciar sesión
                </button>

                <button 
                  type="button" 
                  className={!isLogin ? 'toggle-btn active' : 'toggle-btn'}
                  onClick={() => {
                    setIsLogin(false);
                    setError('');
                  }}
                >
                  Registrarse
                </button>
              </div>

              {!isLogin && (
                <div className='form-group'>
                  <div className='input-container'>
                    <span className='input-icon'>📝</span>
                    <input
                      type="text"
                      name="fullname"
                      placeholder='Nombre Completo'
                      value={formData.fullname || ''}
                      onChange={handleChange}
                      className='form-input'
                      required
                    />
                  </div>
                </div>
              )} 

              <div className='form-group'>
                <div className='input-container'>
                  <span className='input-icon'>👤</span>
                  <input
                    type="email"
                    name="email"
                    placeholder='example@gmail.com'
                    value={formData.email}
                    onChange={handleChange}
                    className='form-input'
                    required
                  />
                </div>
              </div>

              <div className='form-group'>
                <div className='input-container'>
                  <span className='input-icon'>🔒</span>
                  <input
                    type="password"
                    name="password"
                    placeholder='Contraseña'
                    value={formData.password}
                    onChange={handleChange}
                    className='form-input'
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className={`login-button ${isLoading ? 'loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <p>O inicia sesión con</p>
              <a href="http://localhost:8010/api/auth/google" style={{ textDecoration: 'none' }}>
                <button
                  type="button"
                  style={{
                    backgroundColor: '#fff',
                    color: '#444',
                    border: '1px solid #ccc',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    margin: '0 auto',
                    cursor: 'pointer'
                  }}
                >
                  <img
                    src="https://developers.google.com/identity/images/g-logo.png"
                    alt="Google logo"
                    style={{ width: '20px', height: '20px' }}
                  />
                </button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


  
export default Login;