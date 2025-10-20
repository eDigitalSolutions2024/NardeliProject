import React, { useEffect, useMemo, useState } from "react";
import API_BASE_URL from "../api";
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

export default function Clientes() {
  const [tab, setTab] = useState("todos"); // todos | registrados | cotizaciones
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  const fetchData = async () => {
  setLoading(true);
  setError("");
  try {
    const [usuariosRes, reservasRes] = await Promise.all([
      fetch(`${API_BASE_URL}/usuarios?rol=cliente`),
      fetch(`${API_BASE_URL}/reservas`),
    ]);

    const usuarios = usuariosRes.ok ? await usuariosRes.json() : [];
    const reservas = reservasRes.ok ? await reservasRes.json() : [];

    // --- Clientes registrados ---
    const registrados = (usuarios || []).map((u) => ({
      _uid: `reg-${u._id}`,
      fuente: "usuarios",
      tipoReserva: "registrado",            // para distinguir en UI si lo necesitas
      tipo: "Registrado",                   // etiqueta visible
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
    }));

    // --- Reservas (cotización | evento) ---
const reservasRows = (reservas || []).map((r) => {
  const createdFallback =
    r.createdAt || r.fechaCreacion || r.fechaRegistro ||
    r.created || r.fechaAlta || r._createdAt || null;

  const tipoRes = String(r.tipoReserva || "cotizacion").toLowerCase().trim();
  const tipoUI  = tipoRes === "evento" ? "Evento" : "Cotización";

  // Estado derivado por tipo:
  const estadoUI = tipoRes === "cotizacion"
    ? "Pendiente"
    : (r.estado || "Confirmada");

  return {
    _uid: `res-${r._id}`,
    _id: r._id,
    fuente: "reservas",
    tipoReserva: tipoRes,                 // 'cotizacion' | 'evento'
    tipo: tipoUI,                         // "Cotización" | "Evento"

    cliente: r.cliente || "—",
    correo: r.correo || "—",
    telefono: r.telefono || "—",
    tipoEvento: r.tipoEvento || "—",

    fecha: r.fecha ? fmtDate(r.fecha) : "—",
    fechaAt: r.fecha ? new Date(r.fecha).toISOString() : null,
    creadaEn: createdFallback ? fmtDateTime(createdFallback) : "—",
    creadaAt: createdFallback ? new Date(createdFallback).toISOString() : null,

    hora:
      r.horaInicio && r.horaFin
        ? `${r.horaInicio}–${r.horaFin}`
        : r.horaInicio || r.horaFin || "—",

    cantidadPersonas:
      typeof r.cantidadPersonas === "number"
        ? r.cantidadPersonas
        : r.cantidadPersonas || "—",

    estado: estadoUI,                     // ← aquí ya va “Pendiente” si es cotización
    descripcion: r.descripcion || "",
    raw: r,
  };
});


    setRows([...registrados, ...reservasRows]);
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
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return filteredByTab;
    return filteredByTab.filter((r) =>
      [
        r.cliente,
        r.correo,
        r.telefono,
        r.tipoEvento,
        r.fecha,
        r.creadaEn, // ← incluye fecha de creación en el buscador
        r.hora,
        r.estado,
        r.tipo,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(k))
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

  return (
    <div className="clientes-container">
      <div className="clientes-header">
        <h2>Clientes</h2>
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

          <input
            className="search"
            placeholder="Buscar por nombre, correo, teléfono, evento…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="refresh" onClick={fetchData} disabled={loading}>
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="table-wrapper">
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
              <th>Creada</th>{/* ← NUEVA COLUMNA */}
              <th>Hora</th>
              <th>Personas</th>
              <th>Estado</th>
              <th style={{ width: 160 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && !loading && (
              <tr>
                <td colSpan="12" className="empty">Sin resultados</td>
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

                <td className="nombre">{r.cliente}</td>
                <td className="correo">{r.correo}</td>
                <td>{r.telefono}</td>
                <td>{r.tipoEvento}</td>
                <td>{r.fecha}</td>
                <td>{r.creadaEn}</td>{/* ← valor mostrado */}
                <td>{r.hora}</td>
                <td style={{ textAlign: "center" }}>{r.cantidadPersonas}</td>
                <td>
                  <span className={badgeClass(r.estado)}>{r.estado}</span>
                </td>
                <td className="acciones">
                  <button
                    className="btn btn-light"
                    onClick={() => console.log("Detalle:", r)}
                  >
                    Ver
                  </button>
                  {r.fuente === "reservas" && r._id && (
                    <button
                      className="btn"
                      onClick={() =>
                        window.open(`${API_BASE_URL}/reservas/${r._id}/pdf`, "_blank")
                      }
                    >
                      PDF
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
          ←
        </button>
        <span className="page-info">
          Página {page} de {totalPages}
        </span>
        <button
          className="pager"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          →
        </button>
      </div>
    </div>
  );
}
