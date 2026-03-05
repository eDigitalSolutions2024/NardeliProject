require("dotenv").config();
const mongoose = require("mongoose");
const Reserva = require("../models/Reservas");
const Producto = require("../models/Producto");
const Accesorio = require("../models/Accesorio");

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function randomTime(startHour, endHour) {
  const h = randInt(startHour, endHour);
  const m = pick([0, 15, 30, 45]);
  return `${pad2(h)}:${pad2(m)}`;
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

const nombres = [
  "Lorena Martínez", "Carlos Rivas", "María López", "Ana Torres", "Jorge Hernández",
  "Paola Castillo", "Luis Mendoza", "Fernanda Silva", "Ricardo Nava", "Sofía Aguirre"
];
const correosDom = ["gmail.com", "hotmail.com", "yahoo.com"];
const tiposEvento = ["Boda civil", "Cumpleaños", "Graduación", "Baby shower", "Posada", "XV años", "Bautizo", "Aniversario"];

function emailFromName(fullname) {
  const base = fullname
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".");
  return `${base}${randInt(1, 99)}@${pick(correosDom)}`;
}
function telefonoMx() {
  return `656${randInt(1000000, 9999999)}`;
}

function buildReserva({ productos, accesorios }) {
  const cliente = pick(nombres);
  const tipoEvento = pick(tiposEvento);

  const fecha = addDays(new Date(), randInt(-10, 180));
  const horaInicio = randomTime(12, 20);

  // horaFin simple (3 a 7 horas después) como string
  const startH = Number(horaInicio.slice(0, 2));
  const endH = (startH + randInt(3, 7)) % 24;
  const horaFin = `${pad2(endH)}:${horaInicio.slice(3, 5)}`;

  const cantidadPersonas = randInt(20, 160);
  const estado = pick(["confirmada", "confirmada", "confirmada", "borrador", "cancelada"]);
  const tipoReserva = estado === "borrador" ? "cotizacion" : pick(["evento", "evento", "cotizacion"]);

  // utensilios ligados a Producto
  const utensilios = [];
  const lines = randInt(1, 4);
  for (let k = 0; k < lines; k++) {
    const p = pick(productos);
    utensilios.push({
      itemId: p._id,
      nombre: p.nombre,
      cantidad: randInt(1, p.nombre.includes("Silla") ? 120 : 12),
      unidad: "pza",
      categoria: p.categoria,
      precio: p.precio,
      descripcion: p.descripcion || "",
      imagen: p.imagen || ""
    });
  }

  // accesorios ligados a Accesorio (_id como string)
  const accLines = randInt(0, 3);
  const accesoriosSel = [];
  for (let k = 0; k < accLines; k++) {
    const a = pick(accesorios);
    accesoriosSel.push({
      accesorioId: String(a._id),
      nombre: a.nombre,
      categoria: a.categoria,
      unidad: a.unidad,
      cantidad: randInt(1, Math.max(1, Math.min(20, a.stock || 10))),
      precioReposicion: a.precioReposicion || 0,
      descripcion: a.descripcion || "",
      imagen: a.imagen || "",
      esPrestamo: a.esPrestamo !== false
    });
  }

  const descTipo = pick(["monto", "porcentaje", "monto"]);
  const descValor = descTipo === "porcentaje" ? pick([0, 5, 10, 15]) : pick([0, 0, 50, 100, 200]);

  return {
    clienteId: null,
    cliente,
    correo: emailFromName(cliente),
    telefono: telefonoMx(),

    tipoEvento,
    fecha,
    horaInicio,
    horaFin,
    cantidadPersonas,
    descripcion: "",

    utensilios,
    resumenSeleccion: { accesorios: accesoriosSel },

    estado,
    tipoReserva,
    cotizacion: {
      aceptada: tipoReserva === "evento",
      aceptadaEn: tipoReserva === "evento" ? addDays(new Date(), randInt(-30, 0)) : null,
      nota: tipoReserva === "cotizacion" ? "Pendiente de confirmación." : ""
    },

    precios: {
      moneda: "MXN",
      descuento: { tipo: descTipo, valor: descValor, motivo: descValor ? "Promo seed" : "" },
      subtotal: 0,
      total: 0
    },

    pdfUrl: null,
    pdfPath: null
  };
}

async function main() {
  const N = Number(process.argv[2] || 30); // reservas a crear

  if (!process.env.MONGO_URI) throw new Error("Falta MONGO_URI en .env");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Conectado a MongoDB");

  const productos = await Producto.find({}).lean();
  const accesorios = await Accesorio.find({}).lean();

  if (!productos.length) throw new Error("No hay productos. Corre primero: node scripts/seed_productos.js --insert");
  if (!accesorios.length) console.warn("⚠️ No hay accesorios. (reservas se crearán sin accesorios)"); // no bloquea

  const docs = Array.from({ length: N }, () => buildReserva({ productos, accesorios: accesorios.length ? accesorios : [] }));

  // Inserta
  await Reserva.insertMany(docs);

  console.log(`✅ Insertadas ${N} reservas conectadas (productos/accesorios).`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("❌ Error:", e.message || e);
  process.exit(1);
});