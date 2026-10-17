// src/components/Login.jsx
import { aviso } from '../utils/avisos';
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { jwtDecode } from 'jwt-decode';
import { animate, stagger, splitText } from 'animejs';
import { LuUser, LuKeyRound, LuMail, LuLock, LuArrowRight, LuTriangleAlert } from 'react-icons/lu';
import PasswordInput from './PasswordInput';
import Sparkles from './Sparkles';
import OvalosFlotantes from './OvalosFlotantes';
import RedParticulas from './RedParticulas';
import ShinyText from './rb/ShinyText';
import StarBorder from './rb/StarBorder';
import Magnet from './rb/Magnet';
import SpotlightCard from './rb/SpotlightCard';
import './Login.css';
import salon from '../assets/salon.jpg';
import logoNardeli from '../assets/nardeli/logo_nardeli.png';
import API_BASE_URL from '../api';

const reducirMovimiento = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Entrada de la pantalla: la tarjeta sube, el logo "aparece" y flota, el saludo entra palabra por palabra
// y el resto del formulario va apareciendo escalonado.
function useLoginMotion(cardRef, logoRef, welcomeRef) {
  useLayoutEffect(() => {
    if (reducirMovimiento()) return undefined;
    const card = cardRef.current;
    const logo = logoRef.current;
    const welcome = welcomeRef.current;
    if (!card || !logo || !welcome) return undefined;

    const items = Array.from(card.querySelectorAll('[data-in]'));
    const iconos = card.querySelectorAll('.form-group[data-in] .input-icon');
    const lema = card.querySelector('.login-slogan');
    const split = splitText(welcome, { words: true });
    items.forEach((el) => { el.style.opacity = 0; });
    iconos.forEach((el) => { el.style.opacity = 0; });
    split.words.forEach((el) => { el.style.opacity = 0; });
    logo.style.opacity = 0;
    if (lema) lema.style.opacity = 0;

    const animaciones = [
      // la tarjeta "se abre" hacia el frente con un poco de perspectiva
      animate(card, {
        opacity: [0, 1],
        translateY: [60, 0],
        rotateX: [14, 0],
        scale: [0.9, 1],
        duration: 1100,
        ease: 'outExpo',
      }),
      animate(logo, { opacity: [0, 1], scale: [0.5, 1], rotate: [-8, 0], duration: 1300, delay: 300, ease: 'outBack' }),
      lema && animate(lema, {
        opacity: [0, 1],
        translateY: [16, 0],
        filter: ['blur(6px)', 'blur(0px)'],
        duration: 900,
        delay: 1000,
        ease: 'outCubic',
      }),
      animate(split.words, {
        opacity: [0, 1],
        translateY: ['0.7em', 0],
        filter: ['blur(8px)', 'blur(0px)'],
        duration: 800,
        delay: stagger(110, { start: 500 }),
        ease: 'outCubic',
      }),
      // cada elemento del formulario entra con su propio gesto: los campos deslizan desde la derecha,
      // el título crece desde pequeño y el resto sube
      ...items.map((el, i) => {
        const campo = el.classList.contains('form-group');
        const marca = el.classList.contains('brand-name');
        const delay = 800 + i * 120;
        const anim = animate(el, {
          opacity: [0, 1],
          translateX: [campo ? 56 : 0, 0],
          translateY: [campo || marca ? 0 : 22, 0],
          scale: [marca ? 0.7 : 1, 1],
          filter: ['blur(6px)', 'blur(0px)'],
          duration: campo ? 850 : 750,
          delay,
          ease: marca ? 'outBack' : 'outExpo',
          // suelta el filtro al terminar: un blur(0px) residual mantiene la capa activa para siempre
          onComplete: () => el.style.removeProperty('filter'),
        });
        return anim;
      }),
      // los íconos de los campos "saltan" cuando su campo termina de entrar
      animate(iconos, {
        opacity: [0, 1],
        scale: [0, 1],
        rotate: [-120, 0],
        duration: 700,
        delay: stagger(120, { start: 1350 }),
        ease: 'outBack',
        // al terminar se suelta el estilo en línea para que el hover/focus por CSS pueda mover el ícono
        onComplete: () => iconos.forEach((el) => {
          el.style.removeProperty('transform');
          el.style.removeProperty('opacity');
        }),
      }),
    ];

    return () => {
      animaciones.filter(Boolean).forEach((a) => a.pause());
      split.revert?.();
    };
  }, [cardRef, logoRef, welcomeRef]);
}

