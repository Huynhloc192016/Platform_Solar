const express = require('express');
const router = express.Router();
const zaloController = require('../controllers/zalo.controller');

// Callback Zalo OA — không dùng auth middleware (Zalo gọi từ bên ngoài)
// URL: https://platformsolarev.vn/api/zalo/oa/callback
router.get('/oa/callback', zaloController.getOACallback);
router.post('/oa/callback', zaloController.postOACallback);

// Webhook Zalo — https://platformsolarev.vn/api/zalo/webhook
// GET: xác thực URL (cùng tham số hub.verify_token, hub.challenge theo mặc định Zalo)
// POST: nhận sự kiện (body có thể là { ok, result: { event_name, message } } hoặc { event_name, ... })
router.get('/webhook', zaloController.getOACallback);
router.post('/webhook', zaloController.postOACallback);

module.exports = router;
