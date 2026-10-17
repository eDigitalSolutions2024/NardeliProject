import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuClock, LuX } from 'react-icons/lu';
import useAnchoredPopover from './useAnchoredPopover';
import './ui.css';

const pad = (n) => String(n).padStart(2, '0');

// "HH:mm" (24 h) -> { h12, min, pm } ; devuelve null si no es válido
const parsear = (v) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v || ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h12: h % 12 === 0 ? 12 : h % 12, min, pm: h >= 12 };
};
const aTexto = (h12, min, pm) => `${pad((h12 % 12) + (pm ? 12 : 0))}:${pad(min)}`;
const legible = (a) => (a ? `${a.h12}:${pad(a.min)} ${a.pm ? 'p. m.' : 'a. m.'}` : '');

// Lo que la persona escribe -> { text: "HH:mm", completo } o null.
//   "4:30 pm", "430p", "16:30", "7", "7 am" ... Sin a. m./p. m.: 13–23 se toma como 24 h;
//   1–12 conserva el periodo actual y, si no hay, 7–11 = a. m. y 12–6 = p. m. (se puede corregir al instante).
const interpretar = (txt, actual) => {
  const s = String(txt || '').trim().toLowerCase().replace(/\./g, '');
  const m = /^(\d{1,2})(?:[:\s]?(\d{2}))?\s*([ap])?\s*m?$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (min > 59 || h > 23) return null;
  let h24;
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    h24 = (h % 12) + (m[3] === 'p' ? 12 : 0);
  } else if (h >= 13 || h === 0) {
    h24 = h;
  } else {
    const pm = actual ? actual.pm : !(h >= 7 && h <= 11);
    h24 = (h % 12) + (pm ? 12 : 0);
  }
  return { text: `${pad(h24)}:${pad(min)}`, conSufijo: !!m[3] || h >= 13 || h === 0 };
};

const HORAS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTOS = Array.from({ length: 60 }, (_, i) => i);

/**
 * Selector de hora: se puede ESCRIBIR ("4:30 pm", "16:30") o elegir en columnas (hora, minutos, a. m./p. m.).
 *
 *   <TimeField value={hora} onChange={setHora} placeholder="Hora de inicio" />
 *
 * `value` y `onChange` usan texto "HH:mm" en 24 horas (el mismo formato que un <input type="time">).
 * Props: value, onChange(texto), placeholder, clearable (true), required, disabled, className,
 *        size ('md' | 'sm'), name, autoFocus, style, aria-label.
 */
