const express = require('express');
const router = express.Router();
const controller = require('../../controllers/dashboard.controller');
const authenticate = require('../../middleware/auth.middleware');

router.get('/summary', authenticate, controller.getTransactionSummary);

module.exports = router;
