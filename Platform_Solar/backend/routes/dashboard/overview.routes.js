const express = require('express');
const router = express.Router();
const controller = require('../../controllers/dashboard.controller');
const authenticate = require('../../middleware/auth.middleware');

// Tổng quan: stats, widget recent, charts
router.get('/stats', authenticate, controller.getStats);
router.get('/stations/recent', authenticate, controller.getRecentChargePoints);
router.get('/transactions', authenticate, controller.getRecentTransactions);
router.get('/charts/energy-today', authenticate, controller.getEnergyByHourToday);
router.get('/charts/revenue-7-days', authenticate, controller.getRevenueLast7Days);

module.exports = router;
