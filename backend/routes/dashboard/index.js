/**
 * Gộp tất cả route dashboard theo domain.
 * Mount tại /dashboard → URL giữ nguyên /api/dashboard/*
 * Thứ tự: overview trước (có /stations/recent, /transactions), sau đó stations (có /stations/:id).
 */
const express = require('express');
const router = express.Router();

const overviewRoutes = require('./overview.routes');
const stationsRoutes = require('./stations.routes');
const chargepointsRoutes = require('./chargepoints.routes');
const ownersRoutes = require('./owners.routes');
const sessionsRoutes = require('./sessions.routes');
const ordersRoutes = require('./orders.routes');
const transactionsRoutes = require('./transactions.routes');
const usersRoutes = require('./users.routes');
const exportRoutes = require('./export.routes');

router.use(overviewRoutes);
router.use(stationsRoutes);
router.use(chargepointsRoutes);
router.use(ownersRoutes);
router.use(sessionsRoutes);
router.use(ordersRoutes);
router.use('/transactions', transactionsRoutes);
router.use(usersRoutes);
router.use('/export', exportRoutes);

module.exports = router;
