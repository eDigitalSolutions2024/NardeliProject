const express = require('express');
const router = express.Router();
const Reserva = require('../models/Reservas');

// Crear nueva reserva
router.post('/', async (req, res) => {
  try {
    const nuevaReserva = new Reserva(req.body);
    const reservaGuardada = await nuevaReserva.save();
    res.status(201).json(reservaGuardada);
  } catch (error) {
    console.error('Error al guardar la reserva:', error.message);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Obtener todas las reservas (para el calendario)
router.get('/', async (req, res) => {
  try {
    const reservas = await Reserva.find();
    res.json(reservas);
  } catch (error) {
    console.error('Error al obtener reservas:', error.message);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await Reserva.findByIdAndDelete(req.params.id);
    res.json({ message: 'Reserva eliminada' });
  } catch (error) {
    console.error('Error al eliminar:', error.message);
    res.status(500).json({ message: 'Error del servidor' });
  }
});


router.put('/:id', async (req, res) => {
  try {
    const actualizada = await Reserva.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(actualizada);
  } catch (error) {
    console.error('Error al actualizar:', error.message);
    res.status(500).json({ message: 'Error del servidor' });
  }
});


module.exports = router;
