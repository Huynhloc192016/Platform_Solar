const { sequelize } = require('../config/database');
const emailService = require('./email.service');
const zaloService = require('./zalo.service');

const NOTIFY_COOLDOWN_HOURS = 24;
const NOTIFY_SETTING_KEY = 'mail_notify_emails';
const MAIL_NOTIFY_ENABLED_KEY = 'mail_notify_enabled';
const ZALO_ENABLED_KEY = 'zalo_oa_enabled';
const ZALO_RECIPIENT_KEY = 'zalo_oa_recipient';

/**
 * Lấy danh sách email nhận thông báo từ bảng NotificationSetting (cấu hình trên FE).
 * Trả về [] nếu mail_notify_enabled = false.
 * @returns {Promise<string[]>}
 */
const getNotifyEmails = async () => {
  try {
    const enabledRows = await sequelize.query(
      `SELECT SettingValue FROM NotificationSetting WHERE SettingKey = :key`,
      { replacements: { key: MAIL_NOTIFY_ENABLED_KEY }, type: sequelize.QueryTypes.SELECT }
    );
    const enabled = enabledRows[0]?.SettingValue === 'true' || enabledRows[0]?.SettingValue === true;
    if (!enabled) return [];

    const rows = await sequelize.query(
      `SELECT SettingValue FROM NotificationSetting WHERE SettingKey = :key`,
      {
        replacements: { key: NOTIFY_SETTING_KEY },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    const raw = rows[0]?.SettingValue;
    if (!raw || typeof raw !== 'string') return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((e) => typeof e === 'string' && e.trim().length > 0).map((e) => e.trim()) : [];
  } catch (err) {
    console.error('[ConnectorCheck] getNotifyEmails error:', err.message);
    return [];
  }
};

/**
 * Tìm các connector có LastStatus = Charging/Occupied nhưng không có transaction đang mở (StopTime IS NULL).
 * Trả về mảng { chargePointId, connectorId, connectorName, stationName }.
 */
const findConnectorsOccupiedWithoutSession = async () => {
  try {
    const list = await sequelize.query(
      `WITH LatestConnector AS (
        SELECT ChargePointId, ConnectorId, ConnectorName, LastStatus, LastStatusTime,
               ROW_NUMBER() OVER (PARTITION BY ChargePointId, ConnectorId ORDER BY LastStatusTime DESC) AS rn
        FROM ConnectorStatus
      ),
      OccupiedNoTransaction AS (
        SELECT lc.ChargePointId, lc.ConnectorId, lc.ConnectorName
        FROM LatestConnector lc
        WHERE lc.rn = 1
          AND lc.LastStatus IN ('Charging', 'Occupied')
          AND NOT EXISTS (
            SELECT 1 FROM Transactions t
            WHERE t.ChargePointId = lc.ChargePointId
              AND t.ConnectorId = lc.ConnectorId
              AND t.StopTime IS NULL
          )
      )
      SELECT o.ChargePointId, o.ConnectorId, o.ConnectorName,
             ISNULL(cs.Name, '') AS StationName
      FROM OccupiedNoTransaction o
      INNER JOIN ChargePoint cp ON cp.ChargePointId = o.ChargePointId
      INNER JOIN ChargeStation cs ON cs.ChargeStationId = cp.ChargeStationId`,
      { type: sequelize.QueryTypes.SELECT }
    );
    return list.map((row) => ({
      chargePointId: row.ChargePointId,
      connectorId: row.ConnectorId,
      connectorName: row.ConnectorName || `Súng ${row.ConnectorId}`,
      stationName: row.StationName || '',
    }));
  } catch (err) {
    console.error('[ConnectorCheck] findConnectorsOccupiedWithoutSession error:', err.message);
    return [];
  }
};

/**
 * Kiểm tra đã gửi mail connector_no_session cho (chargePointId, connectorId) trong X giờ chưa.
 */
const wasNotifiedRecently = async (chargePointId, connectorId, hoursAgo = NOTIFY_COOLDOWN_HOURS) => {
  try {
    const rows = await sequelize.query(
      `SELECT 1 FROM MailLog
       WHERE EventType = 'connector_no_session'
         AND ChargePointId = :chargePointId AND ConnectorId = :connectorId
         AND CreatedAt >= DATEADD(HOUR, :hoursAgo, GETDATE())`,
      {
        replacements: { chargePointId, connectorId, hoursAgo: -hoursAgo },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    return (rows || []).length > 0;
  } catch {
    return false;
  }
};

/**
 * Kiểm tra đã gửi Zalo connector_no_session cho (chargePointId, connectorId) trong X giờ chưa.
 */
const wasNotifiedRecentlyZalo = async (chargePointId, connectorId, hoursAgo = NOTIFY_COOLDOWN_HOURS) => {
  try {
    const rows = await sequelize.query(
      `SELECT 1 FROM ZaloLog
       WHERE EventType = 'connector_no_session'
         AND ChargePointId = :chargePointId AND ConnectorId = :connectorId
         AND CreatedAt >= DATEADD(HOUR, :hoursAgo, GETDATE())`,
      {
        replacements: { chargePointId, connectorId, hoursAgo: -hoursAgo },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    return (rows || []).length > 0;
  } catch {
    return false;
  }
};

/**
 * Lấy cấu hình Zalo OA: bật/tắt và đích nhận (user_ids hoặc group_id).
 * @returns {Promise<{ enabled: boolean, recipient?: object }>}
 */
const getZaloRecipient = async () => {
  try {
    const enabledRows = await sequelize.query(
      `SELECT SettingValue FROM NotificationSetting WHERE SettingKey = :key`,
      { replacements: { key: ZALO_ENABLED_KEY }, type: sequelize.QueryTypes.SELECT }
    );
    const enabled = enabledRows[0]?.SettingValue === 'true' || enabledRows[0]?.SettingValue === true;
    if (!enabled) return { enabled: false };

    const recipientRows = await sequelize.query(
      `SELECT SettingValue FROM NotificationSetting WHERE SettingKey = :key`,
      { replacements: { key: ZALO_RECIPIENT_KEY }, type: sequelize.QueryTypes.SELECT }
    );
    const raw = recipientRows[0]?.SettingValue;
    if (!raw || typeof raw !== 'string') return { enabled: true, recipient: null };
    const recipient = JSON.parse(raw);
    if (!recipient || typeof recipient !== 'object') return { enabled: true, recipient: null };
    const hasUserIds = Array.isArray(recipient.user_ids) && recipient.user_ids.some((id) => String(id).trim());
    const hasGroupId = recipient.type === 'group' && recipient.group_id && String(recipient.group_id).trim();
    if (!hasUserIds && !hasGroupId) return { enabled: true, recipient: null };
    return { enabled: true, recipient };
  } catch (err) {
    console.error('[ConnectorCheck] getZaloRecipient error:', err.message);
    return { enabled: false };
  }
};

/**
 * Chạy kiểm tra: phát hiện súng occupied không có session, gửi mail + Zalo và ghi MailLog/ZaloLog.
 */
const runConnectorNoSessionCheck = async () => {
  const recipientEmails = await getNotifyEmails();
  const zaloConfig = await getZaloRecipient();
  const hasEmail = recipientEmails.length > 0;
  const hasZalo = zaloConfig.enabled && zaloConfig.recipient;
  if (!hasEmail && !hasZalo) return;

  const items = await findConnectorsOccupiedWithoutSession();
  for (const item of items) {
    const recentlyMail = await wasNotifiedRecently(item.chargePointId, item.connectorId);
    const recentlyZalo = await wasNotifiedRecentlyZalo(item.chargePointId, item.connectorId);

    if (hasEmail && !recentlyMail) {
      const subject = `[SolarEV] Súng hiển thị đang sạc nhưng không có phiên sạc - ${item.chargePointId}/${item.connectorId}`;
      const toEmail = recipientEmails.join(', ');
      try {
        await sequelize.query(
          `INSERT INTO MailLog (EventType, ChargePointId, ConnectorId, StationName, Subject, ToEmail, Body, Status, CreatedAt)
           VALUES ('connector_no_session', :chargePointId, :connectorId, :stationName, :subject, :toEmail, :body, 'pending', GETDATE())`,
          {
            replacements: {
              chargePointId: item.chargePointId,
              connectorId: item.connectorId,
              stationName: item.stationName || '',
              subject,
              toEmail,
              body: `Trụ ${item.chargePointId} Súng ${item.connectorName} Trạm ${item.stationName}`,
            },
          }
        );
        const result = await emailService.notifyConnectorOccupiedNoSession({
          chargePointId: item.chargePointId,
          connectorId: item.connectorId,
          connectorName: item.connectorName,
          stationName: item.stationName,
          recipientEmails,
        });
        const [lastRow] = await sequelize.query(
          `SELECT TOP 1 Id FROM MailLog WHERE ChargePointId = :chargePointId AND ConnectorId = :connectorId AND EventType = 'connector_no_session' ORDER BY CreatedAt DESC`,
          {
            replacements: { chargePointId: item.chargePointId, connectorId: item.connectorId },
            type: sequelize.QueryTypes.SELECT,
          }
        );
        const logId = lastRow?.Id;
        if (logId != null) {
          if (result.success) {
            await sequelize.query(
              `UPDATE MailLog SET Status = 'sent', SentAt = GETDATE() WHERE Id = :id`,
              { replacements: { id: logId } }
            );
          } else {
            await sequelize.query(
              `UPDATE MailLog SET Status = 'failed', ErrorMessage = :err WHERE Id = :id`,
              { replacements: { id: logId, err: (result.error || '').slice(0, 500) } }
            );
          }
        }
      } catch (err) {
        console.error('[ConnectorCheck] runConnectorNoSessionCheck mail item error:', err.message);
      }
    }

    if (hasZalo && !recentlyZalo) {
      const recipientRef =
        zaloConfig.recipient.type === 'group'
          ? `group:${zaloConfig.recipient.group_id}`
          : (zaloConfig.recipient.user_ids || []).join(',');
      const messageText = `[SolarEV] Súng hiển thị đang sạc nhưng không có phiên sạc - Trụ ${item.chargePointId} Súng ${item.connectorName} Trạm ${item.stationName}`;
      try {
        await sequelize.query(
          `INSERT INTO ZaloLog (EventType, ChargePointId, ConnectorId, StationName, RecipientRef, Message, Status, CreatedAt)
           VALUES ('connector_no_session', :chargePointId, :connectorId, :stationName, :recipientRef, :messageText, 'pending', GETDATE())`,
          {
            replacements: {
              chargePointId: item.chargePointId,
              connectorId: item.connectorId,
              stationName: item.stationName || '',
              recipientRef,
              messageText,
            },
          }
        );
        const result = await zaloService.notifyConnectorOccupiedNoSession({
          chargePointId: item.chargePointId,
          connectorId: item.connectorId,
          connectorName: item.connectorName,
          stationName: item.stationName,
          recipient: zaloConfig.recipient,
        });
        const [lastZaloRow] = await sequelize.query(
          `SELECT TOP 1 Id FROM ZaloLog WHERE ChargePointId = :chargePointId AND ConnectorId = :connectorId AND EventType = 'connector_no_session' ORDER BY CreatedAt DESC`,
          {
            replacements: { chargePointId: item.chargePointId, connectorId: item.connectorId },
            type: sequelize.QueryTypes.SELECT,
          }
        );
        const zaloLogId = lastZaloRow?.Id;
        if (zaloLogId != null) {
          if (result.success) {
            await sequelize.query(
              `UPDATE ZaloLog SET Status = 'sent', SentAt = GETDATE() WHERE Id = :id`,
              { replacements: { id: zaloLogId } }
            );
          } else {
            await sequelize.query(
              `UPDATE ZaloLog SET Status = 'failed', ErrorMessage = :err WHERE Id = :id`,
              { replacements: { id: zaloLogId, err: (result.error || '').slice(0, 500) } }
            );
          }
        }
      } catch (err) {
        console.error('[ConnectorCheck] runConnectorNoSessionCheck zalo item error:', err.message);
      }
    }
  }
};

module.exports = {
  getNotifyEmails,
  getZaloRecipient,
  findConnectorsOccupiedWithoutSession,
  wasNotifiedRecently,
  wasNotifiedRecentlyZalo,
  runConnectorNoSessionCheck,
};
