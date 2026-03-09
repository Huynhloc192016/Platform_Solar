const https = require('https');
const { sequelize } = require('../config/database');

// Message API V3: endpoint /message/cs = customer service (tin chủ động từ hệ thống)
// Ref: https://developers.zalo.me/changelog/thong-bao-cap-nhat-phan-loai-tin-nhan-cua-zalo-official-account-7241
const ZALO_OA_MESSAGE_URL = 'https://openapi.zalo.me/v3.0/oa/message/cs';
const ZALO_OA_TOKEN_URL = 'https://oauth.zaloapp.com/v4/oa/access_token';

// Cache token trong bộ nhớ (đồng bộ với DB)
let cachedAccessToken = null;
let cachedRefreshToken = null;
let cachedExpiresAt = null; // ms, nếu Zalo trả expires_in

/**
 * Lấy token đã lưu từ bảng ZaloOAToken (Id = 1).
 * @returns {Promise<{ accessToken?: string, refreshToken?: string, expiresAt?: number }>}
 */
const getStoredTokens = async () => {
  try {
    const [row] = await sequelize.query(
      `SELECT AccessToken, RefreshToken, ExpiresAt FROM ZaloOAToken WHERE Id = 1`,
      { type: sequelize.QueryTypes.SELECT }
    );
    if (!row) return {};
    const accessToken = row.AccessToken && String(row.AccessToken).trim() ? String(row.AccessToken).trim() : null;
    const refreshToken = row.RefreshToken && String(row.RefreshToken).trim() ? String(row.RefreshToken).trim() : null;
    const expiresAt = row.ExpiresAt != null ? parseInt(row.ExpiresAt, 10) : null;
    return { accessToken, refreshToken, expiresAt: Number.isNaN(expiresAt) ? null : expiresAt };
  } catch (err) {
    console.warn('[ZaloService] getStoredTokens error:', err.message);
    return {};
  }
};

/**
 * Ghi access_token, refresh_token, expires_at (ms) vào ZaloOAToken.
 * Nếu refreshToken === undefined thì không đè RefreshToken trong DB.
 * @param {string|null} accessToken
 * @param {string|undefined} refreshToken - undefined = giữ nguyên RefreshToken trong DB
 * @param {number|null} expiresAtMs
 */
const saveStoredTokens = async (accessToken, refreshToken, expiresAtMs) => {
  try {
    if (refreshToken !== undefined) {
      await sequelize.query(
        `UPDATE ZaloOAToken SET AccessToken = :accessToken, RefreshToken = :refreshToken, ExpiresAt = :expiresAt, UpdatedAt = GETDATE() WHERE Id = 1`,
        {
          replacements: {
            accessToken: accessToken || null,
            refreshToken: refreshToken || null,
            expiresAt: expiresAtMs != null ? expiresAtMs : null,
          },
        }
      );
    } else {
      await sequelize.query(
        `UPDATE ZaloOAToken SET AccessToken = :accessToken, ExpiresAt = :expiresAt, UpdatedAt = GETDATE() WHERE Id = 1`,
        {
          replacements: {
            accessToken: accessToken || null,
            expiresAt: expiresAtMs != null ? expiresAtMs : null,
          },
        }
      );
    }
  } catch (err) {
    console.warn('[ZaloService] saveStoredTokens error:', err.message);
  }
};

/**
 * Xóa access token trong DB (khi phát hiện token invalid để ép refresh lần sau).
 */
const clearAccessTokenInDb = async () => {
  try {
    await sequelize.query(
      `UPDATE ZaloOAToken SET AccessToken = NULL, ExpiresAt = NULL, UpdatedAt = GETDATE() WHERE Id = 1`,
      {}
    );
  } catch (err) {
    console.warn('[ZaloService] clearAccessTokenInDb error:', err.message);
  }
};

/**
 * Đổi authorization code (từ callback ?code=...) lấy access_token + refresh_token, ghi vào DB và cache.
 * @param {string} code - Authorization code từ Zalo redirect
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
const exchangeCodeForToken = async (code) => {
  const appId = process.env.ZALO_OA_APP_ID;
  const secretKey = process.env.ZALO_OA_APP_SECRET_KEY;
  const codeStr = (code && String(code).trim()) || '';
  if (!appId || !secretKey) {
    return { success: false, error: 'ZALO_OA_APP_ID or ZALO_OA_APP_SECRET_KEY not set' };
  }
  if (!codeStr) {
    return { success: false, error: 'Missing code' };
  }

  return new Promise((resolve) => {
    const body = new URLSearchParams({
      app_id: String(appId),
      grant_type: 'authorization_code',
      code: codeStr,
    }).toString();

    const url = new URL(ZALO_OA_TOKEN_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        secret_key: secretKey,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, async (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', async () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) {
            const newAccess = json.access_token;
            const newRefresh = json.refresh_token || null;
            const expiresIn = json.expires_in != null ? Number(json.expires_in) : null;
            const expiresAtMs = expiresIn != null ? Date.now() + expiresIn * 1000 : null;

            cachedAccessToken = newAccess;
            cachedRefreshToken = newRefresh;
            cachedExpiresAt = expiresAtMs;

            await saveStoredTokens(newAccess, newRefresh, expiresAtMs);
            return resolve({ success: true });
          }
          resolve({ success: false, error: json.message || json.error || data });
        } catch {
          resolve({ success: false, error: data || 'Parse error' });
        }
      });
    });
    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.setTimeout(15000, () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
    req.write(body);
    req.end();
  });
};

/**
 * Gọi API refresh token Zalo OA v4.
 * Lấy refresh_token từ DB (hoặc env), sau khi thành công ghi token mới vào DB và cache.
 * @returns {Promise<{ success: boolean, access_token?: string, error?: string }>}
 */