export default function TimeField({
  value = '', onChange, placeholder = 'hh:mm', clearable = true, required = false,
  disabled = false, className = '', size = 'md', name, autoFocus = false, style, 'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [borrador, setBorrador] = useState(null);
  const [invalida, setInvalida] = useState(false);
  const panelId = useId();
  const cerrar = useCallback(() => setOpen(false), []);
  const { anchorRef, popRef, pos } = useAnchoredPopover({ open, onClose: cerrar, estimatedHeight: 300 });
  const actual = useMemo(() => parsear(value), [value]);
  const mostrado = borrador ?? legible(actual);

  // Si todavía no hay hora, el primer clic en el selector parte de una base razonable
  const base = actual || { h12: 12, min: 0, pm: false };
  const cambiar = (parcial) => {
    const n = { ...base, ...parcial };
    setBorrador(null);
    setInvalida(false);
    onChange?.(aTexto(n.h12, n.min, n.pm));
  };

  const escribir = (e) => {
    const t = e.target.value;
    setBorrador(t);
    setInvalida(false);
    if (t.trim() === '') { if (clearable) onChange?.(''); return; }
    const r = interpretar(t, actual);
    if (r && r.conSufijo) onChange?.(r.text); // con a. m./p. m. (o 24 h) se aplica al instante
  };

  const confirmar = () => {
    if (borrador == null) return;
    if (borrador.trim() === '') { setBorrador(null); return; }
    const r = interpretar(borrador, actual);
    if (r) { onChange?.(r.text); setBorrador(null); setInvalida(false); }
    else { setBorrador(null); setInvalida(false); }   // texto no válido: vuelve a la hora anterior
  };

  // al abrir el selector, centra la hora y el minuto elegidos UNA vez
  const colH = useRef(null);
  const colM = useRef(null);
  const yaCentrado = useRef(false);
  const listo = !!pos;
  useEffect(() => {
    if (!open) { yaCentrado.current = false; return; }
    if (!listo || yaCentrado.current) return;
    yaCentrado.current = true;
    [colH.current, colM.current].forEach((col) => {
      const el = col?.querySelector('.is-selected');
      if (col && el) col.scrollTop = el.offsetTop - col.clientHeight / 2 + el.clientHeight / 2;
    });
  }, [open, listo]);

  return (
    <div ref={anchorRef} className={`ui-field ui-time ui-${size} ${open ? 'is-open' : ''} ${invalida ? 'is-invalid' : ''} ${className}`.trim()} style={style}>
      <div
        className="ui-control ui-typed"
        onClick={(e) => {
          if (disabled) return;
          setOpen(true);
          if (e.target.tagName !== 'INPUT') {
            anchorRef.current?.querySelector('input.ui-text')?.focus();
          }
        }}
      >
        <button
          type="button"
          className="ui-lead-btn"
          tabIndex={-1}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-label="Abrir selector de hora"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        >
          <LuClock aria-hidden="true" />
        </button>
        <input
          type="text"
          className="ui-text"
          name={name}
          value={mostrado}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-label={ariaLabel || placeholder}
          onChange={escribir}
          onClick={() => { if (!disabled) setOpen(true); }}
          onFocus={(e) => { e.target.select(); if (!disabled) setOpen(true); }}
          onBlur={confirmar}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { confirmar(); if (open) { e.preventDefault(); setOpen(false); } }
            if (e.key === 'ArrowDown' || e.key === 'F4') { e.preventDefault(); setOpen(true); }
          }}
        />
      </div>

      {/* Conserva la validación nativa de "obligatorio" al enviar el formulario */}
      {required && <input className="ui-hidden-req" tabIndex={-1} aria-hidden="true" value={value || ''} onChange={() => {}} required />}

      {clearable && actual && !disabled && (
        <button type="button" className="ui-clear ui-clear-abs" tabIndex={-1} onClick={() => { setBorrador(null); onChange?.(''); }} aria-label="Quitar hora" title="Quitar hora">
          <LuX />
        </button>
      )}

      {open && pos && createPortal(
        <div
          ref={popRef}
          id={panelId}
          role="dialog"
          aria-label="Seleccionar hora"
          className={`ui-popover ui-timepanel ${pos.hacia === 'arriba' ? 'is-up' : ''}`}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
        >
          <div className="ui-time-cols">
            <div className="ui-time-col" ref={colH} role="listbox" aria-label="Hora">
              {HORAS.map((h) => (
                <button key={h} type="button" role="option" aria-selected={actual?.h12 === h}
                  className={`ui-time-item ${actual?.h12 === h ? 'is-selected' : ''}`} onClick={() => cambiar({ h12: h })}>{pad(h)}</button>
              ))}
            </div>
            <div className="ui-time-col" ref={colM} role="listbox" aria-label="Minutos">
              {MINUTOS.map((m) => (
                <button key={m} type="button" role="option" aria-selected={actual?.min === m}
                  className={`ui-time-item ${actual?.min === m ? 'is-selected' : ''}`} onClick={() => cambiar({ min: m })}>{pad(m)}</button>
              ))}
            </div>
            <div className="ui-time-col ui-time-ampm" role="listbox" aria-label="a. m. o p. m.">
              {[['a. m.', false], ['p. m.', true]].map(([t, pm]) => (
                <button key={t} type="button" role="option" aria-selected={!!actual && actual.pm === pm}
                  className={`ui-time-item ${actual && actual.pm === pm ? 'is-selected' : ''}`} onClick={() => cambiar({ pm })}>{t}</button>
              ))}
            </div>
          </div>
          <div className="ui-calendar-foot">
            <button type="button" className="ui-link" onClick={() => {
              const d = new Date();
              setBorrador(null);
              onChange?.(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
            }}>Ahora</button>
            <button type="button" className="ui-link" onClick={cerrar}>Listo</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
