const express = require('express');
const router = express.Router();
const controller = require('../../controllers/dashboard.controller');
const authenticate = require('../../middleware/auth.middleware');

router.get('/orders', authenticate, controller.exportOrdersForReport);

module.exports = router;
