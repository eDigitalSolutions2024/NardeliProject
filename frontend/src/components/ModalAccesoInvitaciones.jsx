import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../api';

export default function ModalAccesoInvitaciones({ open, onClose, reservaId }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!open || !reservaId) return;

    const generarAcceso = async () => {
      try {
        setLoading(true);
        setError('');

        const resp = await fetch(`${API_BASE_URL}/invitaciones-portal/generar/${reservaId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        const json = await resp.json();
        if (!resp.ok) throw new Error(json.msg || 'No se pudo generar el acceso');
        setData(json);
      } catch (err) {
        setError(err.message || 'Error al generar acceso');
      } finally {
        setLoading(false);
      }
    };

    generarAcceso();
  }, [open, reservaId]);

  if (!open) return null;

  const portalLink = data?.token
    ? `${window.location.origin}/invitaciones/${data.token}`
    : '';

  const copiarTexto = async (texto) => {
    try {
        await navigator.clipboard.writeText(texto);
        setToast('Copiado al portapapeles');

        setTimeout(() => {
        setToast('');
        }, 2000);
    } catch {
        setToast('No se pudo copiar');

        setTimeout(() => {
        setToast('');
        }, 2000);
    }
    };

  return (
    <div style={styles.overlay}>
        <div style={styles.modal}>

        <div style={styles.header}>
            <div>
            <p style={styles.headerSubtitle}>Reserva #{reservaId}</p>
            <h2 style={styles.headerTitle}>Portal de invitaciones</h2>
            </div>
            <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.body}>
            {loading && <p style={styles.statusText}>Generando acceso...</p>}
            {error && <p style={styles.errorText}>{error}</p>}

            {!loading && !error && data && (
            <>
                <p style={styles.hint}>
                Comparte este enlace y código <strong style={{ fontWeight: 500 }}>solo</strong> con
                el cliente autorizado.
                </p>

                <div style={styles.field}>
                <label style={styles.label}>Link privado</label>
                <div style={styles.row}>
                    <input type="text" value={portalLink} readOnly style={styles.input} />
                    <button onClick={() => copiarTexto(portalLink)} style={styles.outlineBtn}>
                    Copiar
                    </button>
                </div>
                </div>

                <div style={styles.field}>
                <label style={styles.label}>Código de acceso</label>
                <div style={styles.row}>
                    <input type="text" value={data.codigo} readOnly style={styles.codeInput} />
                    <button onClick={() => copiarTexto(data.codigo)} style={styles.outlineBtn}>
                    Copiar
                    </button>
                </div>
                </div>

                <div style={styles.footer}>
                <button onClick={onClose} style={styles.cancelBtn}>Cerrar</button>
                <a href={portalLink} target="_blank" rel="noreferrer" style={styles.primaryBtn}>
                    Abrir portal ↗
                </a>
                </div>
            </>
            )}
        </div>

        </div>

        {toast && (
        <div style={styles.toast}>
            {toast}
        </div>
        )}
    </div>
    );
}

const PURPLE = '#5F245B';

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modal: {
    width: '90%',
    maxWidth: 560,
    background: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  header: {
    background: PURPLE,
    padding: '20px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSubtitle: {
    margin: 0,
    fontSize: 11,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  headerTitle: {
    margin: '4px 0 0',
    fontSize: 17,
    fontWeight: 500,
    color: '#fff',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.25)',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  body: {
    padding: 24,
  },
  hint: {
    margin: '0 0 20px',
    fontSize: 13,
    color: '#555',
    lineHeight: 1.6,
    borderLeft: `3px solid ${PURPLE}`,
    paddingLeft: 12,
  },
  statusText: {
    color: '#555',
    fontSize: 14,
  },
  errorText: {
    color: '#c0392b',
    fontSize: 14,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 500,
    color: '#888',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #e0e0e0',
    background: '#f8f8f8',
    fontSize: 13,
    color: '#555',
    outline: 'none',
  },
  codeInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #e0e0e0',
    background: '#f8f8f8',
    fontSize: 18,
    fontWeight: 500,
    letterSpacing: '0.25em',
    color: '#000',
    outline: 'none',
  },
  outlineBtn: {
    padding: '10px 16px',
    borderRadius: 8,
    border: `1px solid ${PURPLE}`,
    background: 'transparent',
    color: PURPLE,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  footer: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    paddingTop: 16,
    marginTop: 8,
    borderTop: '1px solid #f0f0f0',
  },
  cancelBtn: {
    padding: '10px 20px',
    borderRadius: 8,
    border: '1px solid #e0e0e0',
    background: 'transparent',
    color: '#555',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  primaryBtn: {
    padding: '10px 20px',
    borderRadius: 8,
    background: PURPLE,
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  toast: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    background: '#222',
    color: '#fff',
    padding: '12px 18px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    zIndex: 10000,
    opacity: 0.95,
    animation: 'fadeToast 2s ease forwards',
    },
};