import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import API_BASE_URL from '../api';
import { QRCodeCanvas } from 'qrcode.react';


export default function ScanInvitacionQR() {
  const { qrToken } = useParams();

  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null);
  const [mensaje, setMensaje] = useState('');

  const cargarInvitacion = async () => {
    try {
      setLoading(true);
      setError('');

      const resp = await fetch(`${API_BASE_URL}/scan-invitacion-qr/${qrToken}`);
      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json.msg || 'No se pudo consultar la invitación');
      }

      setInfo(json);
    } catch (err) {
      setError(err.message || 'Error al consultar invitación');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (qrToken) {
      cargarInvitacion();
    }
  }, [qrToken]);

  const registrarEntrada = async () => {
    try {
      setProcesando(true);
      setError('');
      setMensaje('');

      const resp = await fetch(`${API_BASE_URL}/scan-invitacion-qr/${qrToken}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await resp.json();

      if (!resp.ok) {
        setInfo((prev) =>
          prev
            ? {
                ...prev,
                entradasRestantes: json.entradasRestantes ?? prev.entradasRestantes,
                estado: json.estado || prev.estado,
              }
            : prev
        );
        throw new Error(json.msg || 'No se pudo registrar la entrada');
      }

      setMensaje(json.msg || 'Acceso permitido');
      setInfo((prev) => ({
        ...(prev || {}),
        ...json,
      }));
    } catch (err) {
      setError(err.message || 'Error al registrar entrada');
    } finally {
      setProcesando(false);
    }
  };

  const colorEstado =
    info?.estado === 'cancelada'
      ? '#dc2626'
      : info?.estado === 'agotada'
      ? '#b45309'
      : '#16a34a';

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brandRow}>
          <span style={styles.brand}>NARDELI</span>
          <span style={styles.tag}>Escaneo QR</span>
        </div>

        <h1 style={styles.title}>Control de acceso</h1>

        <div style={styles.qrContainer}>
  <QRCodeCanvas
    value={window.location.href}
    size={200}
    includeMargin={true}
  />
</div>
        <p style={styles.subtitle}>
          Escanea el código y registra la entrada del invitado.
        </p>

        {loading ? (
          <p>Cargando información...</p>
        ) : error && !info ? (
          <p style={{ color: '#dc2626' }}>{error}</p>
        ) : (
          <>
            <div style={styles.infoBox}>
              <div style={styles.infoRow}>
                <span>Familia / grupo</span>
                <strong>{info?.nombreFamilia || '—'}</strong>
              </div>

              <div style={styles.infoRow}>
                <span>Personas autorizadas</span>
                <strong>{info?.personasAutorizadas ?? '—'}</strong>
              </div>

              <div style={styles.infoRow}>
                <span>Entradas restantes</span>
                <strong>{info?.entradasRestantes ?? '—'}</strong>
              </div>

              <div style={styles.infoRow}>
                <span>Estado</span>
                <strong style={{ color: colorEstado }}>
                  {info?.estado || '—'}
                </strong>
              </div>

              {info?.notas ? (
                <div style={styles.notesBox}>
                  <strong>Notas:</strong> {info.notas}
                </div>
              ) : null}
            </div>

            {mensaje ? (
              <div style={{ ...styles.msgBox, background: '#ecfdf5', color: '#166534' }}>
                {mensaje}
              </div>
            ) : null}

            {error ? (
              <div style={{ ...styles.msgBox, background: '#fef2f2', color: '#991b1b' }}>
                {error}
              </div>
            ) : null}

            <button
              type="button"
              style={{
                ...styles.primaryBtn,
                opacity:
                  procesando || info?.estado === 'cancelada' || info?.entradasRestantes <= 0
                    ? 0.6
                    : 1,
                cursor:
                  procesando || info?.estado === 'cancelada' || info?.entradasRestantes <= 0
                    ? 'not-allowed'
                    : 'pointer',
              }}
              onClick={registrarEntrada}
              disabled={
                procesando || info?.estado === 'cancelada' || info?.entradasRestantes <= 0
              }
            >
              {procesando ? 'Registrando...' : 'Registrar entrada'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f6f1f8',
    padding: '40px 20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 620,
    background: '#fff',
    borderRadius: 24,
    padding: 32,
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
  },
  brandRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  brand: {
    fontWeight: 800,
    letterSpacing: 3,
    color: '#be185d',
  },
  tag: {
    background: '#2d143d',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 14,
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: 30,
    color: '#2d143d',
  },
  subtitle: {
    color: '#6b7280',
    marginBottom: 24,
  },
  infoBox: {
    border: '1px solid #eee',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    background: '#fafafa',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 0',
    borderBottom: '1px solid #eee',
  },
  notesBox: {
    marginTop: 14,
    color: '#4b5563',
  },
  msgBox: {
    padding: '14px 16px',
    borderRadius: 14,
    marginBottom: 14,
    fontWeight: 600,
  },
  primaryBtn: {
    width: '100%',
    border: 'none',
    borderRadius: 14,
    padding: '16px 22px',
    background: '#0f172a',
    color: '#fff',
    fontWeight: 700,
    fontSize: 16,
  },
  qrContainer: {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: 20,
},
};