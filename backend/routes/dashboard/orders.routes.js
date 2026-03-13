const express = require('express');
const router = express.Router();
const controller = require('../../controllers/dashboard.controller');
const authenticate = require('../../middleware/auth.middleware');

router.get('/orders', authenticate, controller.getChargingOrders);
router.put('/orders/:id', authenticate, controller.updateOrder);
router.delete('/orders/:id', authenticate, controller.deleteOrder);

module.exports = router;