const refreshAccessToken = async () => {
  const appId = process.env.ZALO_OA_APP_ID;
  const secretKey = process.env.ZALO_OA_APP_SECRET_KEY;
  const fromDb = await getStoredTokens();
  const refreshToken =
    cachedRefreshToken ||
    fromDb.refreshToken ||
    (process.env.ZALO_OA_REFRESH_TOKEN || '').trim();

  if (!appId || !secretKey) {
    return { success: false, error: 'ZALO_OA_APP_ID or ZALO_OA_APP_SECRET_KEY not set' };
  }
  if (!refreshToken) {
    return { success: false, error: 'ZALO_OA_REFRESH_TOKEN not set and no refresh token in DB' };
  }

  return new Promise((resolve) => {
    const body = new URLSearchParams({
      app_id: String(appId),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString();

    const url = new URL(ZALO_OA_TOKEN_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        secret_key: secretKey,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, async (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', async () => {
        try {
          const json = JSON.parse(data);
          if (json.access_token) {
            const newAccess = json.access_token;
            const newRefresh = json.refresh_token || refreshToken;
            const expiresIn = json.expires_in != null ? Number(json.expires_in) : null;
            const expiresAtMs = expiresIn != null ? Date.now() + expiresIn * 1000 : null;

            cachedAccessToken = newAccess;
            cachedRefreshToken = newRefresh;
            cachedExpiresAt = expiresAtMs;

            await saveStoredTokens(newAccess, newRefresh, expiresAtMs);
            return resolve({ success: true, access_token: newAccess });
          }
          resolve({ success: false, error: json.message || json.error || data });
        } catch {
          resolve({ success: false, error: data || `HTTP ${res.statusCode}` });
        }
      });
    });
    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.setTimeout(15000, () => {
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
    req.write(body);
    req.end();
  });
};

/**
 * Lấy access token hợp lệ: cache → DB → refresh (dùng refresh_token từ DB hoặc env) → env ZALO_OA_ACCESS_TOKEN.
 * Token sau refresh được ghi vào DB và cache.
 * @returns {Promise<{ success: boolean, accessToken?: string, error?: string }>}
 */
const getOrRefreshAccessToken = async () => {
  const now = Date.now();
  const marginMs = 60000; // 1 phút trước hết hạn coi như hết hạn

  if (cachedAccessToken && (cachedExpiresAt == null || cachedExpiresAt > now + marginMs)) {
    return { success: true, accessToken: cachedAccessToken };
  }

  const stored = await getStoredTokens();
  if (stored.accessToken && (stored.expiresAt == null || stored.expiresAt > now + marginMs)) {
    cachedAccessToken = stored.accessToken;
    cachedRefreshToken = stored.refreshToken;
    cachedExpiresAt = stored.expiresAt;
    return { success: true, accessToken: stored.accessToken };
  }

  const refreshed = await refreshAccessToken();
  if (refreshed.success && cachedAccessToken) {
    return { success: true, accessToken: cachedAccessToken };
  }

  const fromEnv = (process.env.ZALO_OA_ACCESS_TOKEN || '').trim();
  if (fromEnv) {
    return { success: true, accessToken: fromEnv };
  }

  return { success: false, error: refreshed.error || 'No access token' };
};

/**
 * Gửi tin nhắn text tới một user_id (Zalo OA API).
 * @param {string} accessToken
 * @param {string} userId - Zalo user_id
 * @param {string} text
 * @returns {Promise<{ success: boolean, error?: string, tokenExpired?: boolean }>}
 */
const sendTextToUser = (accessToken, userId, text) => {
  return new Promise((resolve) => {
    const url = new URL(ZALO_OA_MESSAGE_URL);
    const body = JSON.stringify({
      recipient: { user_id: String(userId).trim() },
      message: { text: text || '' },
    });
    // Debug: log request (không log full token)
    console.log('[ZaloService] sendTextToUser request:', {
      url: url.toString(),
      recipient_user_id: String(userId).trim(),
      bodyPreview: body.length > 200 ? body.slice(0, 200) + '...' : body,
      access_token_length: accessToken ? accessToken.length : 0,
    });
    const req = https.request(
      url.toString(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': accessToken,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          // Debug: log response
          const dataPreview = data.length > 500 ? data.slice(0, 500) + '...' : data;
          console.log('[ZaloService] sendTextToUser response:', {
            statusCode: res.statusCode,
            body: dataPreview,
          });
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const json = data ? JSON.parse(data) : {};
              const errCode = json.error;
              if (errCode != null && errCode !== 0) {
                const errMsg = json.message || json.error_description || JSON.stringify(json);
                const msg = String(errMsg).toLowerCase();
                const tokenExpired =
                  errCode === -124 ||
                  errCode === 401 ||
                  msg.includes('token') ||
                  msg.includes('expired') ||
                  msg.includes('invalid') ||
                  msg.includes('access_token');
                return resolve({
                  success: false,
                  error: errMsg,
                  tokenExpired: !!tokenExpired,
                });
              }
              return resolve({ success: true });
            } catch {
              return resolve({ success: true });
            }
          }
          try {
            const err = JSON.parse(data);
            const msg = (err.message || err.error || '').toLowerCase();
            const code = err.error || err.code;
            const tokenExpired =
              res.statusCode === 401 ||
              code === -124 ||
              code === 401 ||
              msg.includes('token') ||
              msg.includes('expired') ||
              msg.includes('invalid') ||
              msg.includes('access_token');
            resolve({
              success: false,
              error: err.message || data || `HTTP ${res.statusCode}`,
              tokenExpired: !!tokenExpired,
            });
          } catch {
            resolve({
              success: false,
              error: data || `HTTP ${res.statusCode}`,
              tokenExpired: res.statusCode === 401,
            });
          }
        });
      }
    );
    req.on('error', (err) => {
      console.log('[ZaloService] sendTextToUser request error:', err.message);
      resolve({ success: false, error: err.message });
    });
    req.setTimeout(15000, () => {
      console.log('[ZaloService] sendTextToUser timeout');
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });
    req.write(body);
    req.end();
  });
};

