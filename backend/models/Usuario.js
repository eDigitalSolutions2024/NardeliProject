const mongoose = require('mongoose');

const UsuarioSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    email: { type: String, required: true, unique: true},
    password: {type: String, required: true}
});

module.export = mongoose.model('Usuario', UsuarioSchema);