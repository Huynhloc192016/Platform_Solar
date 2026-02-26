const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const dashboardController = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/auth.middleware');
const validate = require('../middleware/validator.middleware');

const VALID_OUTPUT_TYPES = ['AC', 'DC'];

router.get('/stats', authenticate, dashboardController.getStats);
router.get('/stations', authenticate, dashboardController.getStations);
router.post('/stations', authenticate, dashboardController.createStation);
router.put('/stations/:id', authenticate, dashboardController.updateStation);
router.delete('/stations/:id', authenticate, dashboardController.deleteStation);
router.get('/owners', authenticate, dashboardController.getOwners);
router.get('/owners/:id', authenticate, dashboardController.getOwnerById);
router.post('/owners', authenticate, dashboardController.createOwner);
router.put('/owners/:id', authenticate, dashboardController.updateOwner);
router.delete('/owners/:id', authenticate, dashboardController.deleteOwner);
router.get('/chargepoints', authenticate, dashboardController.getChargePoints);
router.post(
  '/chargepoints',
  authenticate,
  [
    body('ChargePointId').notEmpty().withMessage('ID trụ là bắt buộc'),
    body('ChargeStationId').notEmpty().withMessage('Trạm sạc là bắt buộc'),
    body('outputType')
      .optional({ values: 'falsy' })
      .isIn(VALID_OUTPUT_TYPES)
      .withMessage(`Loại output phải là một trong: ${VALID_OUTPUT_TYPES.join(', ')}`),
    validate,
  ],
  dashboardController.createChargePoint
);
router.put(
  '/chargepoints/:id',
  authenticate,
  [
    body('outputType')
      .optional({ values: 'falsy' })
      .isIn(VALID_OUTPUT_TYPES)
      .withMessage(`Loại output phải là một trong: ${VALID_OUTPUT_TYPES.join(', ')}`),
    validate,
  ],
  dashboardController.updateChargePoint
);
router.delete('/chargepoints/:id', authenticate, dashboardController.deleteChargePoint);
router.get('/stations/recent', authenticate, dashboardController.getRecentChargePoints);
router.get('/transactions', authenticate, dashboardController.getRecentTransactions);
router.get('/sessions', authenticate, dashboardController.getChargingSessions);
router.put('/sessions/:id', authenticate, dashboardController.updateSession);
router.delete('/sessions/:id', authenticate, dashboardController.deleteSession);
router.get('/orders', authenticate, dashboardController.getChargingOrders);
router.put('/orders/:id', authenticate, dashboardController.updateOrder);
router.delete('/orders/:id', authenticate, dashboardController.deleteOrder);
router.get('/charts/energy-today', authenticate, dashboardController.getEnergyByHourToday);
router.get('/charts/revenue-7-days', authenticate, dashboardController.getRevenueLast7Days);

module.exports = router;
