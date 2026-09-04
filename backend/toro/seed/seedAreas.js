require('dotenv').config();
const toroConnection = require('../db');
const Area = require('../models/Area');

const areas = [
  {
    name: 'Cocina',
    icon: '🍳',
    order: 1,
    items: [
      { text: 'Superficies de trabajo limpias y desinfectadas', order: 1 },
      { text: 'Temperatura de refrigeradores verificada y registrada', order: 2 },
      { text: 'Campana y extractor de grasa limpios', order: 3 },
      { text: 'Cuchillos y utensilios en su lugar y en buen estado', order: 4 },
      { text: 'Piso limpio, seco y libre de obstáculos', order: 5 },
      { text: 'Insumos etiquetados con fecha de caducidad visible', order: 6 },
    ],
  },
  {
    name: 'Cámara Fría y Congeladores',
    icon: '❄️',
    order: 2,
    items: [
      { text: 'Temperatura dentro del rango permitido (registro)', order: 1 },
      { text: 'Puertas cierran y sellan correctamente', order: 2 },
      { text: 'Sin acumulación excesiva de hielo/escarcha', order: 3 },
      { text: 'Productos organizados por fecha (PEPS)', order: 4 },
    ],
  },
  {
    name: 'Almacén / Bodega Seca',
    icon: '📦',
    order: 3,
    items: [
      { text: 'Productos organizados y rotación PEPS aplicada', order: 1 },
      { text: 'Piso y estantes limpios, sin señales de plagas', order: 2 },
      { text: 'Temperatura y ventilación adecuadas', order: 3 },
      { text: 'Productos químicos separados de alimentos', order: 4 },
    ],
  },
  {
    name: 'Área de Lavado (Loza y Utensilios)',
    icon: '🧽',
    order: 4,
    items: [
      { text: 'Lavaloza funcionando correctamente', order: 1 },
      { text: 'Loza, vasos y cubiertos sin residuos ni manchas', order: 2 },
      { text: 'Área de secado limpia y ordenada', order: 3 },
      { text: 'Detergentes y químicos con nivel suficiente', order: 4 },
    ],
  },
  {
    name: 'Bar / Barra de Bebidas',
    icon: '🍸',
    order: 5,
    items: [
      { text: 'Cristalería limpia, sin manchas ni cachaduras', order: 1 },
      { text: 'Inventario de licores y bebidas verificado', order: 2 },
      { text: 'Hielo repuesto, limpio y en contenedor adecuado', order: 3 },
      { text: 'Superficie de barra desinfectada', order: 4 },
      { text: 'Frutas y guarniciones frescas preparadas', order: 5 },
    ],
  },
  {
    name: 'Salón / Comedor',
    icon: '🍽️',
    order: 6,
    items: [
      { text: 'Mesas y sillas limpias y correctamente acomodadas', order: 1 },
      { text: 'Manteles y servilletas en buen estado', order: 2 },
      { text: 'Iluminación y climatización funcionando', order: 3 },
      { text: 'Menús limpios, completos y disponibles', order: 4 },
      { text: 'Música/ambiente configurado', order: 5 },
    ],
  },
  {
    name: 'Recepción / Host',
    icon: '🛎️',
    order: 7,
    items: [
      { text: 'Podio de recepción limpio y ordenado', order: 1 },
      { text: 'Lista de reservaciones del día revisada', order: 2 },
      { text: 'Sistema de espera / turnos funcionando', order: 3 },
    ],
  },
  {
    name: 'Baños',
    icon: '🚻',
    order: 8,
    items: [
      { text: 'Papel higiénico, jabón y toallas repuestos', order: 1 },
      { text: 'Pisos y sanitarios limpios y sin malos olores', order: 2 },
      { text: 'Espejos y lavabos limpios', order: 3 },
      { text: 'Botes de basura vacíos', order: 4 },
    ],
  },
  {
    name: 'Terraza / Área Exterior',
    icon: '🌤️',
    order: 9,
    items: [
      { text: 'Mobiliario exterior limpio y en buen estado', order: 1 },
      { text: 'Área libre de basura', order: 2 },
      { text: 'Sombrillas/calefactores funcionando', order: 3 },
    ],
  },
  {
    name: 'Estacionamiento / Valet',
    icon: '🚗',
    order: 10,
    items: [
      { text: 'Señalización visible y en buen estado', order: 1 },
      { text: 'Iluminación exterior funcionando', order: 2 },
      { text: 'Área libre de basura y obstáculos', order: 3 },
    ],
  },
  {
    name: 'Oficina / Caja',
    icon: '💼',
    order: 11,
    items: [
      { text: 'Sistema de punto de venta (POS) funcionando', order: 1 },
      { text: 'Efectivo inicial de caja verificado', order: 2 },
      { text: 'Documentos y reportes del día listos', order: 3 },
    ],
  },
  {
    name: 'Seguridad y Emergencias',
    icon: '🧯',
    order: 12,
    items: [
      { text: 'Extintores en su lugar, cargados y con revisión vigente', order: 1 },
      { text: 'Salidas de emergencia despejadas y señalizadas', order: 2 },
      { text: 'Botiquín de primeros auxilios completo', order: 3 },
      { text: 'Cámaras de seguridad operando', order: 4 },
    ],
  },
];

async function seed() {
  await toroConnection.asPromise();
  await Area.deleteMany({});
  await Area.insertMany(areas);
  console.log(`[Toro] Se insertaron ${areas.length} áreas.`);
  await toroConnection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
