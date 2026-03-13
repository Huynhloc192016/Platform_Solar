const express = require('express');
const router = express.Router();
const authenticate = require('../../middleware/auth.middleware');
const controller = require('../../controllers/activity.page.controller');

router.get('/activity-logs', authenticate, controller.getActivityLogs);

module.exports = router;

