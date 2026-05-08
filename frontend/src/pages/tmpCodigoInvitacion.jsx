import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import API_BASE_URL from '../api';
import { QRCodeCanvas } from 'qrcode.react';

export default function IngresaCodigoInvitacion() {
  const { token } = useParams();

  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(true);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState('');
  const [portalInfo, setPortalInfo] = useState(null);

  const [accesoPermitido, setAccesoPermitido] = useState(
    sessionStorage.getItem(`portal_ok_${token}`) === 'true'
  );
  const [invitaciones, setInvitaciones] = useState([]);
  const [loadingInvitaciones, setLoadingInvitaciones] = useState(false);

  const [nombreFamilia, setNombreFamilia] = useState('');
  const [personasAutorizadas, setPersonasAutorizadas] = useState('');
  const [notas, setNotas] = useState('');
  const [telefono, setTelefono] = useState('');
  const [guardandoInvitacion, setGuardandoInvitacion] = useState(false);

  const [invitacionSeleccionada, setInvitacionSeleccionada] = useState(null);

  const [modalWhatsapp, setModalWhatsapp] = useState(false);
const [telefonoEnvio, setTelefonoEnvio] = useState('');
const [invitacionSeleccionadaEnvio, setInvitacionSeleccionadaEnvio] = useState(null);

  useEffect(() => {
    const cargarInfo = async () => {
      try {
        setLoading(true);
        setError('');

        const resp = await fetch(`${API_BASE_URL}/invitaciones-portal/publico/${token}`);
        const json = await resp.json();

        if (!resp.ok) {
          throw new Error(json.msg || 'No se pudo cargar el acceso');
        }

        setPortalInfo(json);
      } catch (err) {
        setError(err.message || 'Error al cargar información');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      cargarInfo();
    }
  }, [token]);

  useEffect(() => {
    if (accesoPermitido && token) {
      cargarInvitaciones();
    }
  }, [accesoPermitido, token]);

  const cargarInvitaciones = async () => {
    try {
      setLoadingInvitaciones(true);

      const resp = await fetch(`${API_BASE_URL}/invitaciones-qr/${token}`);
      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json.msg || 'No se pudieron cargar las invitaciones');
      }

      const lista = Array.isArray(json) ? json : [];
      setInvitaciones(lista);

      if (lista.length > 0) {
        setInvitacionSeleccionada(lista[0]);
      } else {
        setInvitacionSeleccionada(null);
      }
    } catch (err) {
      setError(err.message || 'Error al cargar invitaciones');
    } finally {
      setLoadingInvitaciones(false);
    }
  };

  const ingresar = async (e) => {
    e.preventDefault();

    try {
      setVerificando(true);
      setError('');

      const resp = await fetch(`${API_BASE_URL}/invitaciones-portal/verificar/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });

      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json.msg || 'Código incorrecto');
      }

      sessionStorage.setItem(`portal_ok_${token}`, 'true');
      setAccesoPermitido(true);
      await cargarInvitaciones();
    } catch (err) {
      setError(err.message || 'No se pudo verificar el código');
    } finally {
      setVerificando(false);
    }
  };

const enviarWhatsApp = (telefono, invitacion) => {
  if (!telefono || !invitacion) return;

  let numero = telefono.replace(/\D/g, '');
  if (!numero.startsWith('52')) numero = '52' + numero;

  const urlQR = `${window.location.origin}/invitacion-qr/${invitacion.qrToken}`;

  const mensaje = `
🎉 Invitación NARDELI

Familia: ${invitacion.nombreFamilia}
Personas: ${invitacion.personasAutorizadas}

📍 Presenta este QR:
${urlQR}
  `;

  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

  window.open(url, '_blank');

  // cerrar modal si está abierto
  setModalWhatsapp(false);
  setTelefonoEnvio('');
};



  const crearInvitacion = async (e) => {
    e.preventDefault();

    try {
      setGuardandoInvitacion(true);
      setError('');

      const personas = Number(personasAutorizadas);

      if (!nombreFamilia.trim()) {
        throw new Error('Debes capturar el nombre de la familia o grupo');
      }

      if (!Number.isFinite(personas) || personas < 1) {
        throw new Error('La cantidad de personas debe ser mayor a 0');
      }

      if (personas > 12) {
        throw new Error('Máximo 12 personas por código QR. Si tu grupo supera ese límite, genera otro QR para las personas restantes.');
      }

      const resp = await fetch(`${API_BASE_URL}/invitaciones-qr/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombreFamilia,
          personasAutorizadas: personas,
          notas,
          telefono,
          creadoPor: 'cliente',
        }),
      });

      const json = await resp.json();
      

      if (!resp.ok) {
        throw new Error(json.msg || 'No se pudo crear la invitación');
      }
