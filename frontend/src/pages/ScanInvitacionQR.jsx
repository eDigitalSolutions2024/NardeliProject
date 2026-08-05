import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { QRCodeSVG } from 'qrcode.react';
import { FiUsers, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import API_BASE_URL from '../api';
import markMaroon from '../assets/nardeli/nardeli-mark-maroon.png';
import markWhite from '../assets/nardeli/nardeli-mark-white.png';
import './ScanInvitacionQR.css';

dayjs.locale('es');

const ESTADO_META = {
  activa: { label: 'Vigente', bg: '#2e7d32' },
  agotada: { label: 'Agotada', bg: '#c8841f' },
  cancelada: { label: 'Cancelada', bg: '#c0392b' },
};

function capitalizar(texto) {
  const t = String(texto || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function formatearFecha(fecha) {
  if (!fecha) return '';
  // La fecha del evento se guarda como medianoche UTC de un día calendario;
  // convertirla a hora local podría recorrerla un día. Se toma solo el
  // "YYYY-MM-DD" y se formatea como fecha local pura (mismo criterio que
  // Calendario.js con reserva.fechaLocal).
  const soloFecha = String(fecha).slice(0, 10);
  return capitalizar(dayjs(soloFecha).format('dddd D [de] MMMM, YYYY'));
}

function formatearHora(hora) {
  if (!hora) return '';
  const parsed = dayjs(`2000-01-01T${hora}`);
  return parsed.isValid() ? parsed.format('h:mm A') : hora;
}

// Página pública del pase del invitado (se abre desde el link/QR que se
// manda por WhatsApp). Es solo informativa: NO permite registrar la entrada
// desde aquí, porque cualquiera con el link podría auto-registrarse. El
// registro de acceso lo hace únicamente el staff con el lector de QR de la
// app (ver mobile/src/screens/ScanQRScreen.js), que exige sesión de staff.
export default function ScanInvitacionQR() {
  const { qrToken } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!qrToken) return;

    let activo = true;

    (async () => {
      try {
        setLoading(true);
        setError('');

        const resp = await fetch(`${API_BASE_URL}/scan-invitacion-qr/${qrToken}`);
        const json = await resp.json();

        if (!resp.ok) {
          throw new Error(json.msg || 'No se pudo consultar la invitación');
        }

        if (activo) setInfo(json);
      } catch (err) {
        if (activo) setError(err.message || 'Error al consultar invitación');
      } finally {
        if (activo) setLoading(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [qrToken]);

  if (loading) {
    return (
      <div className="invite-page">
        <div className="invite-watermark" />
        <div className="invite-shell">
          <div className="invite-loadingCard">
            <div className="invite-spinner" />
            <p className="invite-loadingText">Cargando tu invitación…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="invite-page">
        <div className="invite-watermark" />
        <div className="invite-shell">
          <div className="invite-errorCard">
            <FiAlertCircle size={34} className="invite-errorIcon" />
            <p className="invite-errorText">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const estadoMeta = ESTADO_META[info?.estado] || ESTADO_META.activa;
  const evento = info?.evento;
  const titulo = evento?.tipoEvento
    ? `${capitalizar(evento.tipoEvento)}${evento.anfitrion ? ` de ${evento.anfitrion}` : ''}`
    : 'Estás invitado';

  return (
    <div className="invite-page">
      <div className="invite-watermark" />

      <div className="invite-shell">
        <div className="invite-card">
          <span className="invite-status" style={{ background: estadoMeta.bg }}>
            {estadoMeta.label}
          </span>

          <div className="invite-brand">
            <img src={markMaroon} alt="Nardéli" className="invite-mark" />
            <span className="invite-wordmark">Nardéli</span>
            <span className="invite-caption">Centro de Eventos</span>
          </div>

          <div className="invite-ornament">
            <span className="invite-diamond" />
          </div>

          <p className="invite-eyebrow">Estás invitado a</p>
          <h1 className="invite-title">{titulo}</h1>

          {evento?.fecha && <p className="invite-date">{formatearFecha(evento.fecha)}</p>}
          {evento?.horaInicio && (
            <p className="invite-time">
              {formatearHora(evento.horaInicio)}
              {evento.horaFin ? ` – ${formatearHora(evento.horaFin)}` : ''}
            </p>
          )}

          <div className="invite-guestPanel">
            <p className="invite-guestLabel">Pase de acceso para</p>
            <p className="invite-guestName">{info?.nombreFamilia || '—'}</p>

            <div className="invite-statRow">
              <div className="invite-stat">
                <FiUsers size={18} className="invite-statIcon" />
                <span className="invite-statValue">{info?.personasAutorizadas ?? '—'}</span>
                <span className="invite-statLabel">Autorizados</span>
              </div>
              <div className="invite-stat">
                <FiCheckCircle size={18} className="invite-statIcon" />
                <span className="invite-statValue">{info?.entradasRestantes ?? '—'}</span>
                <span className="invite-statLabel">Disponibles</span>
              </div>
            </div>

            {info?.notas ? <div className="invite-notes">{info.notas}</div> : null}
          </div>

          <div className="invite-qrSection">
            <div className="invite-qrFrame">
              <span className="invite-seal">
                <img src={markWhite} alt="" />
              </span>
              <span className="corner c-tl" />
              <span className="corner c-tr" />
              <span className="corner c-bl" />
              <span className="corner c-br" />
              <QRCodeSVG
                value={typeof window !== 'undefined' ? window.location.href : ''}
                size={184}
                level="H"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#1c0e21"
              />
            </div>
            <p className="invite-qrHint">
              Presenta este código al personal en la <strong>entrada del evento</strong>
            </p>
          </div>

          {error ? <div className="invite-notes" style={{ marginTop: 14 }}>{error}</div> : null}

          <p className="invite-footer">Sistema Nardeli</p>
        </div>
      </div>
    </div>
  );
}
