import React, { useEffect, useState } from 'react';
import { LuEye, LuEyeOff } from 'react-icons/lu';
import './PasswordInput.css';

// Campo de contraseña con ojito propio, igual en todos los navegadores.
// El ojito solo aparece cuando hay algo escrito; si el campo queda vacío, vuelve a ocultar.
export default function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  const tieneTexto = String(props.value ?? '').length > 0;

  useEffect(() => {
    if (!tieneTexto) setVisible(false);
  }, [tieneTexto]);

  return (
    <div className="pw-wrap">
      <input {...props} type={visible ? 'text' : 'password'} className={`pw-input ${className}`.trim()} />
      {tieneTexto && (
        <button
          type="button"
          className="pw-eye"
          onClick={() => setVisible((v) => !v)}
          // evita que el campo pierda el foco al hacer clic en el ojito
          onMouseDown={(e) => e.preventDefault()}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {/* la key reinicia la animación de "parpadeo" en cada cambio */}
          <span key={visible ? 'abierto' : 'cerrado'} className="pw-eye-icon">
            {visible ? <LuEyeOff /> : <LuEye />}
          </span>
        </button>
      )}
    </div>
  );
}
