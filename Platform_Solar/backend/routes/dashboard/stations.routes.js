const express = require('express');
const router = express.Router();
const controller = require('../../controllers/dashboard.controller');
const authenticate = require('../../middleware/auth.middleware');

router.get('/stations', authenticate, controller.getStations);
router.post('/stations', authenticate, controller.createStation);
router.put('/stations/:id', authenticate, controller.updateStation);
router.delete('/stations/:id', authenticate, controller.deleteStation);

module.exports = router;
