const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            userNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('Conexion a MongoDB exitosa papu pro');
    } catch (error) {
        console.error('Error al conectar a MongoDB: ', error.message);
        process.exir(1);
    }
};

module.exports = connectDB;