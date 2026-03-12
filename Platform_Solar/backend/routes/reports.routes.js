const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth.middleware');
const reportsController = require('../controllers/reports.controller');

router.get('/kpi', authenticate, reportsController.getReportsKpi);
router.get('/energy', authenticate, reportsController.getEnergyTrend);
router.get('/revenue', authenticate, reportsController.getRevenueTrend);
router.get('/top-stations', authenticate, reportsController.getTopStations);
router.get('/sessions-by-hour', authenticate, reportsController.getSessionsByHour);
router.get('/utilization', authenticate, reportsController.getUtilization);

module.exports = router;

