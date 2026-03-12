const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const dashboardRoutes = require('./dashboard/index');
const reportsRoutes = require('./reports.routes');
const zaloRoutes = require('./zalo.routes');

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportsRoutes);
router.use('/zalo', zaloRoutes);

module.exports = router;
