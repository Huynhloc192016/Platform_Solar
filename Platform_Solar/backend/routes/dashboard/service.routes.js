const express = require('express');
const router = express.Router();
const controller = require('../../controllers/service.page.controller');
const authenticate = require('../../middleware/auth.middleware');

router.get('/service/mails', authenticate, controller.getMails);
router.get('/service/settings', authenticate, controller.getNotifySettings);
router.put('/service/settings', authenticate, controller.updateNotifySettings);
router.get('/service/zalo-logs', authenticate, controller.getZaloLogs);

module.exports = router;
