import React, { useEffect, useRef } from 'react';
import './RedParticulas.css';

const COLORES_DORADOS = [
  [247, 224, 165], // dorado claro
  [217, 180, 90],  // dorado
  [201, 179, 230], // lila
  [255, 255, 255], // blanco
];

const INTERVALO = 1000 / 30; // 30 cuadros por segundo: el movimiento es lento y así gasta la mitad de CPU
const CUBOS_ALFA = 4;        // las líneas se agrupan por color y 4 niveles de opacidad para dibujarlas en bloque

// Red de óvalos conectados por líneas (estilo particles.js), dibujada en canvas sin librerías.
//  · Los óvalos derivan, se unen con líneas cuando están cerca y brillan.
//  · Al mover el mouse: se enganchan al cursor con líneas ("grab") y huyen de él ("repulse").
//  · Al hacer clic en el fondo: nacen óvalos nuevos que salen disparados ("push").
// Rendimiento: 30 fps, sin sombras por óvalo (el brillo es un sprite precalculado), líneas dibujadas por lotes
// y el bucle se detiene cuando el canvas no se ve (otra pestaña o fuera de pantalla).
export default function RedParticulas({
  colores = COLORES_DORADOS,   // paleta [r, g, b] de óvalos y líneas
  distancia = 175,             // a qué distancia se conectan dos óvalos
  distanciaMouse = 210,        // a qué distancia se enganchan al cursor
  radioRepulsion = 140,        // radio en el que el cursor empuja a los óvalos
  fuerzaRepulsion = 1,         // 0 = no huyen del cursor
  densidad = 16000,            // px² por óvalo (menor número = más óvalos)
  maximo = 70,                 // tope de óvalos al cargar
  intensidad = 1,              // multiplica la opacidad de las líneas
  interactivo = true,          // false = ignora el mouse por completo (sin listeners ni cálculos de cursor)
  clickAgrega = true,          // clic en el fondo agrega óvalos
  ignorarClick = 'a, button, input, textarea, select, label, .login-card-wrap, .home-card',
  className = '',
}) {
  const canvasRef = useRef(null);
  // las props viven en una ref para que el canvas no se reinicie si cambian
  const opcRef = useRef({});
  opcRef.current = { colores, distancia, distanciaMouse, radioRepulsion, fuerzaRepulsion, intensidad, clickAgrega, ignorarClick };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;

    const reducir = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const mouse = { x: -9999, y: -9999, activo: false };
    let nodos = [];
    let ancho = 0;
    let alto = 0;
    let raf = 0;
    let visibleTab = !document.hidden;
    let enPantalla = true;
    let ultimo = performance.now();
    let ultimoDibujo = 0;

    // brillo precalculado por color: un degradado radial en un canvas pequeño que luego se estampa
    const brillos = new Map();
    const brilloDe = (c) => {
      const key = c.join(',');
      let s = brillos.get(key);
      if (!s) {
        s = document.createElement('canvas');
        s.width = 48;
        s.height = 48;
        const g = s.getContext('2d');
        const grad = g.createRadialGradient(24, 24, 0, 24, 24, 24);
        grad.addColorStop(0, `rgba(${key}, 0.75)`);
        grad.addColorStop(0.35, `rgba(${key}, 0.25)`);
        grad.addColorStop(1, `rgba(${key}, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, 48, 48);
        brillos.set(key, s);
      }
      return s;
    };

    const nuevo = (x, y, extra) => {
      const paleta = opcRef.current.colores;
      const grande = Math.random() < 0.22;
      const r = grande ? 5 + Math.random() * 4 : 2.2 + Math.random() * 2.2;
      const ang = Math.random() * Math.PI * 2;
      const vel = 0.25 + Math.random() * 0.45;
      const ci = Math.floor(Math.random() * paleta.length);
      return {
        x, y,
        vx: Math.cos(ang) * vel,   // velocidad propia (constante)
        vy: Math.sin(ang) * vel,
        ex: extra ? Math.cos(ang) * 5 : 0, // impulso extra (empujones y clics) que se va apagando
        ey: extra ? Math.sin(ang) * 5 : 0,
        rx: r * 1.5,
        ry: r,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.004,
        fase: Math.random() * Math.PI * 2,
        ci,
        color: paleta[ci],
        grande,
      };
    };

    const crear = () => {
      // equipos modestos (4 núcleos o menos): la mitad de óvalos
      const modesto = (navigator.hardwareConcurrency || 8) <= 4;
      const tope = modesto ? Math.ceil(maximo / 2) : maximo;
      const cantidad = Math.min(tope, Math.max(18, Math.round((ancho * alto) / densidad)));
      nodos = Array.from({ length: cantidad }, () => nuevo(Math.random() * ancho, Math.random() * alto, false));
    };

    const medir = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      ancho = canvas.clientWidth;
      alto = canvas.clientHeight;
      if (!ancho || !alto) return;
      canvas.width = Math.round(ancho * dpr);
      canvas.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      crear();
      if (reducir) dibujar(0);
    };

    function dibujar(t) {
      const o = opcRef.current;
      const dist2 = o.distancia * o.distancia;
      ctx.clearRect(0, 0, ancho, alto);

      // líneas entre óvalos cercanos, agrupadas en lotes (color × opacidad) para hacer pocos trazos
      const lotes = new Map();
      for (let i = 0; i < nodos.length; i++) {
        const a = nodos[i];
        for (let j = i + 1; j < nodos.length; j++) {
          const b = nodos[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > dist2) continue;
          const cercania = 1 - Math.sqrt(d2) / o.distancia; // 0..1
          const nivel = Math.min(CUBOS_ALFA - 1, Math.floor(cercania * CUBOS_ALFA));
          const key = a.ci * CUBOS_ALFA + nivel;
          let lote = lotes.get(key);
          if (!lote) { lote = { color: a.color, nivel, seg: [] }; lotes.set(key, lote); }
          lote.seg.push(a.x, a.y, b.x, b.y);
        }
      }
      ctx.lineWidth = 1.3;
      lotes.forEach((lote) => {
        const alfa = Math.min(1, ((lote.nivel + 0.5) / CUBOS_ALFA) * 0.8 * o.intensidad);
        ctx.strokeStyle = `rgba(${lote.color[0]}, ${lote.color[1]}, ${lote.color[2]}, ${alfa.toFixed(2)})`;
        ctx.beginPath();
        const s = lote.seg;
        for (let k = 0; k < s.length; k += 4) {
          ctx.moveTo(s[k], s[k + 1]);
          ctx.lineTo(s[k + 2], s[k + 3]);
        }
        ctx.stroke();
      });

      // "grab": líneas gruesas del cursor a los óvalos cercanos
      if (mouse.activo) {
        ctx.lineWidth = 1.8;
        for (const a of nodos) {
          const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
          if (d >= o.distanciaMouse) continue;
          const alfa = Math.min(1, (1 - d / o.distanciaMouse) * 0.95 * Math.max(1, o.intensidad));
          ctx.strokeStyle = `rgba(${a.color[0]}, ${a.color[1]}, ${a.color[2]}, ${alfa.toFixed(2)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
        // anillo suave alrededor del cursor
        const c = o.colores[0];
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 0.55)`;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 9 + 2 * Math.sin(t * 0.006), 0, Math.PI * 2);
        ctx.stroke();
      }

      // los óvalos (la forma de la marca); los grandes llevan un brillo estampado que late
      for (const n of nodos) {
        const pulso = 0.75 + 0.25 * Math.sin(t * 0.0015 + n.fase);
        const [r, g, b] = n.color;
        if (n.grande) {
          const tam = (n.rx * 5) * (0.9 + 0.2 * pulso);
          ctx.drawImage(brilloDe(n.color), n.x - tam / 2, n.y - tam / 2, tam, tam);
        }
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(0.6 + 0.35 * pulso).toFixed(2)})`;
        ctx.beginPath();
        ctx.ellipse(n.x, n.y, n.rx, n.ry, n.rot, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const paso = (ahora) => {
      raf = 0;
      if (!visibleTab || !enPantalla) return; // se reanuda sola al volver a verse
      // limita a ~30 fps: si todavía no toca dibujar, espera al siguiente cuadro
      if (ahora - ultimoDibujo < INTERVALO - 2) {
        raf = requestAnimationFrame(paso);
        return;
      }
      ultimoDibujo = ahora;
      const o = opcRef.current;
      const dt = Math.min(3, (ahora - ultimo) / 16.67);
      ultimo = ahora;
      const frenado = Math.pow(0.93, dt);

      for (const n of nodos) {
        // "repulse": el cursor empuja a los óvalos cercanos y luego se asientan solos
        if (mouse.activo && o.fuerzaRepulsion > 0) {
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < o.radioRepulsion) {
            const f = (1 - d / o.radioRepulsion) ** 2 * 1.6 * o.fuerzaRepulsion * dt;
            n.ex += (dx / d) * f;
            n.ey += (dy / d) * f;
          }
        }
        n.x += (n.vx + n.ex) * dt;
        n.y += (n.vy + n.ey) * dt;
        n.ex *= frenado;
        n.ey *= frenado;
        n.rot += n.vrot * dt;
        if (n.x < -10) n.x = ancho + 10;
        else if (n.x > ancho + 10) n.x = -10;
        if (n.y < -10) n.y = alto + 10;
        else if (n.y > alto + 10) n.y = -10;
      }

      dibujar(ahora);
      raf = requestAnimationFrame(paso);
    };

    const arrancar = () => {
      if (reducir || raf || !visibleTab || !enPantalla) return;
      ultimo = performance.now();
      raf = requestAnimationFrame(paso);
    };

    const dentro = (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.activo = mouse.x >= 0 && mouse.y >= 0 && mouse.x <= r.width && mouse.y <= r.height;
      return mouse.activo;
    };
    const onMove = (e) => { if (enPantalla) dentro(e); };
    // "push": un clic en el fondo hace nacer 4 óvalos que salen disparados; hay un tope para no saturar
    const onClick = (e) => {
      const o = opcRef.current;
      if (!o.clickAgrega || reducir || !dentro(e)) return;
      if (o.ignorarClick && e.target instanceof Element && e.target.closest(o.ignorarClick)) return;
      for (let i = 0; i < 4; i++) nodos.push(nuevo(mouse.x, mouse.y, true));
      const tope = maximo + 30;
      if (nodos.length > tope) nodos.splice(0, nodos.length - tope);
    };
    const onLeave = () => { mouse.activo = false; };
    const onVisibilidad = () => {
      visibleTab = !document.hidden;
      arrancar();
    };

    medir();
    arrancar();
    const resize = new ResizeObserver(medir);
    resize.observe(canvas);
    // si el canvas sale de la pantalla (por ejemplo al hacer scroll) el bucle se detiene
    const vista = new IntersectionObserver((entradas) => {
      enPantalla = entradas.some((e) => e.isIntersecting);
      if (!enPantalla) mouse.activo = false;
      arrancar();
    });
    vista.observe(canvas);
    if (interactivo) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerdown', onClick, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
    }
    document.addEventListener('visibilitychange', onVisibilidad);

    return () => {
      cancelAnimationFrame(raf);
      resize.disconnect();
      vista.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onClick);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibilidad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [densidad, maximo, interactivo]);

  return <canvas ref={canvasRef} className={`red-particulas${className ? ` ${className}` : ''}`} aria-hidden="true" />;
}