/**
 * Gửi tin nhắn theo recipient: user_ids hoặc group.
 * Dùng token từ env/cache, tự refresh khi hết hạn; retry 1 lần nếu lỗi token.
 */
const sendTextMessage = async (recipient, text) => {
  if (!recipient || !text) return { success: false, error: 'Missing recipient or text' };

  let tokenResult = await getOrRefreshAccessToken();
  if (!tokenResult.success) {
    console.warn('[ZaloService] Không lấy được access token:', tokenResult.error);
    return { success: false, error: tokenResult.error || 'No access token' };
  }
  let token = tokenResult.accessToken;

  const sendOne = async (userId) => {
    let result = await sendTextToUser(token, userId, text);
    if (result.tokenExpired && !result.success) {
      cachedAccessToken = null;
      cachedExpiresAt = null;
      await clearAccessTokenInDb();
      tokenResult = await getOrRefreshAccessToken();
      if (tokenResult.success) {
        token = tokenResult.accessToken;
        result = await sendTextToUser(token, userId, text);
      }
    }
    return result;
  };

  if (recipient.type === 'user_ids' && Array.isArray(recipient.user_ids) && recipient.user_ids.length > 0) {
    let lastError = null;
    for (const uid of recipient.user_ids) {
      if (!uid || String(uid).trim() === '') continue;
      const result = await sendOne(uid);
      if (!result.success) lastError = result.error;
    }
    return lastError != null ? { success: false, error: lastError } : { success: true };
  }

  if (recipient.type === 'group' && recipient.group_id) {
    return sendOne(recipient.group_id);
  }

  return { success: false, error: 'Invalid recipient: need user_ids or group_id' };
};

/**
 * Thông báo: súng occupied không có phiên sạc.
 */
const notifyConnectorOccupiedNoSession = async ({
  chargePointId,
  connectorId,
  connectorName,
  stationName,
  recipient,
}) => {
  const lines = [
    '[SolarEV] Súng hiển thị đang sạc nhưng không có phiên sạc',
    `Trụ: ${chargePointId || '—'}`,
    `Súng: ${connectorName || connectorId || '—'}`,
    `Trạm: ${stationName || '—'}`,
    `Thời gian: ${new Date().toLocaleString('vi-VN')}`,
  ];
  const text = lines.join('\n');
  return sendTextMessage(recipient, text);
};

module.exports = {
  exchangeCodeForToken,
  getOrRefreshAccessToken,
  refreshAccessToken,
  sendTextMessage,
  notifyConnectorOccupiedNoSession,
};
