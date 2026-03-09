const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const controller = require('../../controllers/dashboard.controller');
const authenticate = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validator.middleware');

router.get('/users', authenticate, controller.getUsers);
router.get('/vnpay-transactions', authenticate, controller.getVnpayTransactions);
router.put('/users/:id/reset-password', authenticate, controller.resetUserPassword);
router.put('/users/:id/lock', authenticate, controller.setUserLock);
router.post(
  '/users/:id/balance/add',
  authenticate,
  [
    body('amount').notEmpty().withMessage('Số tiền là bắt buộc').isFloat({ gt: 0 }).withMessage('Số tiền phải > 0'),
    validate,
  ],
  controller.addUserBalance
);
router.post(
  '/users/:id/balance/set',
  authenticate,
  [
    body('balance').notEmpty().withMessage('Số dư là bắt buộc').isFloat({ min: 0 }).withMessage('Số dư phải >= 0'),
    validate,
  ],
  controller.setUserBalance
);
router.delete('/users/:id', authenticate, controller.deleteUser);

module.exports = router;
