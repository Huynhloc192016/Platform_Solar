const express = require('express');
const router = express.Router();
const controller = require('../../controllers/dashboard.controller');
const authenticate = require('../../middleware/auth.middleware');

router.get('/owners', authenticate, controller.getOwners);
router.get('/owners/:id', authenticate, controller.getOwnerById);
router.post('/owners', authenticate, controller.createOwner);
router.put('/owners/:id', authenticate, controller.updateOwner);
router.delete('/owners/:id', authenticate, controller.deleteOwner);
router.post('/owners/:id/account', authenticate, controller.createOrResetOwnerAccount);

module.exports = router;
