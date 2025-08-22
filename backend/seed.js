// backend/seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Usuario = require('./models/Usuario');

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const email = 'admintrador@nardeli.com';
    const plainPassword = '123456';

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const user = await Usuario.findOneAndUpdate(
      { email },
      {
        fullname: 'Administrador',
        email,
        password: hashedPassword,
        role: 'admin',
      },
      { upsert: true, new: true }
    );

    console.log('✅ Usuario creado/actualizado:', user.email);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en seed:', err);
    process.exit(1);
  }
})();
