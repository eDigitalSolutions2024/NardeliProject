const express = require('express');
const {
  listAreas,
  getArea,
  createArea,
  updateArea,
  deleteArea,
  addItem,
  updateItem,
  deleteItem,
} = require('../controllers/areaController');

const router = express.Router();

router.get('/', listAreas);
router.get('/:id', getArea);
router.post('/', createArea);
router.put('/:id', updateArea);
router.delete('/:id', deleteArea);
router.post('/:id/items', addItem);
router.put('/:id/items/:itemId', updateItem);
router.delete('/:id/items/:itemId', deleteItem);

module.exports = router;
