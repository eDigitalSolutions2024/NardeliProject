import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuChevronDown, LuCheck } from 'react-icons/lu';
import useAnchoredPopover from './useAnchoredPopover';
import './ui.css';

/**
 * Lista desplegable con el estilo de la marca (reemplaza al <select> del navegador).
 *
 *   <SelectField value={orden} onChange={setOrden} options={[{ value: 'a', label: 'Opción A' }]} />
 *
 * Props: value, onChange(valor), options [{ value, label, hint? }], placeholder, icon,
 *        disabled, className, size ('md' | 'sm'), name, aria-label.
 * Teclado: Enter/Espacio/↓ abre; ↑↓ mueven; Enter elige; Esc cierra.
 */
export default function SelectField({
  value, onChange, options = [], placeholder = 'Seleccionar…', icon = null,
  disabled = false, className = '', size = 'md', name, required = false, style, 'aria-label': ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [activo, setActivo] = useState(-1);
  const listId = useId();
  const cerrar = useCallback(() => setOpen(false), []);
  const { anchorRef, popRef, pos } = useAnchoredPopover({ open, onClose: cerrar, estimatedHeight: Math.min(options.length * 40 + 12, 300) });

  const seleccionada = useMemo(() => options.find((o) => o.value === value), [options, value]);

  useEffect(() => {
    if (open) setActivo(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, options, value]);

  const elegir = (opt) => {
    onChange?.(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((i) => (i + 1) % options.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((i) => (i - 1 + options.length) % options.length); }
    else if (e.key === 'Home') { e.preventDefault(); setActivo(0); }
    else if (e.key === 'End') { e.preventDefault(); setActivo(options.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[activo]) elegir(options[activo]); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={anchorRef} className={`ui-field ui-select ui-${size} ${open ? 'is-open' : ''} ${className}`.trim()} style={style}>
      <button
        type="button"
        className="ui-control"
        name={name}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
      >
        {icon && <span className="ui-lead">{icon}</span>}
        <span className={`ui-value ${seleccionada ? '' : 'is-placeholder'}`}>{seleccionada ? seleccionada.label : placeholder}</span>
        <LuChevronDown className="ui-chevron" aria-hidden="true" />
      </button>

      {required && <input className="ui-hidden-req" tabIndex={-1} aria-hidden="true" value={value ?? ''} onChange={() => {}} required />}

      {open && pos && createPortal(
        <ul
          ref={popRef}
          id={listId}
          role="listbox"
          className={`ui-popover ui-list ${pos.hacia === 'arriba' ? 'is-up' : ''}`}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.width, maxHeight: pos.maxHeight }}
        >
          {options.map((o, i) => (
            <li
              key={String(o.value)}
              role="option"
              aria-selected={o.value === value}
              className={`ui-option ${i === activo ? 'is-active' : ''} ${o.value === value ? 'is-selected' : ''}`}
              onMouseEnter={() => setActivo(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(o)}
            >
              <span className="ui-option-label">{o.label}</span>
              {o.value === value && <LuCheck className="ui-option-check" aria-hidden="true" />}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
}
