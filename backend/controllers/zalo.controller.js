const crypto = require('crypto');
const zaloService = require('../services/zalo.service');

const ZALO_VERIFY_TOKEN_KEY = 'ZALO_OA_VERIFY_TOKEN';
const ZALO_CALLBACK_SECRET_KEY = 'ZALO_OA_APP_SECRET_KEY';

/**
 * Tạo chữ ký Zalo webhook: sha256(content + apiKey).
 * content = nối giá trị các field trong body (object) đã sort A-Z; object con → JSON.stringify.
 * @param {object} data - Raw body object
 * @param {string} apiKey - ZALO_OA_APP_SECRET_KEY
 * @returns {string} hex signature
 */
function buildZaloSignature(data, apiKey) {
  const keys = Object.keys(data).sort();
  let content = '';
  for (const k of keys) {
    let value = data[k];
    if (value !== null && typeof value === 'object') {
      value = JSON.stringify(value);
    }
    content += String(value ?? '');
  }
  return crypto.createHash('sha256').update(content + (apiKey || '')).digest('hex');
}

/**
 * GET /api/zalo/oa/callback hoặc /api/zalo/webhook.
 * - Nếu có query code (OAuth callback từ Zalo): đổi code lấy access_token + refresh_token, ghi DB, trả trang thành công.
 * - Nếu có hub.verify_token + hub.challenge (xác thực webhook): trả lại hub.challenge.
 */
const getOACallback = async (req, res) => {
  const code = req.query.code;
  if (code) {
    const result = await zaloService.exchangeCodeForToken(code);
    if (result.success) {
      return res.status(200).send(
        '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zalo OA</title></head><body>' +
          '<p style="font-family:sans-serif;">Đã lấy token thành công. Bạn có thể đóng trang này.</p>' +
          '</body></html>'
      );
    }
    return res.status(400).send(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Lỗi</title></head><body>' +
        '<p style="font-family:sans-serif;color:red;">Lỗi: ' + (result.error || 'Unknown') + '</p>' +
        '</body></html>'
    );
  }

  const verifyToken = process.env[ZALO_VERIFY_TOKEN_KEY];
  const sentToken = req.query['hub.verify_token'] ?? req.query.verify_token ?? '';
  const challenge = req.query['hub.challenge'] ?? req.query.challenge ?? '';

  if (!verifyToken || !String(verifyToken).trim()) {
    console.warn('[Zalo Webhook] GET: ZALO_OA_VERIFY_TOKEN chưa cấu hình.');
    return res.status(503).send('Verify token not configured');
  }

  if (sentToken !== String(verifyToken).trim()) {
    return res.status(403).send('Invalid verify token');
  }

  // Zalo mặc định: trả lại đúng chuỗi challenge (text) để xác thực URL
  res.status(200).send(String(challenge));
};

/**
 * POST /api/zalo/oa/callback hoặc /api/zalo/webhook — Nhận sự kiện từ Zalo.
 * Zalo gửi: Content-Type application/json. Body có thể:
 * - Dạng OA: { event_name, ... } hoặc có field khác.
 * - Dạng Bot (Zapps): { ok: true, result: { event_name, message } }.
 * Bảo mật: X-Zalo-Signature (sha256 body + APP_SECRET) hoặc X-Bot-Api-Secret-Token (so khớp ZALO_OA_VERIFY_TOKEN).
 * Theo mặc định Zalo: trả 200 ngay để xác nhận đã nhận, xử lý logic sau.
 */
const postOACallback = (req, res) => {
  const secretKey = process.env[ZALO_CALLBACK_SECRET_KEY];
  const verifyToken = process.env[ZALO_VERIFY_TOKEN_KEY];
  const signatureHeader = req.headers['x-zalo-signature'] || req.headers['X-Zalo-Signature'];
  const botSecretHeader = req.headers['x-bot-api-secret-token'] || req.headers['X-Bot-Api-Secret-Token'];

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Invalid body' });
  }

  // Verify: X-Zalo-Signature (OA) hoặc X-Bot-Api-Secret-Token (Bot/Zapps)
  if (signatureHeader && secretKey) {
    const expected = buildZaloSignature(req.body, secretKey);
    if (signatureHeader !== expected) {
      console.warn('[Zalo Webhook] POST: X-Zalo-Signature mismatch');
      return res.status(403).json({ error: 'Invalid signature' });
    }
  } else if (botSecretHeader) {
    if (!verifyToken || botSecretHeader !== String(verifyToken).trim()) {
      console.warn('[Zalo Webhook] POST: X-Bot-Api-Secret-Token mismatch');
      return res.status(403).json({ error: 'Invalid token' });
    }
  } else if (signatureHeader && !secretKey) {
    console.warn('[Zalo Webhook] POST: X-Zalo-Signature gửi đến nhưng ZALO_OA_APP_SECRET_KEY chưa cấu hình.');
  }

  // Trả 200 ngay theo mặc định Zalo để không bị retry/timeout
  res.status(200).json({ success: true });

  // Xử lý event bất đồng bộ
  setImmediate(() => {
    try {
      const body = req.body;
      const eventName = body.result?.event_name ?? body.event_name;
      const message = body.result?.message ?? body.message;
      const payload = { event_name: eventName, message, raw: body };
      console.log('[Zalo Webhook] Event:', eventName || 'unknown', JSON.stringify(payload).slice(0, 600));
      // TODO: switch event_name → message.text.received, follow, ...
    } catch (err) {
      console.error('[Zalo Webhook] Process event error:', err.message);
    }
  });
};

module.exports = {
  getOACallback,
  postOACallback,
};
