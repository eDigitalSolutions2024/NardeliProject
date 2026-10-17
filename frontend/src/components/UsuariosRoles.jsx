import PasswordInput from './PasswordInput';
import { pedirConfirmacion } from '../utils/avisos';
import { LuPencil, LuKeyRound, LuBan, LuCheck, LuCopy, LuLock } from 'react-icons/lu';
import SelectField from './ui/SelectField';
import DateField from './ui/DateField';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../api';
import { jsonAuthHeaders } from '../session';
import './Roles.css';

const ROLES = [
  { id: 'admin', label: 'Administrador' },
  { id: 'asistente', label: 'Asistente' },
  { id: 'cotizador', label: 'Cotizador' },
];
const rolLabel = (id) => ROLES.find((r) => r.id === id)?.label || id;
const fecha = (v) => (v ? new Date(v).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '—');

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, { headers: jsonAuthHeaders(), ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || `Error ${res.status}`);
  return data;
}

/* ---------------- Modal: contraseña temporal (se muestra una sola vez) ---------------- */
function ModalPassword({ titulo, usuario, password, onClose }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(password); setCopiado(true); } catch { /* sin permiso */ }
  };
  return (
    <div className="rl-modal-bg">
      <div className="rl-modal">
        <h3>{titulo}</h3>
        <p className="rl-hint">
          Entrega esta contraseña temporal a <strong>{usuario.fullname || usuario.email}</strong> ({usuario.email}).
          <br />Se muestra <strong>solo ahora</strong>: después no se puede volver a ver. En su primer ingreso el sistema le
          pedirá cambiarla por una propia.
        </p>
        <div className="rl-pass-box"><code>{password}</code></div>
        <div className="rl-modal-actions">
          <button className="rl-btn sec" onClick={copiar}>{copiado ? <><LuCheck /> Copiada</> : 'Copiar'}</button>
          <button className="rl-btn" onClick={onClose}>Listo, ya la anoté</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Modal: crear / editar usuario ---------------- */
function ModalUsuario({ usuario, esUnoMismo, onClose, onSaved }) {
  const edita = !!usuario;
  const [fullname, setFullname] = useState(usuario?.fullname || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [role, setRole] = useState(usuario?.role || 'cotizador');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Al editar: contraseña actual (consulta registrada en la bitácora) y, opcionalmente, una nueva con confirmación.
  const [actual, setActual] = useState({ estado: edita ? 'cargando' : 'ok', password: null, msg: '' });
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [obligar, setObligar] = useState(true);
  const [copiadoActual, setCopiadoActual] = useState(false);
  useEffect(() => {
    if (!edita) return;
    let vivo = true;
    api(`/usuarios/${usuario.id}/password`)
      .then((d) => { if (vivo) setActual({ estado: 'ok', password: d.password, msg: d.msg }); })
      .catch(() => { if (vivo) setActual({ estado: 'error', password: null, msg: '' }); });
    return () => { vivo = false; };
  }, [edita, usuario?.id]);
  const copiarActual = async () => {
    try { await navigator.clipboard.writeText(actual.password); setCopiadoActual(true); } catch { /* sin permiso */ }
  };

  // Contraseña temporal generada por el sistema, visible ANTES de crear la cuenta.
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const generar = useCallback(async () => {
    setCopiado(false);
    try { setPassword((await api('/usuarios/password-sugerida')).password); }
    catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { if (!edita) generar(); }, [edita, generar]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(password); setCopiado(true); } catch { /* sin permiso */ }
  };

  const guardar = async (e) => {
    e.preventDefault();
    setError('');
    const quiereCambiar = edita && (nueva !== '' || confirmar !== '');
    if (quiereCambiar) {
      if (nueva.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres.');
      if (nueva !== confirmar) return setError('La confirmación no coincide con la nueva contraseña.');
    }
    setGuardando(true);
    try {
      const data = edita
        ? await api(`/usuarios/${usuario.id}`, { method: 'PUT', body: JSON.stringify({ fullname, role }) })
        : await api('/usuarios', { method: 'POST', body: JSON.stringify({ fullname, email, role, password }) });
      if (quiereCambiar) {
        await api(`/usuarios/${usuario.id}/password`, {
          method: 'PUT',
          body: JSON.stringify({ password: nueva, obligarCambio: esUnoMismo ? false : obligar }),
        });
      }
      onSaved(data, quiereCambiar ? nueva : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="rl-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="rl-modal" onSubmit={guardar}>
        <h3>{edita ? 'Editar usuario' : 'Nuevo usuario'}</h3>
        {error && <div className="rl-msg err">{error}</div>}
        <div className="rl-field">
          <label>Nombre completo</label>
          <input value={fullname} onChange={(e) => setFullname(e.target.value)} required autoFocus />
        </div>
        <div className="rl-field">
          <label>Correo (con él inicia sesión)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={edita} />
        </div>
        <div className="rl-field">
          <label>Rol</label>
          <SelectField
            value={role}
            onChange={setRole}
            disabled={esUnoMismo}
            options={ROLES.map((r) => ({ value: r.id, label: r.label }))}
            style={{ width: '100%' }}
          />
          {esUnoMismo && <small style={{ color: '#6b7280' }}>No puedes cambiar tu propio rol.</small>}
        </div>
        {!edita && (
          <div className="rl-field">
            <label>Contraseña temporal (generada por el sistema)</label>
            <div className="rl-pass-box" style={{ margin: 0 }}>
              <code>{verPassword ? (password || '…') : '•'.repeat(password.length || 10)}</code>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <button type="button" className="rl-btn sec sm" onClick={() => setVerPassword((v) => !v)}>{verPassword ? 'Ocultar' : 'Mostrar'}</button>
              <button type="button" className="rl-btn sec sm" onClick={copiar} disabled={!password}>{copiado ? <><LuCheck /> Copiada</> : 'Copiar'}</button>
              <button type="button" className="rl-btn sec sm" onClick={generar}>↻ Generar otra</button>
            </div>
            <small style={{ color: '#6b7280' }}>
              Cópiala y entrégala al usuario. Se guarda cifrada y podrás volver a verla desde “Editar”.
              El usuario deberá cambiarla por una propia en su primer ingreso (solo podrá cambiarla esa vez).
            </small>
          </div>
        )}
        {edita && (
          <div className="rl-pwsec">
            <div className="rl-pwsec-title"><LuLock /> Contraseña</div>

            <div className="rl-field">
              <label>Contraseña actual</label>
              <div className="rl-pw-current">
                {actual.estado === 'cargando' && <span className="rl-sub">Cargando…</span>}
                {actual.estado === 'ok' && actual.password && (
                  <>
                    <code className="rl-pw-code">{actual.password}</code>
                    <button type="button" className="rl-icon-btn" title="Copiar" onClick={copiarActual}>{copiadoActual ? <LuCheck /> : <LuCopy />}</button>
                  </>
                )}
                {actual.estado === 'ok' && !actual.password && <span className="rl-sub" title={actual.msg}>No guardada: se mostrará cuando se le asigne una nueva.</span>}
                {actual.estado === 'error' && <span className="rl-sub">No se pudo consultar.</span>}
              </div>
            </div>

            <p className="rl-hint">Si no quieres cambiarla, deja las dos casillas vacías: no se modifica nada.</p>
            <div className="rl-field">
              <label>Nueva contraseña</label>
              <PasswordInput value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" placeholder="Opcional" />
            </div>
            <div className="rl-field">
              <label>Confirmar nueva contraseña</label>
              <PasswordInput value={confirmar} onChange={(e) => setConfirmar(e.target.value)} autoComplete="new-password" placeholder="Repite la nueva contraseña" />
            </div>
            {nueva && !esUnoMismo && (
              <label className="rl-check">
                <input type="checkbox" checked={obligar} onChange={(e) => setObligar(e.target.checked)} />
                <span>Pedirle que la cambie por una propia en su siguiente ingreso (tendrá un único cambio)</span>
              </label>
            )}
          </div>
        )}
        <div className="rl-modal-actions">
          <button type="button" className="rl-btn sec" onClick={onClose}>Cancelar</button>
          <button className="rl-btn" disabled={guardando || (!edita && !password)}>{guardando ? 'Guardando…' : (edita ? 'Guardar' : 'Crear usuario')}</button>
        </div>
      </form>
    </div>
  );
}


/* ---------------- Pestaña: Usuarios ---------------- */
function TabUsuarios({ currentUser }) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [modal, setModal] = useState(null);       // { tipo: 'form', usuario? }
  const [password, setPassword] = useState(null); // { titulo, usuario, password }

  const miId = String(currentUser?.sub || currentUser?.id || '');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try { setItems((await api('/usuarios')).items); }
    catch (e) { setError(e.message); }
    finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const alGuardar = (data, nuevaPassword) => {
    setModal(null);
    if (nuevaPassword) {
      setAviso('Cambios y contraseña guardados.');
      cargar();
      return;
    }
    if (data.passwordTemporal) {
      setPassword({ titulo: 'Usuario creado', usuario: data.usuario, password: data.passwordTemporal });
    } else {
      setAviso('Cambios guardados.');
    }
    cargar();
  };

  const cambiarActivo = async (u) => {
    const accion = u.activo ? 'desactivar' : 'reactivar';
    if (!await pedirConfirmacion(`¿Seguro que quieres ${accion} la cuenta de ${u.fullname || u.email}?`)) return;
    setError(''); setAviso('');
    try { await api(`/usuarios/${u.id}`, { method: 'PUT', body: JSON.stringify({ activo: !u.activo }) }); cargar(); }
    catch (e) { setError(e.message); }
  };

  const reset = async (u) => {
    if (!await pedirConfirmacion(`Se generará una contraseña temporal nueva para ${u.fullname || u.email} y la actual dejará de servir. ¿Continuar?`)) return;
    setError(''); setAviso('');
    try {
      const data = await api(`/usuarios/${u.id}/reset-password`, { method: 'POST' });
      setPassword({ titulo: 'Contraseña restablecida', usuario: data.usuario, password: data.passwordTemporal });
      cargar();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="rl-card">
      <div className="rl-toolbar">
        <h3>Cuentas del sistema</h3>
        <button className="rl-btn" onClick={() => setModal({ tipo: 'form' })}>+ Nuevo usuario</button>
      </div>
      {error && <div className="rl-msg err">{error}</div>}
      {aviso && <div className="rl-msg ok">{aviso}</div>}
      {cargando ? <p className="rl-hint">Cargando…</p> : (
        <div className="rl-table-wrap">
          <table className="rl-table">
            <thead>
              <tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Último acceso</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((u) => {
                const yo = String(u.id) === miId;
                return (
                  <tr key={u.id} className={u.activo ? '' : 'off'}>
                    <td>
                      <div className="rl-name">
                        <span className="rl-avatar" aria-hidden="true">{(u.fullname || u.email || '?').trim().charAt(0).toUpperCase()}</span>
                        <div><strong>{u.fullname || '—'}</strong>{yo && <span className="rl-you"> (tú)</span>}</div>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><span className={`rl-pill ${u.role}`}>{rolLabel(u.role)}</span></td>
                    <td>
                      {!u.activo ? <span className="rl-pill warn">Desactivada</span>
                        : u.mustChangePassword ? <span className="rl-pill pend">Contraseña temporal</span>
                        : <span className="rl-pill ok">Activa</span>}
                      {u.activo && !u.mustChangePassword && u.passwordCambiadaPorUsuario && <small className="rl-sub">Ya usó su cambio</small>}
                    </td>
                    <td>{fecha(u.lastLoginAt)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="rl-actions">
                      <button className="rl-btn sec sm" onClick={() => setModal({ tipo: 'form', usuario: u })}><LuPencil /> Editar</button>{' '}
                      {!yo && <button className="rl-btn sec sm" onClick={() => reset(u)}><LuKeyRound /> Restablecer</button>}{' '}
                      {!yo && <button className={`rl-btn sm ${u.activo ? 'danger' : ''}`} onClick={() => cambiarActivo(u)}>{u.activo ? <><LuBan /> Desactivar</> : <><LuCheck /> Reactivar</>}</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: '#6b7280' }}>Sin usuarios.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal?.tipo === 'form' && (
        <ModalUsuario
          usuario={modal.usuario}
          esUnoMismo={modal.usuario && String(modal.usuario.id) === miId}
          onClose={() => setModal(null)}
          onSaved={alGuardar}
        />
      )}
      {password && <ModalPassword {...password} onClose={() => setPassword(null)} />}
    </div>
  );
}

/* ---------------- Pestaña: Permisos por rol ---------------- */
function TabPermisos() {
  const [catalogo, setCatalogo] = useState([]);
  const [roles, setRoles] = useState([]);
  const [original, setOriginal] = useState(null);
  const [permisos, setPermisos] = useState(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api('/permisos')
      .then((d) => { setCatalogo(d.catalogo); setRoles(d.roles); setOriginal(d.permisos); setPermisos(d.permisos); })
      .catch((e) => setError(e.message));
  }, []);

  const hayCambios = useMemo(() => JSON.stringify(original) !== JSON.stringify(permisos), [original, permisos]);

  const toggle = (rol, key) => {
    setAviso('');
    setPermisos((p) => ({ ...p, [rol]: { ...p[rol], [key]: !p[rol][key] } }));
  };

  const guardar = async () => {
    setGuardando(true); setError(''); setAviso('');
    try {
      const d = await api('/permisos', { method: 'PUT', body: JSON.stringify({ permisos }) });
      setOriginal(d.permisos); setPermisos(d.permisos);
      setAviso('Permisos guardados. Aplican de inmediato a todos los usuarios de esos roles.');
    } catch (e) { setError(e.message); }
    finally { setGuardando(false); }
  };

  return (
    <div className="rl-card">
      <div className="rl-toolbar">
        <h3>Qué puede hacer cada rol</h3>
        <button className="rl-btn" onClick={guardar} disabled={!hayCambios || guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
      <p className="rl-hint">
        Prende o apaga cada permiso. El <strong>Administrador</strong> siempre tiene todo y “Gestionar usuarios y roles” es
        exclusivo suyo. Los clientes solo acceden a su propia reserva.
      </p>
      {error && <div className="rl-msg err">{error}</div>}
      {aviso && <div className="rl-msg ok">{aviso}</div>}
      {permisos && (
        <div className="rl-table-wrap">
          <table className="rl-table rl-matrix">
            <thead>
              <tr>
                <th>Permiso</th>
                <th className="rol">Administrador</th>
                {roles.map((r) => <th key={r} className="rol">{rolLabel(r)}</th>)}
              </tr>
            </thead>
            <tbody>
              {catalogo.map((p) => (
                <tr key={p.key}>
                  <td>{p.etiqueta}</td>
                  <td className="rol">
                    <label className="rl-switch"><input type="checkbox" checked disabled readOnly /><span className="rl-slider" /></label>
                  </td>
                  {roles.map((r) => (
                    <td key={r} className="rol">
                      <label className="rl-switch">
                        <input type="checkbox" checked={!!permisos[r][p.key]} disabled={!!p.fijoAdmin} onChange={() => toggle(r, p.key)} />
                        <span className="rl-slider" />
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Pestaña: Bitácora ---------------- */
const SECCIONES = {
  usuario: { label: 'Usuarios', acciones: {
    'usuario.crear': 'Creó un usuario', 'usuario.editar': 'Editó un usuario', 'usuario.reset_password': 'Restableció una contraseña',
    'usuario.ver_password': 'Consultó una contraseña', 'usuario.cambiar_password': 'Cambió una contraseña' } },
  permisos: { label: 'Permisos', acciones: { 'permisos.actualizar': 'Cambió permisos' } },
  reserva: { label: 'Reservas y cotizaciones', acciones: {
    'reserva.crear': 'Creó una reserva/cotización', 'reserva.crear_publica': 'Reserva enviada por un cliente', 'reserva.editar': 'Editó una reserva',
    'reserva.eliminar': 'Eliminó una reserva', 'reserva.aceptar_cotizacion': 'Aceptó una cotización', 'reserva.convertir_cotizacion': 'Convirtió a cotización',
    'reserva.descuento': 'Cambió un descuento', 'reserva.precios': 'Cambió precios', 'reserva.accesorios': 'Modificó accesorios',
    'reserva.finalizar': 'Finalizó una reserva', 'reserva.posponer_fin': 'Pospuso el fin', 'reserva.reactivar': 'Reactivó una reserva' } },
  pago: { label: 'Pagos y recibos', acciones: { 'pago.recibo_crear': 'Generó un recibo', 'pago.recibo_eliminar': 'Eliminó un recibo' } },
  inventario: { label: 'Inventario', acciones: {
    'inventario.producto_crear': 'Agregó un producto', 'inventario.producto_editar': 'Editó un producto', 'inventario.producto_eliminar': 'Eliminó un producto',
    'inventario.accesorio_crear': 'Agregó un accesorio', 'inventario.accesorio_editar': 'Editó un accesorio', 'inventario.accesorio_eliminar': 'Eliminó un accesorio' } },
  bitacora: { label: 'Bitácora', acciones: { 'bitacora.limpiar': 'Limpió la bitácora' } },
  formato: { label: 'Formatos', acciones: { 'formato.guardar': 'Guardó un formato' } },
  checklist: { label: 'Checklists', acciones: {
    'checklist.crear': 'Creó un checklist', 'checklist.editar': 'Editó un checklist', 'checklist.eliminar': 'Eliminó un checklist',
    'checklist.plantilla_crear': 'Creó una plantilla', 'checklist.plantilla_editar': 'Editó una plantilla', 'checklist.plantilla_eliminar': 'Eliminó una plantilla' } },
};
const ACCIONES = Object.assign({}, ...Object.values(SECCIONES).map((s) => s.acciones));
const seccionDe = (accion) => String(accion || '').split('.')[0];
function describir(it) {
  const d = it.detalle || {};
  if (it.accion === 'usuario.crear') return `${d.email} (${rolLabel(d.role)})`;
  if (it.accion === 'usuario.editar') return `${d.email}: ${Object.entries(d.cambios || {}).map(([k, v]) => `${k} → ${v}`).join(', ')}`;
  if (['usuario.reset_password', 'usuario.ver_password', 'usuario.cambiar_password'].includes(it.accion)) return d.email;
  if (it.accion === 'permisos.actualizar') return (d.cambios || []).map((c) => `${rolLabel(c.rol)}: ${c.permiso} ${c.a ? 'activado' : 'desactivado'}`).join('; ');
  if (it.accion === 'bitacora.limpiar') return `${d.quitadas} movimientos (${d.alcance === 'todo' ? 'todo' : 'por día'})`;
  if (d.ruta) return [d.nombre, d.id && `ID …${String(d.id).slice(-6)}`].filter(Boolean).join(' · ') || '—';
  return JSON.stringify(d);
}
function TabBitacora() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [seccion, setSeccion] = useState('');
  const [accion, setAccion] = useState('');
  const [dia, setDia] = useState(''); // YYYY-MM-DD (vacío = todos los días)
  const cargar = useCallback(() => api('/permisos/bitacora').then((d) => setItems(d.items)).catch((e) => setError(e.message)), []);
  useEffect(() => { cargar(); }, [cargar]);
  const diaDe = (v) => { const d = new Date(v); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const limpiar = async (cuerpo, mensaje) => {
    if (!await pedirConfirmacion(mensaje, { peligro: true })) return;
    try {
      const r = await api('/permisos/bitacora', { method: 'DELETE', body: JSON.stringify(cuerpo) });
      setError('');
      await cargar();
      setAviso(`Se eliminaron ${r.quitadas} movimientos.`);
    } catch (e) { setError(e.message); }
  };
  const limpiarDia = () => {
    const [y, m, d] = dia.split('-').map(Number);
    limpiar({ desde: new Date(y, m - 1, d).toISOString(), hasta: new Date(y, m - 1, d + 1).toISOString() },
      `Se eliminarán todos los movimientos del ${d}/${m}/${y}. No se puede deshacer. ¿Eliminar?`);
  };
  const [aviso, setAviso] = useState('');
  const opSecciones = [{ value: '', label: 'Todas las secciones' }, ...Object.entries(SECCIONES).map(([k, s]) => ({ value: k, label: s.label }))];
  const opAcciones = [{ value: '', label: 'Todas las acciones' }, ...Object.entries(seccion ? SECCIONES[seccion].acciones : ACCIONES).map(([k, l]) => ({ value: k, label: l }))];
  const visibles = items.filter((it) => (!seccion || seccionDe(it.accion) === seccion) && (!accion || it.accion === accion) && (!dia || diaDe(it.fecha) === dia));
  return (
    <div className="rl-card">
      <div className="rl-toolbar">
        <h3>Bitácora de cambios</h3>
        <div className="rl-bitacora-filtros">
          <SelectField value={seccion} onChange={(v) => { setSeccion(v); setAccion(''); }} options={opSecciones} aria-label="Sección" size="sm" />
          <SelectField value={accion} onChange={setAccion} options={opAcciones} aria-label="Tipo de acción" size="sm" />
          <DateField value={dia} onChange={setDia} placeholder="Todos los días" aria-label="Día" size="sm" />
        </div>
      </div>
      <div className="rl-bitacora-limpiar">
        <button type="button" className="rl-btn sec sm" disabled={!dia} onClick={limpiarDia}>Limpiar este día</button>
        <button type="button" className="rl-btn danger sm" disabled={!items.length} onClick={() => limpiar({ todo: true }, 'Se eliminará TODA la bitácora. No se puede deshacer. ¿Eliminar?')}>Limpiar todo</button>
        {aviso && <span className="rl-bitacora-aviso">{aviso}</span>}
      </div>
      {error && <div className="rl-msg err">{error}</div>}
      <div className="rl-table-wrap rl-bitacora-scroll">
        <table className="rl-table">
          <thead><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>
            {visibles.map((it, i) => (
              <tr key={i}><td>{fecha(it.fecha)}</td><td>{it.actor}</td><td>{ACCIONES[it.accion] || it.accion}</td><td>{describir(it)}</td></tr>
            ))}
            {visibles.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: '#6b7280' }}>{items.length ? 'No hay movimientos con ese filtro.' : 'Aún no hay movimientos.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function UsuariosRoles({ currentUser }) {
  const [tab, setTab] = useState('usuarios');
  return (
    <div className="dashboard-content nd-wide">
      <div className="nd-welcome">
        <div>
          <h1>Usuarios y roles</h1>
          <p>Administra las cuentas del sistema y lo que puede hacer cada rol.</p>
        </div>
      </div>

      <div className="rl-tabs">
        <button className={`rl-tab ${tab === 'usuarios' ? 'active' : ''}`} onClick={() => setTab('usuarios')}>Usuarios</button>
        <button className={`rl-tab ${tab === 'permisos' ? 'active' : ''}`} onClick={() => setTab('permisos')}>Permisos por rol</button>
        <button className={`rl-tab ${tab === 'bitacora' ? 'active' : ''}`} onClick={() => setTab('bitacora')}>Bitácora</button>
      </div>
      {tab === 'usuarios' && <TabUsuarios currentUser={currentUser} />}
      {tab === 'permisos' && <TabPermisos />}
      {tab === 'bitacora' && <TabBitacora />}
    </div>
  );
}