const Login = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    password: ''
  });

  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const cardRef = useRef(null);
  const logoRef = useRef(null);
  const welcomeRef = useRef(null);
  const errorRef = useRef(null);
  useLoginMotion(cardRef, logoRef, welcomeRef);

  // El mensaje de error entra con una pequeña sacudida
  useEffect(() => {
    if (!error || !errorRef.current || reducirMovimiento()) return;
    animate(errorRef.current, {
      translateX: [0, -10, 10, -7, 7, -3, 0],
      duration: 520,
      ease: 'outQuad',
    });
  }, [error]);

  // Parallax del panel izquierdo: guarda la posición del mouse (-1..1) para que óvalos y logo reaccionen
  const moverPanel = (e) => {
    if (e.pointerType === 'touch' || reducirMovimiento()) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    e.currentTarget.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  };
  const soltarPanel = (e) => {
    e.currentTarget.style.setProperty('--mx', 0);
    e.currentTarget.style.setProperty('--my', 0);
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // 👇 Aquí va /api/login (email+password)
      const endpoint = isLogin
        ? `${API_BASE_URL}/login`
        : `${API_BASE_URL}/usuarios/registro`;

      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : { name: formData.fullname, email: formData.email, password: formData.password, codigoInvitacion: formData.codigoInvitacion };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.success === undefined || data.success === true)) {
        if (isLogin) {
          localStorage.setItem('token', data.token || '');
          const userData = {
            fullname: data.user?.fullname || data.user?.name || 'Usuario',
            email: data.user?.email || formData.email,
            role: data.user?.role,
            id: data.user?.id || data.user?._id,
            mustChangePassword: !!data.user?.mustChangePassword,
            permisos: data.user?.permisos || {}
          };
          localStorage.setItem('user', JSON.stringify(userData));
          onLoginSuccess?.(userData);
        } else {
          aviso('🎉 Usuario registrado correctamente');
          setIsLogin(true);
          setFormData({ fullname: '', email: '', password: '' });
        }
      } else {
        // Mensajes más claros según status
        if (res.status === 404) setError('No encontrado');
        else if (res.status === 401) setError('Usuario o contraseña inválidos');
        else setError(data?.message || data?.msg || 'Ocurrió un error');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión. Por favor intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Callback de Google (token en querystring)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;

    try {
      localStorage.setItem('token', token);
      const decoded = jwtDecode(token);
      const userData = {
        fullname: decoded?.fullname || decoded?.name || 'Usuario',
        email: decoded?.email,
        role: decoded?.role,
        id: decoded?.id || decoded?._id
      };
      localStorage.setItem('user', JSON.stringify(userData));
      onLoginSuccess?.(userData);
    } catch (e) {
      console.warn('Token inválido:', e);
    } finally {
      const url = new URL(window.location.href);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url);
    }
  }, [onLoginSuccess]);

  return (
    <div className="login-container">
      {/* Fondo: foto del salón con zoom lento, luces de colores y destellos */}
      <div className="login-bg" style={{ backgroundImage: `url(${salon})` }} aria-hidden="true" />
      <div className="login-glow" aria-hidden="true" />
      <RedParticulas interactivo={false} />

      <div className="login-card-wrap" ref={cardRef}>
        <SpotlightCard
          theme="light"
          spotlightColor="#7b247f"
          intensity={0.22}
          spotlightSize={320}
          className="login-card"
        >
          <div className="login-left" onPointerMove={moverPanel} onPointerLeave={soltarPanel}>
            <OvalosFlotantes />
            <Sparkles count={10} />
            <div className="login-tilt">
              <div ref={logoRef} className="login-logo-wrap">
                <div className="login-float">
                  <img src={logoNardeli} alt="Nardeli, centro de eventos" className="login-logo" />
                  <div className="login-shine" style={{ '--logo-mask': `url(${logoNardeli})` }} aria-hidden="true"><span /></div>
                </div>
              </div>
            </div>
            <p className="login-slogan">
              <ShinyText text="Donde tus momentos se vuelven inolvidables." color="#f7e0a5" shineColor="#ffffff" speed={3.2} delay={5} />
            </p>
          </div>

          <div className="login-right">
            <div className="login-form-container">
              <h1 className="welcome-text" ref={welcomeRef}>Bienvenido a</h1>
              <h2 className="brand-name" data-in>
                <ShinyText text="Nardeli" color="#491656" shineColor="#d9a93f" speed={3.5} delay={6} shineWidth={50} />
              </h2>
              <p className="tagline" data-in>salon de <span className="connected">eventos</span></p>

              {error && (
                <div className="error-message" ref={errorRef} role="alert">
                  <LuTriangleAlert aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-toggle" data-in>
                  <button
                    type="button"
                    className={isLogin ? 'toggle-btn active' : 'toggle-btn'}
                    onClick={() => { setIsLogin(true); setError(''); }}
                  >
                    Iniciar sesión
                  </button>
                  {/*
                  <button
                    type="button"
                    className={!isLogin ? 'toggle-btn active' : 'toggle-btn'}
                    onClick={() => { setIsLogin(false); setError(''); }}
                  >
                    Registrarse
                  </button>
                  */}
                </div>

                {!isLogin && (
                  <div className="form-group">
                    <div className="input-container">
                      <span className="input-icon"><LuUser /></span>
                      <input
                        type="text"
                        name="fullname"
                        placeholder="Nombre Completo"
                        value={formData.fullname || ''}
                        onChange={handleChange}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>
                )}

                {!isLogin && (
                  <div className="form-group">
                    <div className="input-container">
                      <span className="input-icon"><LuKeyRound /></span>
                      <input
                        type="text"
                        name="codigoInvitacion"
                        placeholder="Código de invitación"
                        value={formData.codigoInvitacion || ''}
                        onChange={handleChange}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="form-group" data-in>
                  <div className="input-container">
                    <span className="input-icon"><LuMail /></span>
                    <input
                      type="email"
                      name="email"
                      placeholder="example@gmail.com"
                      value={formData.email}
                      onChange={handleChange}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div className="form-group" data-in>
                  <div className="input-container">
                    <span className="input-icon"><LuLock /></span>
                    <PasswordInput
                      name="password"
                      placeholder="Contraseña"
                      value={formData.password}
                      onChange={handleChange}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div className="login-submit" data-in>
                  <Magnet padding={40} magnetStrength={12} maxOffset={5} disabled={isLoading} style={{ display: 'block' }}>
                    <StarBorder
                      as="button"
                      type="submit"
                      className={`login-button ${isLoading ? 'loading' : ''}`}
                      color="#f7e0a5"
                      trailColor="#ffffff"
                      backgroundColor="#491656"
                      textColor="#ffffff"
                      borderColor="rgba(247, 224, 165, 0.35)"
                      radius={10}
                      thickness={1.5}
                      duration={6}
                      glow={0.35}
                      hover="brighten"
                      clickPulse={false}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <span className="login-spinner" aria-hidden="true" />
                          <span>Procesando...</span>
                        </>
                      ) : (
                        <>
                          <span>{isLogin ? 'Iniciar Sesión' : 'Registrarse'}</span>
                          <LuArrowRight className="login-button-arrow" aria-hidden="true" />
                        </>
                      )}
                    </StarBorder>
                  </Magnet>
                </div>
              </form>

              <div className="login-alt" data-in>
                <div className="login-divider"><span>O inicia sesión con</span></div>
                <a href={`${API_BASE_URL}/auth/google`} className="login-google" aria-label="Iniciar sesión con Google">
                  <img
                    src="https://developers.google.com/identity/images/g-logo.png"
                    alt="Google"
                    width="20"
                    height="20"
                  />
                </a>
              </div>
            </div>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
};

export default Login;
