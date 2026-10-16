import React, { useCallback, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Calendar from 'react-calendar';
import { LuCalendarDays, LuChevronLeft, LuChevronRight, LuX } from 'react-icons/lu';
import useAnchoredPopover from './useAnchoredPopover';
import 'react-calendar/dist/Calendar.css';
import './ui.css';

const pad = (n) => String(n).padStart(2, '0');

// "YYYY-MM-DD" <-> Date (a mediodía local, para que ninguna zona horaria mueva el día)
const aDate = (s) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};
const aTexto = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const aDMY = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

// "ddmmaaaa" (8 dígitos) -> Date válida o null (rechaza 31/02, mes 13, etc.)
const desdeDigitos = (dig) => {
  if (dig.length !== 8) return null;
  const d = Number(dig.slice(0, 2));
  const m = Number(dig.slice(2, 4));
  const y = Number(dig.slice(4));
  if (y < 1900 || y > 2200) return null;
  const f = new Date(y, m - 1, d, 12, 0, 0);
  return f.getFullYear() === y && f.getMonth() === m - 1 && f.getDate() === d ? f : null;
};
const mascara = (dig) => (dig.length > 4 ? `${dig.slice(0, 2)}/${dig.slice(2, 4)}/${dig.slice(4)}` : dig.length > 2 ? `${dig.slice(0, 2)}/${dig.slice(2)}` : dig);

/**
 * Selector de fecha: se puede ESCRIBIR (dd/mm/aaaa) o elegir con el calendario.
 *
 *   <DateField value={fecha} onChange={setFecha} placeholder="Fecha del evento" />
 *
 * `value` y `onChange` usan texto "YYYY-MM-DD" (el mismo formato que un <input type="date">).
 * Props: value, onChange(texto), placeholder, min, max, clearable (true), required, disabled,
 *        className, size ('md' | 'sm'), name, autoFocus, style, aria-label.
 */
export default function DateField({
  value = '', onChange, placeholder = 'dd/mm/aaaa', min, max, clearable = true, required = false,
  disabled = false, className = '', size = 'md', name, autoFocus = false, style, 'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [borrador, setBorrador] = useState(null); // texto mientras se escribe (null = no se está editando)
  const [invalida, setInvalida] = useState(false);
  const panelId = useId();
  const cerrar = useCallback(() => setOpen(false), []);
  const { anchorRef, popRef, pos } = useAnchoredPopover({ open, onClose: cerrar, estimatedHeight: 380 });

  const fecha = useMemo(() => aDate(value), [value]);
  const minD = aDate(min);
  const maxD = aDate(max);
  const mostrado = borrador ?? (fecha ? aDMY(fecha) : '');

  const dentroDeRango = (f) => (!minD || f >= minD) && (!maxD || f <= maxD);

  const escribir = (e) => {
    const previos = (borrador ?? mostrado).replace(/\D/g, '');
    let dig = e.target.value.replace(/\D/g, '').slice(0, 8);
    // al borrar una "/" se quita también el dígito anterior (si no, la máscara la vuelve a poner)
    if (String(e.nativeEvent?.inputType || '').startsWith('delete') && dig.length === previos.length) dig = dig.slice(0, -1);
    setBorrador(mascara(dig));
    setInvalida(false);
    if (dig.length === 0) { if (clearable) onChange?.(''); return; }
    if (dig.length === 8) {
      const f = desdeDigitos(dig);
      if (f && dentroDeRango(f)) onChange?.(aTexto(f));
      else setInvalida(true);
    }
  };

  const elegir = (d) => { setBorrador(null); setInvalida(false); onChange?.(aTexto(d)); setOpen(false); };

  return (
    <div ref={anchorRef} className={`ui-field ui-date ui-${size} ${open ? 'is-open' : ''} ${invalida ? 'is-invalid' : ''} ${className}`.trim()} style={style}>
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
          aria-label="Abrir calendario"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        >
          <LuCalendarDays aria-hidden="true" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          className="ui-text"
          name={name}
          value={mostrado}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-label={ariaLabel || placeholder}
          aria-invalid={invalida || undefined}
          onChange={escribir}
          onClick={() => { if (!disabled) setOpen(true); }}
          onFocus={(e) => { e.target.select(); if (!disabled) setOpen(true); }}
          onBlur={() => { setBorrador(null); setInvalida(false); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'F4') { e.preventDefault(); setOpen(true); }
            if (e.key === 'Enter' && open) { e.preventDefault(); setOpen(false); }
          }}
        />
      </div>

      {/* Conserva la validación nativa de "obligatorio" al enviar el formulario */}
      {required && <input className="ui-hidden-req" tabIndex={-1} aria-hidden="true" value={value || ''} onChange={() => {}} required />}

      {clearable && fecha && !disabled && (
        <button type="button" className="ui-clear ui-clear-abs" tabIndex={-1} onClick={() => { setBorrador(null); onChange?.(''); }} aria-label="Quitar fecha" title="Quitar fecha">
          <LuX />
        </button>
      )}

      {open && pos && createPortal(
        <div
          ref={popRef}
          id={panelId}
          role="dialog"
          aria-label="Calendario"
          className={`ui-popover ui-calendar ${pos.hacia === 'arriba' ? 'is-up' : ''}`}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
        >
          <Calendar
            locale="es-MX"
            calendarType="iso8601"
            value={fecha}
            onChange={elegir}
            minDate={minD || undefined}
            maxDate={maxD || undefined}
            prev2Label={null}
            next2Label={null}
            prevLabel={<LuChevronLeft />}
            nextLabel={<LuChevronRight />}
            showNeighboringMonth
            formatMonthYear={(loc, d) => { const m = d.toLocaleDateString('es-MX', { month: 'long' }); return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${d.getFullYear()}`; }}
            minDetail="year"
          />
          <div className="ui-calendar-foot">
            <button type="button" className="ui-link" onClick={() => elegir(new Date())}>Hoy</button>
            {fecha && <button type="button" className="ui-link ui-link-muted" onClick={() => { setBorrador(null); onChange?.(''); setOpen(false); }}>Limpiar</button>}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
