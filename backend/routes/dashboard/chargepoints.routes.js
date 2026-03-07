const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const controller = require('../../controllers/dashboard.controller');
const authenticate = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validator.middleware');

const VALID_OUTPUT_TYPES = ['AC', 'DC'];

router.get('/chargepoints', authenticate, controller.getChargePoints);
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
  controller.createChargePoint
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
  controller.updateChargePoint
);
router.delete('/chargepoints/:id', authenticate, controller.deleteChargePoint);
router.post('/chargepoints/:id/stop-session', authenticate, controller.stopChargingSession);

module.exports = router;
