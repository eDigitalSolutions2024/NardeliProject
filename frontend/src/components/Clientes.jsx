import React, { useEffect, useMemo, useState } from "react";
import API_BASE_URL from "../api";
import "./Clientes.css";

const PAGE_SIZE = 10;

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

      // Clientes registrados (estructura genérica de usuario)
      const registrados = (usuarios || []).map((u) => ({
        _uid: `reg-${u._id}`,
        fuente: "usuarios",
        tipo: "Registrado",
        // intenta formar nombre completo con lo que tengas
        cliente:
          u.nombre ||
          [u.nombre, u.apellido, u.apellidos].filter(Boolean).join(" ") ||
          "—",
        correo: u.correo || u.email || "—",
        telefono: u.telefono || "—",
        tipoEvento: "—",
        fecha: "—",
        hora: "—",
        cantidadPersonas: "—",
        estado: u.activo ? "Activo" : "Inactivo",
        raw: u,
      }));

      // Cotizaciones / Reservas (usa exactamente tus variables de ReservarEvento.jsx)
      const cotizaciones = (reservas || []).map((r) => ({
        _uid: `cot-${r._id}`,
        _id: r._id,
        fuente: "reservas",
        tipo: "Cotización",
        cliente: r.cliente || "—",
        correo: r.correo || "—",
        telefono: r.telefono || "—",
        tipoEvento: r.tipoEvento || "—",
        fecha: r.fecha ? new Date(r.fecha).toLocaleDateString("es-MX") : "—",
        hora:
          r.horaInicio && r.horaFin
            ? `${r.horaInicio}–${r.horaFin}`
            : r.horaInicio || r.horaFin || "—",
        cantidadPersonas:
          typeof r.cantidadPersonas === "number"
            ? r.cantidadPersonas
            : r.cantidadPersonas || "—",
        estado: r.estado || "Pendiente",
        descripcion: r.descripcion || "",
        raw: r,
      }));

      setRows([...registrados, ...cotizaciones]);
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
    if (tab === "registrados") return rows.filter((r) => r.tipo === "Registrado");
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
    if (e.includes("activo") || e.includes("confirmado")) return "badge success";
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
              <th>Hora</th>
              <th>Personas</th>
              <th>Estado</th>
              <th style={{ width: 160 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && !loading && (
              <tr>
                <td colSpan="11" className="empty">Sin resultados</td>
              </tr>
            )}

            {paginated.map((r, idx) => (
              <tr key={r._uid}>
                <td>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                <td>
                  <span className={`chip ${r.tipo === "Cotización" ? "chip-cot" : "chip-reg"}`}>
                    {r.tipo}
                  </span>
                </td>
                <td className="nombre">{r.cliente}</td>
                <td className="correo">{r.correo}</td>
                <td>{r.telefono}</td>
                <td>{r.tipoEvento}</td>
                <td>{r.fecha}</td>
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
