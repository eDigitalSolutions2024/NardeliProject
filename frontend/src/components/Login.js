import React, { useState } from 'react';
import './Login.css';
import salon from '../assets/salon.jpg';

const Login = () => {
  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    password: ''
  });

  const [isLogin, setIsLogin] = useState(true);

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
    <div className="login-container" style = {{
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
            <p className="tagline">salon de  <span className="connected">eventos</span></p>
            
            <form onSubmit={handleSubmit} className="login-form">
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
                      required/>
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
                    required/>
                </div>
              </div>

              <div className='form-group'>
                <div className='input-container'>
                  <span className='input-icon'>🔒</span>
                  <input
                    type="password"
                    name="password"
                    placeholder=''
                    value={formData.password}
                    onChange={handleChange}
                    className='form-input'
                    required
                    />
                </div>
              </div>

              <div className='form-toggle'>
                <button type="button" className={isLogin ? 'toggle-btn active' : 'toggle-btn'}
                  onClick={() => setIsLogin(true)}>Iniciar sesion</button>

                <button type="buttton" className={!isLogin ? 'toggle-btn active' : 'toggle-btn'}
                onClick={() => setIsLogin(false)}>Registrarse</button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;