import React, { useState } from 'react';
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
        console.log('Operación exitosa:', data);

        const userData = {
          fullname: data.user?.name || 'Usuario',
          email: data.user?.email,
          ...data.user
        };

        onLoginSuccess(userData);
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Error en la operación');
      }
    } catch (error) {
      console.error('Error:', error);
      setError('Error de conexión. Por favor intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

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
          </div>
        </div>
      </div>
    </div>
  );
};


  
export default Login;