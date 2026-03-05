require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Accesorio = require("../models/Accesorio");

const accesorios = [
  { nombre: "Mantel blanco rectangular", categoria: "Textil", unidad: "pza", stock: 40, precioReposicion: 250, esPrestamo: true, activo: true, descripcion: "Mantel blanco para mesas rectangulares.", imagen: "" },
  { nombre: "Mantel blanco redondo", categoria: "Textil", unidad: "pza", stock: 25, precioReposicion: 260, esPrestamo: true, activo: true, descripcion: "Mantel blanco para mesas redondas.", imagen: "" },
  { nombre: "Funda silla Tiffany blanca", categoria: "Textil", unidad: "pza", stock: 120, precioReposicion: 90, esPrestamo: true, activo: true, descripcion: "Funda para silla tipo Tiffany.", imagen: "" },
  { nombre: "Lazo para silla (color beige)", categoria: "Decoración", unidad: "pza", stock: 120, precioReposicion: 35, esPrestamo: true, activo: true, descripcion: "Lazo decorativo para silla.", imagen: "" },
  { nombre: "Camino de mesa (dorado)", categoria: "Decoración", unidad: "pza", stock: 20, precioReposicion: 180, esPrestamo: true, activo: true, descripcion: "Camino de mesa color dorado.", imagen: "" },
  { nombre: "Serie de luces cálidas 10m", categoria: "Iluminación", unidad: "pza", stock: 12, precioReposicion: 220, esPrestamo: true, activo: true, descripcion: "Serie de luces tipo warm white.", imagen: "" },
  { nombre: "Centro de mesa básico", categoria: "Decoración", unidad: "pza", stock: 15, precioReposicion: 300, esPrestamo: true, activo: true, descripcion: "Centro de mesa básico (sin flor natural).", imagen: "" },
  { nombre: "Plato base (dorados)", categoria: "Vajilla", unidad: "pza", stock: 100, precioReposicion: 45, esPrestamo: true, activo: true, descripcion: "Plato base decorativo.", imagen: "" },
  { nombre: "Copa cristal", categoria: "Vajilla", unidad: "pza", stock: 80, precioReposicion: 60, esPrestamo: true, activo: true, descripcion: "Copa de cristal para brindis.", imagen: "" },
  { nombre: "Servilleta (tela) color champagne", categoria: "Textil", unidad: "pza", stock: 120, precioReposicion: 25, esPrestamo: true, activo: true, descripcion: "Servilleta de tela color champagne.", imagen: "" }
];

async function main() {
  const out = path.join(process.cwd(), "seed_accesorios.json");
  fs.writeFileSync(out, JSON.stringify(accesorios, null, 2), "utf-8");
  console.log("✅ JSON generado:", out);

  // Si quieres insertar también, corre con: node scripts/seed_accesorios.js --insert
  const doInsert = process.argv.includes("--insert");
  if (!doInsert) return;

  if (!process.env.MONGO_URI) throw new Error("Falta MONGO_URI en .env");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Conectado a MongoDB");

  // Evita duplicados por nombre
  const ops = accesorios.map((a) => ({
    updateOne: {
      filter: { nombre: a.nombre },
      update: { $setOnInsert: a },
      upsert: true
    }
  }));

  await Accesorio.bulkWrite(ops);

  const inserted = await Accesorio.find({ nombre: { $in: accesorios.map(a => a.nombre) } })
    .select("_id nombre categoria unidad stock precioReposicion esPrestamo activo")
    .lean();

  console.log("✅ Accesorios (IDs para usar en reservas):");
  inserted.forEach(x => console.log(String(x._id), "-", x.nombre));

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("❌ Error:", e.message || e);
  process.exit(1);
});