enviarWhatsApp(telefono, json);

      setNombreFamilia('');
      setPersonasAutorizadas('');
      setNotas('');
      setTelefono('');
      await cargarInvitaciones();
    } catch (err) {
      setError(err.message || 'No se pudo crear la invitación');
    } finally {
      setGuardandoInvitacion(false);
    }
  };
  
  const cancelarInvitacion = async (id) => {
    try {
      const confirmar = window.confirm('¿Cancelar esta invitación?');
      if (!confirmar) return;

      const resp = await fetch(`${API_BASE_URL}/invitaciones-qr/${token}/${id}/cancelar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });

      const json = await resp.json();

      if (!resp.ok) {
        throw new Error(json.msg || 'No se pudo cancelar la invitación');
      }

      await cargarInvitaciones();
    } catch (err) {
      setError(err.message || 'No se pudo cancelar la invitación');
    }
  };


  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.leftCard}>
          <div style={styles.badge}>DEMO · NARDELI EVENTOS</div>
          <h1 style={styles.title}>Invitación digital con control de acceso QR</h1>
          <p style={styles.subtitle}>
            Ingresa tu código para administrar las invitaciones del evento.
          </p>

          {loading ? (
            <p>Cargando información...</p>
            ) : error && !portalInfo ? (
              <p style={{ color: '#dc2626' }}>{error}</p>
            ) : !accesoPermitido ? (
              <>
                <div style={styles.fieldBlock}>
                  <label style={styles.label}>Nombre del evento</label>
                  <input
                    style={styles.input}
                    value={portalInfo?.evento || ''}
                    readOnly
                  />
                </div>

                <div style={styles.fieldBlock}>
                  <label style={styles.label}>Anfitrión</label>
                  <input
                    style={styles.input}
                    value={portalInfo?.anfitrion || ''}
                    readOnly
                  />
                </div>

                <div style={styles.fieldBlock}>
                  <label style={styles.label}>Fecha del evento</label>
                  <input
                    style={styles.input}
                    value={portalInfo?.fecha || ''}
                    readOnly
                  />
                </div>

                <form onSubmit={ingresar}>
                  <div style={styles.fieldBlock}>
                    <label style={styles.label}>Código de acceso</label>
                    <input
                      style={styles.input}
                      type="text"
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      placeholder="Ingresa tu código"
                    />
                  </div>

                  {error && <p style={{ color: '#dc2626', marginTop: 8 }}>{error}</p>}

                  <div style={styles.actions}>
                    <button type="submit" style={styles.primaryBtn} disabled={verificando}>
                      {verificando ? 'Verificando...' : 'Entrar al portal'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ marginBottom: 8, color: '#2d143d' }}>Gestionar invitaciones</h3>
                  <p style={{ color: '#6b7280', margin: 0 }}>
                    Crea invitaciones por familia o grupo. Cada código QR permite máximo 12 accesos.
                    Si tu grupo supera ese límite, genera otro QR para las personas restantes.
                  </p>
                </div>

                <form onSubmit={crearInvitacion}>
                  <div style={styles.fieldBlock}>
                    <label style={styles.label}>Nombre de familia o grupo</label>
                    <input
                      style={styles.input}
                      type="text"
                      value={nombreFamilia}
                      onChange={(e) => setNombreFamilia(e.target.value)}
                      placeholder="Ej. Familia López"
                    />
                  </div>

                  <div style={styles.fieldBlock}>
                    <label style={styles.label}>Personas autorizadas</label>
                    <input
                      style={styles.input}
                      type="number"
                      min="1"
                      max="12"
                      value={personasAutorizadas}
                      onChange={(e) => setPersonasAutorizadas(e.target.value)}
                      placeholder="Máximo 12"
                    />
                    <small style={{ color: '#6b7280' }}>
                      Máximo 12 personas por código QR. Si tu grupo supera ese límite, genera otro QR para las personas restantes.
                    </small>
                  </div>

                  <div style={styles.fieldBlock}>
                    <label style={styles.label}>Notas</label>
                    <input
                      style={styles.input}
                      type="text"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Ej. Mesa principal"
                    />
                  </div>

                  <div style={styles.fieldBlock}>
                  <label style={styles.label}>Teléfono WhatsApp</label>
                  <input
                    style={styles.input}
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Ej. 9991234567 o +5219991234567"
                  />
                </div>

                  {error && <p style={{ color: '#dc2626', marginTop: 8 }}>{error}</p>}

                  <div style={styles.actions}>
                    <button type="submit" style={styles.primaryBtn} disabled={guardandoInvitacion}>
                      {guardandoInvitacion ? 'Generando...' : 'Generar invitación QR'}
                    </button>
                  </div>
                </form>

                <div style={{ marginTop: 28 }}>
                  <h3 style={{ marginBottom: 12, color: '#2d143d' }}>Invitaciones creadas</h3>

                  {loadingInvitaciones ? (
                    <p>Cargando invitaciones...</p>
                  ) : invitaciones.length === 0 ? (
                    <p style={{ color: '#6b7280' }}>Aún no hay invitaciones creadas.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {invitaciones.map((inv) => (
                        <div
                          key={inv._id}
                          style={{
                            ...styles.invCard,
                            border: invitacionSeleccionada?._id === inv._id ? '2px solid #9333ea' : '1px solid #eee',
                            cursor: 'pointer',
                          }}
                          onClick={() => setInvitacionSeleccionada(inv)}
                        >
                          <div>
                            <strong style={{ display: 'block', fontSize: 16 }}>{inv.nombreFamilia}</strong>
                            <small style={{ color: '#6b7280' }}>
                              Personas: {inv.personasAutorizadas} · Restantes: {inv.entradasRestantes}
                            </small>
                            <div style={{ marginTop: 6 }}>
                              <small style={{ color: inv.estado === 'cancelada' ? '#dc2626' : '#16a34a' }}>
                                Estado: {inv.estado}
                              </small>
                            </div>

                            <div style={{ marginTop: 8 }}>
                              <small style={{ color: '#6b7280' }}>
                                Toca para ver el QR
                              </small>
                            </div>


                          </div>

                          <div style={{ display: 'flex', gap: 8 }}>
  <button
    type="button"
    style={styles.whatsappBtn}
    onClick={(e) => {
      e.stopPropagation();
      setInvitacionSeleccionadaEnvio(inv);
      setModalWhatsapp(true);
    }}
  >
    📲 Enviar
  </button>

  {inv.estado !== 'cancelada' && (
    <button
      type="button"
      style={styles.cancelBtn}
      onClick={(e) => {
        e.stopPropagation();
        cancelarInvitacion(inv._id);
      }}
    >
      Cancelar
    </button>
  )}
</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}


        </div>

        <div style={styles.rightCard}>
          <div style={styles.brandRow}>
            <span style={styles.brand}>NARDELI</span>
            <span style={styles.qrTag}>Acceso QR</span>
          </div>

          <h2 style={styles.eventName}>
            {invitacionSeleccionada?.nombreFamilia || portalInfo?.evento || 'Evento'}
          </h2>

          <p style={styles.rightText}>
            {invitacionSeleccionada
              ? 'Invitación digital generada para este grupo.'
              : 'Portal privado para administración de invitaciones digitales.'}
          </p>

          <div style={styles.fakeQrBox}>
            {invitacionSeleccionada ? (
              <QRCodeCanvas
                value={`${window.location.origin}/invitacion-qr/${invitacionSeleccionada.qrToken}`}
                size={180}
                includeMargin={true}
              />
            ) : (
              <div style={styles.fakeQr}>QR</div>
            )}
          </div>

          <div style={styles.infoRow}>
            <span>Personas autorizadas</span>
            <strong>{invitacionSeleccionada?.personasAutorizadas ?? '—'}</strong>
          </div>

          <div style={styles.infoRow}>
            <span>Entradas restantes</span>
            <strong>{invitacionSeleccionada?.entradasRestantes ?? '—'}</strong>
          </div>

          <div style={styles.infoRow}>
            <span>Estado</span>
            <strong>
              {invitacionSeleccionada?.estado || (accesoPermitido ? 'Acceso autorizado' : 'Protegido con código')}
            </strong>
          </div>

        </div>
      </div>
      {modalWhatsapp && (
  <div style={styles.modalOverlay}>
    <div style={styles.modal}>
      <h3>Enviar por WhatsApp</h3>

      <input
        style={styles.input}
        type="text"
        placeholder="Ej. 9991234567"
        value={telefonoEnvio}
        onChange={(e) => setTelefonoEnvio(e.target.value)}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button
          style={styles.primaryBtn}
          onClick={() =>
            enviarWhatsApp(telefonoEnvio, invitacionSeleccionadaEnvio)
          }
        >
          Enviar
        </button>

        <button
          style={styles.cancelBtn}
          onClick={() => {
            setModalWhatsapp(false);
            setTelefonoEnvio('');
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f6f1f8',
    padding: '40px 20px',
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.9fr',
    gap: 32,
    alignItems: 'start',
  },
  leftCard: {
    background: '#fff',
    borderRadius: 24,
    padding: 32,
    boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
  },
  rightCard: {
    background: '#fff',
    borderRadius: 24,
    padding: 28,
    boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
  },
  badge: {
    display: 'inline-block',
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid #eadcf2',
    color: '#9d174d',
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 18,
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: 28,
    color: '#2d143d',
  },
  subtitle: {
    margin: '0 0 24px 0',
    color: '#6b7280',
    fontSize: 16,
    lineHeight: 1.5,
  },
  fieldBlock: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontWeight: 600,
    marginBottom: 8,
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 14,
    border: '1px solid #e5d8ef',
    fontSize: 16,
    outline: 'none',
    boxSizing: 'border-box',
  },
  actions: {
    marginTop: 18,
    display: 'flex',
    justifyContent: 'flex-start',
  },
  primaryBtn: {
    border: 'none',
    borderRadius: 14,
    padding: '14px 22px',
    background: 'linear-gradient(90deg, #ec4899, #9333ea)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 16,
    cursor: 'pointer',
  },
  brandRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  brand: {
    fontWeight: 800,
    letterSpacing: 3,
    color: '#be185d',
  },
  qrTag: {
    background: '#2d143d',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: 999,
    fontWeight: 700,
    fontSize: 14,
  },
  eventName: {
    margin: '10px 0',
    fontSize: 26,
    color: '#2d143d',
  },
  rightText: {
    color: '#6b7280',
    marginBottom: 24,
  },
  fakeQrBox: {
    display: 'flex',
    justifyContent: 'center',
    margin: '20px 0 28px',
  },
  fakeQr: {
    width: 180,
    height: 180,
    border: '2px dashed #d1d5db',
    borderRadius: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 32,
    color: '#9ca3af',
    background: '#fafafa',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '14px 0',
    borderTop: '1px solid #f0f0f0',
    color: '#374151',
  },

  invCard: {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
  padding: 16,
  border: '1px solid #eee',
  borderRadius: 16,
  background: '#fafafa',
},
cancelBtn: {
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  background: '#dc2626',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
},
whatsappBtn: {
  border: 'none',
  borderRadius: 10,
  padding: '10px 14px',
  background: '#16a34a',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
},

modalOverlay: {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 999,
},

modal: {
  background: '#fff',
  padding: 24,
  borderRadius: 16,
  width: 320,
},
};