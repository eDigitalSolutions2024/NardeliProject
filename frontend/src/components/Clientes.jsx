import { aviso } from '../utils/avisos';
import SearchField from './ui/SearchField';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { animate, stagger } from "animejs";
import { LuRefreshCw, LuEye, LuFileDown, LuChevronLeft, LuChevronRight, LuInbox } from "react-icons/lu";
import API_BASE_URL, { authHeaders } from "../api";
import "./Clientes.css";

const PAGE_SIZE = 10;

function fmtDate(d) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("es-MX");
  } catch {
    return "—";
  }
}
function fmtDateTime(d) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return "—";
    return `${dt.toLocaleDateString("es-MX")} ${dt
      .toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
      .replace(/\./g, ":")}`;
  } catch {
    return "—";
  }
}

// inicial para el círculo de cada cliente
const inicial = (nombre) => (String(nombre || "?").trim().charAt(0) || "?").toUpperCase();

// badge de estado de pago
function payBadgeClass(estado) {
  const e = String(estado || "").toLowerCase();
  if (e === "pagado") return "badge success";
  if (e === "pendiente") return "badge warning";
  return "badge";
}

export default function Clientes() {
  const [tab, setTab] = useState("todos"); // todos | registrados | cotizaciones
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const tablaRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [usuariosRes, reservasRes] = await Promise.all([
        fetch(`${API_BASE_URL}/usuarios?rol=cliente`),
        fetch(`${API_BASE_URL}/reservas`, { headers: authHeaders() }),
      ]);

      const usuarios = usuariosRes.ok ? await usuariosRes.json() : [];
      const reservas = reservasRes.ok ? await reservasRes.json() : [];

      // --- Clientes registrados ---
      const registrados = (usuarios || []).map((u) => ({
        _uid: `reg-${u._id}`,
        fuente: "usuarios",
        tipoReserva: "registrado",
        tipo: "Registrado",
        cliente:
          u.nombre ||
          [u.nombre, u.apellido, u.apellidos].filter(Boolean).join(" ") ||
          "—",
        correo: u.correo || u.email || "—",
        telefono: u.telefono || "—",
        tipoEvento: "—",
        fecha: "—",
        fechaAt: null,
        creadaEn: "—",
        creadaAt: null,
        hora: "—",
        cantidadPersonas: "—",
        estado: u.activo ? "Activo" : "Inactivo",
        descripcion: "",
        raw: u,
        // columnas de pago no aplican a usuarios
        pagoEstado: "—",
        pagoInfo: null,
      }));

      // --- Reservas (cotización | evento) ---
      const reservasRows = (reservas || []).map((r) => {
        const createdFallback =
          r.createdAt ||
          r.fechaCreacion ||
          r.fechaRegistro ||
          r.created ||
          r.fechaAlta ||
          r._createdAt ||
          null;

        const tipoRes = String(r.tipoReserva || "cotizacion")
          .toLowerCase()
          .trim();
        const tipoUI = tipoRes === "evento" ? "Evento" : "Cotización";

        // Estado derivado por tipo
        const estadoUI =
          tipoRes === "cotizacion" ? "Pendiente" : r.estado || "Confirmada";

        return {
          _uid: `res-${r._id}`,
          _id: r._id,
          folio: r.folio || "", // ✅ este es el ID corto del PDF (C2DFFC0C)
          fuente: "reservas",
          tipoReserva: tipoRes, // 'cotizacion' | 'evento'
          tipo: tipoUI, // "Cotización" | "Evento"

          cliente: r.cliente || "—",
          correo: r.correo || "—",
          telefono: r.telefono || "—",
          tipoEvento: r.tipoEvento || "—",

          fecha: r.fecha ? fmtDate(r.fecha) : "—",
          fechaAt: r.fecha ? new Date(r.fecha).toISOString() : null,
          creadaEn: createdFallback ? fmtDateTime(createdFallback) : "—",
          creadaAt: createdFallback
            ? new Date(createdFallback).toISOString()
            : null,

          hora:
            r.horaInicio && r.horaFin
              ? `${r.horaInicio}–${r.horaFin}`
              : r.horaInicio || r.horaFin || "—",

          cantidadPersonas:
            typeof r.cantidadPersonas === "number"
              ? r.cantidadPersonas
              : r.cantidadPersonas || "—",

          estado: estadoUI,
          descripcion: r.descripcion || "",
          raw: r,
        };
      });

      // Enriquecer reservas con estado de pago usando /reservas/:id/saldo
      const reservasEnriquecidas = await Promise.all(
        reservasRows.map(async (row) => {
          if (row.fuente !== "reservas" || row.tipoReserva !== "evento" || !row._id) {
            return { ...row, pagoEstado: "—", pagoInfo: null };
          }
          try {
            const r = await fetch(`${API_BASE_URL}/reservas/${row._id}/saldo`, { headers: authHeaders() });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const { total = 0, paid = 0, remaining = 0 } = await r.json();
            const pagoEstado = remaining > 0.0001 ? "Pendiente" : "Pagado";
            return { ...row, pagoEstado, pagoInfo: { total, paid, remaining } };
          } catch {
            return { ...row, pagoEstado: "—", pagoInfo: null };
          }
        })
      );

      setRows([...registrados, ...reservasEnriquecidas]);
    } catch (e) {
      console.error(e);
      setError("No pude cargar los datos de clientes/reservas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Pestañas
  const filteredByTab = useMemo(() => {
    if (tab === "registrados") return rows.filter((r) => r.tipo === "Evento");
    if (tab === "cotizaciones") return rows.filter((r) => r.tipo === "Cotización");
    return rows;
  }, [rows, tab]);

  // Búsqueda
  // Búsqueda
const filtered = useMemo(() => {
  const raw = q.trim().toLowerCase();
  if (!raw) return filteredByTab;

  // permite buscar con o sin "#"
  const k = raw.replace(/^#/, "");

  const norm = (v) => String(v ?? "").toLowerCase().replace(/^#/, "");

  return filteredByTab.filter((r) =>
    [
      r._id,     // mongo id largo
      r.folio,   // ✅ id corto del PDF (C2DFFC0C)
      r._uid,
      r.cliente,
      r.correo,
      r.telefono,
      r.tipoEvento,
      r.fecha,
      r.creadaEn,
      r.hora,
      r.estado,
      r.tipo,
      r.pagoEstado,
    ]
      .filter(Boolean)
      .some((v) => norm(v).includes(k))
  );
}, [filteredByTab, q]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [q, tab]);

  const badgeClass = (estado) => {
    const e = String(estado || "").toLowerCase();
    if (e.includes("activo") || e.includes("confirm")) return "badge success";
    if (e.includes("pend")) return "badge warning";
    if (e.includes("cancel")) return "badge danger";
    return "badge";
  };

  // Las filas entran escalonadas al cargar y al cambiar de página o pestaña (solo visual).
  useEffect(() => {
    const cont = tablaRef.current;
    if (!cont || loading || paginated.length === 0) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    animate(cont.querySelectorAll("tbody tr"), { opacity: [0, 1], translateY: [10, 0], delay: stagger(28), duration: 420, ease: "outCubic" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, page, tab]);

  const abrirPanelCliente = (row) => {
  // solo reservas pueden abrir el panel
  if (row.fuente !== "reservas" || !row._id) {
    aviso("Este registro no es una reserva.");
    return;
  }

  const tipo = row.tipoReserva || "cotizacion"; // 'cotizacion' | 'evento'
  const qs = new URLSearchParams({
    reservaId: String(row._id),
    mode: "admin",
    tipo: String(tipo),
  }).toString();

  // abre en nueva pestaña (como tu dashboard admin)
  window.open(`/cliente/dashboard?${qs}`, "_blank", "noopener,noreferrer");
};

  return (
    <div className="clientes-container">
      <div className="clientes-header">
        <div className="cl-title-row">
          <h2>Clientes</h2>
          <span className="cl-count">{filtered.length}</span>
        </div>
        <div className="toolbar">
          <div className="tabs">
            <button
              className={tab === "todos" ? "tab active" : "tab"}
              onClick={() => setTab("todos")}
            >
              Todos
            </button>
            <button
              className={tab === "registrados" ? "tab active" : "tab"}
              onClick={() => setTab("registrados")}
            >
              Registrados
            </button>
            <button
              className={tab === "cotizaciones" ? "tab active" : "tab"}
              onClick={() => setTab("cotizaciones")}
            >
              Cotizaciones
            </button>
          </div>

          <SearchField
            placeholder="Buscar por nombre, correo, teléfono, evento o ID…"
            value={q}
            onChange={setQ}
            style={{ flex: "1 1 260px", minWidth: 220 }}
          />
          <button className="refresh" onClick={fetchData} disabled={loading}>
            <LuRefreshCw className={loading ? "cl-spin" : ""} aria-hidden="true" />
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrapper" ref={tablaRef}>
        <table className="clientes-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tipo</th>
              <th>Cliente</th>
              <th>Correo</th>
              <th>Teléfono</th>
              <th>Evento</th>
              <th>Fecha</th>
              <th>Creada</th>
              <th>Hora</th>
              <th>Personas</th>
              <th>Pago</th> {/* NUEVA */}
              <th>Estado</th>
              <th style={{ width: 160 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && !loading && (
              <tr>
                <td colSpan="13" className="empty"><LuInbox aria-hidden="true" /> Sin resultados</td>
              </tr>
            )}

            {paginated.map((r, idx) => (
              <tr key={r._uid}>
                <td>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                <td>
                  <span
                    className={`chip ${
                      r.fuente === "usuarios"
                        ? "chip-reg"
                        : r.tipoReserva === "evento"
                        ? "chip-event"
                        : "chip-cot"
                    }`}
                  >
                    {r.tipo}
                  </span>
                </td>

                <td className="nombre">
                  <div className="cl-name">
                    <span className="cl-avatar" aria-hidden="true">{inicial(r.cliente)}</span>
                    <span>{r.cliente}</span>
                  </div>
                </td>
                <td className="correo">{r.correo}</td>
                <td>{r.telefono}</td>
                <td>{r.tipoEvento}</td>
                <td>{r.fecha}</td>
                <td>{r.creadaEn}</td>
                <td>{r.hora}</td>
                <td style={{ textAlign: "center" }}>{r.cantidadPersonas}</td>

                {/* COLUMNA PAGO */}
                <td>
                  {r.fuente === "reservas" && r.tipoReserva === "evento" ? (
                    <span
                      className={payBadgeClass(r.pagoEstado)}
                      title={
                        r.pagoInfo
                          ? `Total: $${Number(r.pagoInfo.total || 0).toFixed(
                              2
                            )} • Pagado: $${Number(
                              r.pagoInfo.paid || 0
                            ).toFixed(2)} • Saldo: $${Number(
                              r.pagoInfo.remaining || 0
                            ).toFixed(2)}`
                          : ""
                      }
                    >
                      {r.pagoEstado}
                    </span>
                  ) : (
                    <span className="badge">—</span>
                  )}
                </td>

                <td>
                  <span className={badgeClass(r.estado)}>{r.estado}</span>
                </td>

                <td className="acciones">
                  <button
  className="btn btn-light"
  title="Ver panel del cliente"
  onClick={() => {
    if (r.fuente === "reservas" && r._id) {
      const url = `/cliente/dashboard?reservaId=${r._id}&mode=admin`;
      window.open(url, "_blank");
    } else {
      aviso("Este cliente no tiene una reserva asociada.");
    }
  }}
>
  <LuEye aria-hidden="true" /> <span className="cl-btn-text">Ver</span>
</button>
                  {r.fuente === "reservas" && r._id && (
                    <button
                      className="btn"
                      title="Descargar PDF"
                      onClick={() =>
                        window.open(
                          `${API_BASE_URL}/reservas/${r._id}/pdf`,
                          "_blank"
                        )
                      }
                    >
                      <LuFileDown aria-hidden="true" /> <span className="cl-btn-text">PDF</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          className="pager"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          <LuChevronLeft aria-label="Anterior" />
        </button>
        <span className="page-info">
          Página {page} de {totalPages}
        </span>
        <button
          className="pager"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          <LuChevronRight aria-label="Siguiente" />
        </button>
      </div>
    </div>
  );
}
