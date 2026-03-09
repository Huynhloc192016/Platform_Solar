const { sequelize } = require('../config/database');
const { getOwnerIdForFilter } = require('../utils/authorization.util');

/**
 * GET /dashboard/service/mails - Danh sách mail log (phân trang)
 */
const getMails = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const ownerJoin =
      ownerId != null
        ? `INNER JOIN ChargePoint cp ON cp.ChargePointId = m.ChargePointId AND cp.OwnerId = ${ownerId}`
        : '';
    const countResult = await sequelize.query(
      `SELECT COUNT(*) AS total FROM MailLog m ${ownerJoin}`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const total = parseInt(countResult[0]?.total || 0, 10);
    const rows = await sequelize.query(
      `SELECT m.Id, m.EventType, m.ChargePointId, m.ConnectorId, m.StationName, m.Subject, m.ToEmail, m.Status, m.SentAt, m.ErrorMessage, m.CreatedAt
       FROM MailLog m ${ownerJoin}
       ORDER BY m.CreatedAt DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      {
        replacements: { offset, limit },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    res.json({ success: true, data: rows, total, page, limit });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /dashboard/service/settings - Lấy cấu hình email + Zalo nhận thông báo
 */
const getNotifySettings = async (req, res, next) => {
  try {
    const [mailEnabledRow, mailRow, zaloEnabledRow, zaloRecipientRow] = await Promise.all([
      sequelize.query(
        `SELECT SettingValue FROM NotificationSetting WHERE SettingKey = 'mail_notify_enabled'`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT SettingValue FROM NotificationSetting WHERE SettingKey = 'mail_notify_emails'`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT SettingValue FROM NotificationSetting WHERE SettingKey = 'zalo_oa_enabled'`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT SettingValue FROM NotificationSetting WHERE SettingKey = 'zalo_oa_recipient'`,
        { type: sequelize.QueryTypes.SELECT }
      ),
    ]);
    const mailEnabled = mailEnabledRow[0]?.SettingValue !== 'false' && mailEnabledRow[0]?.SettingValue !== false;
    let notifyEmails = [];
    const rawMail = mailRow[0]?.SettingValue;
    if (rawMail && typeof rawMail === 'string') {
      try {
        const arr = JSON.parse(rawMail);
        notifyEmails = Array.isArray(arr) ? arr.filter((e) => typeof e === 'string') : [];
      } catch (_) {}
    }
    const zaloEnabled = zaloEnabledRow[0]?.SettingValue === 'true' || zaloEnabledRow[0]?.SettingValue === true;
    let zaloRecipient = null;
    const rawZalo = zaloRecipientRow[0]?.SettingValue;
    if (rawZalo && typeof rawZalo === 'string') {
      try {
        const parsed = JSON.parse(rawZalo);
        if (parsed && typeof parsed === 'object') zaloRecipient = parsed;
      } catch (_) {}
    }
    res.json({
      success: true,
      data: { mailEnabled, notifyEmails, zaloEnabled, zaloRecipient },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /dashboard/service/settings - Cập nhật email + Zalo nhận thông báo
 */
const updateNotifySettings = async (req, res, next) => {
  try {
    const { mailEnabled, notifyEmails, zaloEnabled, zaloRecipient } = req.body || {};
    if (!Array.isArray(notifyEmails)) {
      return res.status(400).json({ success: false, message: 'notifyEmails phải là mảng' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = notifyEmails.filter((e) => typeof e === 'string' && emailRegex.test(String(e).trim()));
    const mailValue = JSON.stringify(valid);

    if (zaloEnabled === true && zaloRecipient != null && typeof zaloRecipient === 'object') {
      const hasUserIds = Array.isArray(zaloRecipient.user_ids) && zaloRecipient.user_ids.some((id) => String(id).trim());
      const hasGroupId = zaloRecipient.type === 'group' && zaloRecipient.group_id && String(zaloRecipient.group_id).trim();
      if (!hasUserIds && !hasGroupId) {
        return res.status(400).json({
          success: false,
          message: 'Khi bật Zalo cần nhập Group ID hoặc ít nhất một User ID Zalo',
        });
      }
    }

    const upsertSetting = async (key, value) => {
      const existing = await sequelize.query(
        `SELECT SettingKey FROM NotificationSetting WHERE SettingKey = :key`,
        { replacements: { key }, type: sequelize.QueryTypes.SELECT }
      );
      if (existing && existing.length > 0) {
        await sequelize.query(
          `UPDATE NotificationSetting SET SettingValue = :value, UpdatedAt = GETDATE() WHERE SettingKey = :key`,
          { replacements: { key, value } }
        );
      } else {
        await sequelize.query(
          `INSERT INTO NotificationSetting (SettingKey, SettingValue, UpdatedAt) VALUES (:key, :value, GETDATE())`,
          { replacements: { key, value } }
        );
      }
    };

    await upsertSetting('mail_notify_emails', mailValue);

    await upsertSetting('mail_notify_enabled', mailEnabled === true ? 'true' : 'false');

    await upsertSetting('zalo_oa_enabled', zaloEnabled === true ? 'true' : 'false');
    const zaloRecipientValue =
      zaloRecipient != null && typeof zaloRecipient === 'object'
        ? JSON.stringify(zaloRecipient)
        : '{}';
    await upsertSetting('zalo_oa_recipient', zaloRecipientValue);

    res.json({
      success: true,
      message: 'Đã lưu cấu hình',
      data: {
        mailEnabled: mailEnabled === true,
        notifyEmails: valid,
        zaloEnabled: zaloEnabled === true,
        zaloRecipient: zaloRecipient != null && typeof zaloRecipient === 'object' ? zaloRecipient : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /dashboard/service/zalo-logs - Danh sách Zalo log (phân trang)
 */
const getZaloLogs = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const ownerJoin =
      ownerId != null
        ? `INNER JOIN ChargePoint cp ON cp.ChargePointId = z.ChargePointId AND cp.OwnerId = ${ownerId}`
        : '';
    const countResult = await sequelize.query(
      `SELECT COUNT(*) AS total FROM ZaloLog z ${ownerJoin}`,
      { type: sequelize.QueryTypes.SELECT }
    );
    const total = parseInt(countResult[0]?.total || 0, 10);
    const rows = await sequelize.query(
      `SELECT z.Id, z.EventType, z.ChargePointId, z.ConnectorId, z.StationName, z.RecipientRef, z.Message, z.Status, z.SentAt, z.ErrorMessage, z.CreatedAt
       FROM ZaloLog z ${ownerJoin}
       ORDER BY z.CreatedAt DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      {
        replacements: { offset, limit },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    res.json({ success: true, data: rows, total, page, limit });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMails,
  getNotifySettings,
  updateNotifySettings,
  getZaloLogs,
};
