const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGO_URI_PROD;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('test');
  const reservas = db.collection('reservas');

  const docs = await reservas.find({
    tipoReserva: 'cotizacion',
    estado: { $ne: 'cancelada' },
  }).project({
    cliente: 1, fecha: 1, horaInicio: 1, horaFin: 1, createdAt: 1, holdLiberado: 1, estado: 1
  }).toArray();

  const delDia = docs.filter(d => {
    const f = new Date(d.fecha);
    return f.getUTCFullYear() === 2026 && f.getUTCMonth() === 11 && f.getUTCDate() === 5;
  });

  console.log('=== Cotizaciones activas para 2026-12-05 ===');
  console.log(JSON.stringify(delDia, null, 2));

  await client.close();
}

main().catch((e) => { console.error('ERROR', e); process.exit(1); });
