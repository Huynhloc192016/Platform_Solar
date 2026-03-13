const express = require('express');
const router = express.Router();
const controller = require('../../controllers/dashboard.controller');
const authenticate = require('../../middleware/auth.middleware');

router.get('/sessions', authenticate, controller.getChargingSessions);
router.put('/sessions/:id', authenticate, controller.updateSession);
router.delete('/sessions/:id', authenticate, controller.deleteSession);

module.exports = router;
