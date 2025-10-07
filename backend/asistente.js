// scripts/seed-asistente.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Usuario = require('./models/Usuario');

(async () => {
  try {
    // --- Conexión a Mongo ---
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('❌ Falta la variable MONGODB_URI en el .env');
    await mongoose.connect(uri);
    console.log('✅ Conectado a MongoDB Atlas');

    // --- Datos del usuario a crear ---
    const email = process.env.SEED_ASIST_EMAIL || 'asistente@nardeli.com';
    const fullname = process.env.SEED_ASIST_NAME || 'Asistente Nardeli';
    const rawPass = process.env.SEED_ASIST_PASS || 'asistente123';

    // --- Verificar si ya existe ---
    const existing = await Usuario.findOne({ email });
    if (existing) {
      console.log(`⚠️ Ya existe un usuario con el correo: ${email}`);
      process.exit(0);
    }

    // --- Crear el hash de la contraseña ---
    const password = await bcrypt.hash(rawPass, 10);

    // --- Crear el nuevo usuario ---
    const nuevoUsuario = await Usuario.create({
      fullname,
      email,
      password,
      role: 'asistente',      // 👈 rol en español
      emailVerified: true,
    });

    console.log('🎉 Usuario asistente creado correctamente');
    console.log('📧 Email:', nuevoUsuario.email);
    console.log('🔑 Contraseña temporal:', rawPass);
    console.log('👤 Rol:', nuevoUsuario.role);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error al crear el usuario asistente:', err);
    process.exit(1);
  }
})();
