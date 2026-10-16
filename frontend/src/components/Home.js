import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { animate, stagger, splitText } from 'animejs';
import { LuPartyPopper, LuBriefcase, LuMapPin, LuPhone, LuMail, LuArrowRight } from 'react-icons/lu';
import ShinyText from './rb/ShinyText';
import StarBorder from './rb/StarBorder';
import Magnet from './rb/Magnet';
import SpotlightCard from './rb/SpotlightCard';
import RedParticulas from './RedParticulas';
import Sparkles from './Sparkles';
import logoNardeli from '../assets/nardeli/logo_nardeli.png';
import './Home.css';

const reducirMovimiento = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;


// Cuando un bloque entra en pantalla, sus elementos [data-reveal] aparecen escalonados.
function useRevealOnScroll(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root || reducirMovimiento() || typeof IntersectionObserver === 'undefined') return undefined;

    const grupos = root.querySelectorAll('[data-reveal-group]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          animate(entry.target.querySelectorAll('[data-reveal]'), {
            opacity: [0, 1],
            translateY: [36, 0],
            scale: [0.96, 1],
            duration: 800,
            delay: stagger(120),
            ease: 'outCubic',
          });
        });
      },
      { threshold: 0.15 }
    );

    grupos.forEach((g) => {
      g.querySelectorAll('[data-reveal]').forEach((el) => { el.style.opacity = 0; });
      observer.observe(g);
    });
    return () => observer.disconnect();
  }, [ref]);
}

// Portada: el título aparece palabra por palabra, el resto escalonado y el logo flota.
function useHeroMotion(titleRef, logoRef, heroRef) {
  useEffect(() => {
    if (reducirMovimiento()) return undefined;
    const hero = heroRef.current;
    const title = titleRef.current;
    const logo = logoRef.current;
    if (!hero || !title || !logo) return undefined;

    const split = splitText(title, { words: true });
    const resto = hero.querySelectorAll('.home-hero-content > *:not(.home-title):not(.home-logo)');
    resto.forEach((el) => { el.style.opacity = 0; });

    animate(logo, { opacity: [0, 1], scale: [0.7, 1], duration: 1100, ease: 'outBack' });
    animate(split.words, {
      opacity: [0, 1],
      translateY: ['0.7em', 0],
      filter: ['blur(10px)', 'blur(0px)'],
      duration: 900,
      delay: stagger(110, { start: 500 }),
      ease: 'outCubic',
    });
    animate(resto, {
      opacity: [0, 1],
      translateY: [24, 0],
      duration: 800,
      delay: stagger(160, { start: 1300 }),
      ease: 'outCubic',
    });
    // el logo flota suavemente de forma continua
    const flota = animate(logo, {
      translateY: [0, -12],
      duration: 3200,
      delay: 1400,
      loop: true,
      alternate: true,
      ease: 'inOutSine',
    });

    return () => {
      flota.pause();
      split.revert?.();
    };
  }, [titleRef, logoRef, heroRef]);
}

// Títulos de sección: las letras suben una a una (con un pequeño giro) cuando el título entra en pantalla.
function useHeadingLetters(ref) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || reducirMovimiento() || typeof IntersectionObserver === 'undefined') return undefined;

    const titulos = Array.from(root.querySelectorAll('.home-heading'));
    const items = titulos.map((t) => {
      const split = splitText(t, { words: true, chars: true });
      split.chars.forEach((c) => { c.style.opacity = 0; });
      return { t, split };
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          const { split } = items.find((i) => i.t === entry.target);
          animate(split.chars, {
            opacity: [0, 1],
            translateY: ['0.9em', 0],
            rotate: [8, 0],
            filter: ['blur(6px)', 'blur(0px)'],
            duration: 700,
            delay: stagger(40),
            ease: 'outBack',
            // al terminar se suelta el estilo en línea para que el hover por CSS funcione
            onComplete: () => split.chars.forEach((c) => {
              c.style.removeProperty('opacity');
              c.style.removeProperty('transform');
              c.style.removeProperty('filter');
            }),
          });
        });
      },
      { threshold: 0.6 }
    );
    titulos.forEach((t) => observer.observe(t));

    return () => {
      observer.disconnect();
      items.forEach(({ split }) => split.revert?.());
    };
  }, [ref]);
}

// Paleta morada para la red de fondo de las secciones claras
const COLORES_MORADOS = [
  [123, 36, 127],
  [73, 22, 86],
  [165, 142, 191],
  [201, 150, 214],
];

