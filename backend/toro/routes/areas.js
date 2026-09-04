const express = require('express');
const { listAreas, getArea, createArea, updateArea } = require('../controllers/areaController');

const router = express.Router();

router.get('/', listAreas);
router.get('/:id', getArea);
router.post('/', createArea);
router.put('/:id', updateArea);

module.exports = router;
