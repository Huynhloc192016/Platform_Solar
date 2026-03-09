const express = require('express');
const router = express.Router();
const controller = require('../../controllers/dashboard.controller');
const authenticate = require('../../middleware/auth.middleware');

router.get('/daily', authenticate, controller.getRevenueDaily);
router.get('/monthly', authenticate, controller.getRevenueMonthly);

module.exports = router;