const Home = () => {
  const navigate = useNavigate();
  const pageRef = useRef(null);
  const heroRef = useRef(null);
  const titleRef = useRef(null);
  const logoRef = useRef(null);
  useRevealOnScroll(pageRef);
  useHeadingLetters(pageRef);
  useHeroMotion(titleRef, logoRef, heroRef);

  return (
    <div className="home-container" ref={pageRef}>
      {/* ===== Portada ===== */}
      <header className="home-hero" ref={heroRef}>
        <div className="home-hero-glow" aria-hidden="true" />
        <Sparkles count={32} />

        <div className="home-hero-content">
          <img ref={logoRef} src={logoNardeli} alt="Nardeli, centro de eventos" className="home-logo" />

          <h1 ref={titleRef} className="home-title">Bienvenido a Salón de Eventos Nardeli</h1>

          <p className="home-subtitle">
            <ShinyText text="Donde tus momentos se vuelven inolvidables." color="#f7e0a5" shineColor="#ffffff" speed={3.2} delay={4} />
          </p>

          <div className="home-cta-wrap">
            <Magnet padding={50} magnetStrength={10} maxOffset={6}>
              <StarBorder
                as="button"
                className="home-cta"
                color="#f7e0a5"
                trailColor="#ffffff"
                backgroundColor="#491656"
                textColor="#ffffff"
                borderColor="rgba(247, 224, 165, 0.35)"
                radius={40}
                thickness={1.5}
                duration={6}
                glow={0.4}
                hover="brighten"
                clickPulse={false}
                onClick={() => navigate('/Login')}
              >
                <span>Reservar un Evento</span>
                <LuArrowRight className="home-cta-arrow" aria-hidden="true" />
              </StarBorder>
            </Magnet>
          </div>
        </div>
      </header>

      <div className="home-lower">
      <div className="home-lower-glow" aria-hidden="true" />
      <RedParticulas interactivo={false} colores={COLORES_MORADOS} distancia={170} distanciaMouse={200} intensidad={0.75} maximo={55} />
      <main className="home-main">
        {/* ===== Servicios ===== */}
        <section className="home-block" data-reveal-group>
          <h2 className="home-heading">Nuestros Servicios</h2>
          <p className="home-lead" data-reveal>
            <ShinyText text="Organización de eventos sociales y corporativos" color="#6b2c5e" shineColor="#d9a93f" speed={3} delay={2} />
          </p>

          <div className="home-grid home-grid-2">
            <div data-reveal>
              <SpotlightCard theme="light" spotlightColor="#7b247f" className="home-card">
                <span className="home-card-icon"><LuPartyPopper /></span>
                <h3><ShinyText text="Eventos sociales" color="#491656" shineColor="#d9a93f" trigger="hover" speed={1.1} /></h3>
              </SpotlightCard>
            </div>
            <div data-reveal>
              <SpotlightCard theme="light" spotlightColor="#7b247f" className="home-card">
                <span className="home-card-icon"><LuBriefcase /></span>
                <h3><ShinyText text="Eventos corporativos" color="#491656" shineColor="#d9a93f" trigger="hover" speed={1.1} /></h3>
              </SpotlightCard>
            </div>
          </div>
        </section>

        {/* ===== Contacto ===== */}
        <section className="home-block" data-reveal-group>
          <h2 className="home-heading">Contáctanos</h2>

          <div className="home-grid home-grid-3">
            <div data-reveal>
              <SpotlightCard theme="light" spotlightColor="#7b247f" className="home-card home-card-contact">
                <span className="home-card-icon"><LuMapPin /></span>
                <p>Ciudad Juárez, Chihuahua</p>
              </SpotlightCard>
            </div>
            <div data-reveal>
              <SpotlightCard theme="light" spotlightColor="#7b247f" className="home-card home-card-contact">
                <span className="home-card-icon"><LuPhone /></span>
                <p><a href="tel:+526561234567">(656) 123-4567</a></p>
              </SpotlightCard>
            </div>
            <div data-reveal>
              <SpotlightCard theme="light" spotlightColor="#7b247f" className="home-card home-card-contact">
                <span className="home-card-icon"><LuMail /></span>
                <p><a href="mailto:contacto@nardeli.com">contacto@nardeli.com</a></p>
              </SpotlightCard>
            </div>
          </div>
        </section>
      </main>
      </div>

      <footer className="home-footer">
        © {new Date().getFullYear()} Salón de Eventos Nardeli · Ciudad Juárez, Chihuahua
      </footer>
    </div>
  );
};

export default Home;
