require('dotenv').config();
const mongoose = require('mongoose');
const Reserva = require('../models/Reservas');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const q = { $or: [{ shortId: { $exists: false } }, { shortId: '' }, { shortId: null }] };
    const list = await Reserva.find(q).select('_id shortId').lean();

    let n = 0;
    for (const r of list) {
      const shortId = String(r._id).slice(-8).toUpperCase();
      await Reserva.updateOne({ _id: r._id }, { $set: { shortId } });
      n++;
    }

    console.log('✅ Backfill shortId completado. Actualizados:', n);
    process.exit(0);
  } catch (e) {
    console.error('❌ Backfill error:', e);
    process.exit(1);
  }
})();