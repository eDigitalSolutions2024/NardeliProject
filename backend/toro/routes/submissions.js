const express = require('express');
const {
  createSubmission,
  listSubmissions,
  getSubmission,
} = require('../controllers/submissionController');

const router = express.Router();

router.get('/', listSubmissions);
router.get('/:id', getSubmission);
router.post('/', createSubmission);

module.exports = router;
