const express = require('express');
const router = express.Router();
const {
  CATALOGO, ROLES_CONFIGURABLES, obtenerMatriz, guardarMatriz, permisosDeRol,
  requirePermission, requireSesion,
} = require('../utils/permisos');
const bitacora = require('../utils/bitacora');

// Permisos del usuario con sesión (el frontend arma el menú con esto).
// Permite pasar aunque deba cambiar contraseña, para poder redirigirlo.
router.get('/me', requireSesion({ permitirCambioPassword: true }), async (req, res) => {
  const permisos = await permisosDeRol(req.user.role);
  res.json({
    ok: true,
    role: req.user.role,
    mustChangePassword: !!req.usuarioDoc?.mustChangePassword,
    permisos: req.user.role === 'user' ? {} : permisos,
  });
});

// Matriz completa (solo admin).
router.get('/', requirePermission('usuarios.gestionar'), async (_req, res) => {
  const matriz = await obtenerMatriz();
  res.json({
    ok: true,
    catalogo: CATALOGO,
    roles: ROLES_CONFIGURABLES,
    permisos: { asistente: matriz.asistente, cotizador: matriz.cotizador },
  });
});

// Guarda la matriz (solo admin). Solo se aceptan roles configurables y llaves del catálogo.
router.put('/', requirePermission('usuarios.gestionar'), async (req, res) => {
  try {
    const body = req.body?.permisos;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ ok: false, msg: 'Falta "permisos"' });
    }
    const antes = await obtenerMatriz();
    const despues = await guardarMatriz(body);

    const cambios = [];
    for (const rol of ROLES_CONFIGURABLES) {
      for (const p of CATALOGO) {
        if (p.fijoAdmin) continue;
        if (antes[rol][p.key] !== despues[rol][p.key]) {
          cambios.push({ rol, permiso: p.key, de: antes[rol][p.key], a: despues[rol][p.key] });
        }
      }
    }
    if (cambios.length) await bitacora.registrar(req.user, 'permisos.actualizar', { cambios });

    res.json({ ok: true, permisos: { asistente: despues.asistente, cotizador: despues.cotizador } });
  } catch (e) {
    console.error('permisos PUT error:', e);
    res.status(500).json({ ok: false, msg: 'No se pudieron guardar los permisos' });
  }
});

router.get('/bitacora', requirePermission('usuarios.gestionar'), async (_req, res) => {
  res.json({ ok: true, items: await bitacora.listar(100) });
});

module.exports = router;
