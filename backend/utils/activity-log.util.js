const { sequelize } = require('../config/database');

const MAX_USER_AGENT_LEN = 512;
const MAX_PATH_LEN = 255;

const toNullableString = (v) => {
  if (v == null) return null;
  const s = String(v);
  return s.length ? s : null;
};

const getClientIp = (req) => {
  const xf = req?.headers?.['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0].trim();
  }
  if (Array.isArray(xf) && xf.length > 0) return String(xf[0]).trim();
  return (
    toNullableString(req?.ip) ||
    toNullableString(req?.connection?.remoteAddress) ||
    toNullableString(req?.socket?.remoteAddress) ||
    null
  );
};

const safeJsonStringify = (obj) => {
  if (obj == null) return null;
  try {
    return JSON.stringify(obj);
  } catch (e) {
    try {
      return JSON.stringify({ _error: 'stringify_failed', message: e?.message });
    } catch {
      return null;
    }
  }
};

// Redact các key nhạy cảm (phòng hờ), dùng cho before/after snapshots.
const redactSensitive = (value) => {
  const seen = new WeakSet();
  const walk = (v) => {
    if (v == null) return v;
    if (typeof v !== 'object') return v;
    if (seen.has(v)) return '[Circular]';
    seen.add(v);
    if (Array.isArray(v)) return v.map(walk);
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (/(password|token|secret|hash)/i.test(k)) {
        out[k] = '***';
      } else {
        out[k] = walk(val);
      }
    }
    return out;
  };
  return walk(value);
};

/**
 * Insert 1 bản ghi ActivityLog. Không throw để tránh làm hỏng luồng chính.
 * @param {object} params
 * @param {string} params.module
 * @param {string} params.action
 * @param {string} params.actionName
 * @param {string} params.entity
 * @param {string|number} params.entityId
 * @param {object|null} params.before
 * @param {object|null} params.after
 * @param {import('express').Request} params.req
 * @param {import('sequelize').Transaction} [params.transaction]
 */
const insertActivityLog = async ({
  module,
  action,
  actionName,
  entity,
  entityId,
  before,
  after,
  req,
  transaction,
}) => {
  try {
    const requestPath = toNullableString(req?.originalUrl || req?.path);
    const requestMethod = toNullableString(req?.method);
    const ip = getClientIp(req);
    const userAgentRaw = toNullableString(req?.headers?.['user-agent']);
    const userAgent =
      userAgentRaw && userAgentRaw.length > MAX_USER_AGENT_LEN
        ? userAgentRaw.slice(0, MAX_USER_AGENT_LEN)
        : userAgentRaw;

    const beforeJson = safeJsonStringify(redactSensitive(before));
    const afterJson = safeJsonStringify(redactSensitive(after));

    const pathTrimmed =
      requestPath && requestPath.length > MAX_PATH_LEN
        ? requestPath.slice(0, MAX_PATH_LEN)
        : requestPath;

    await sequelize.query(
      `INSERT INTO ActivityLog
        (Module, Action, ActionName, Entity, EntityId, BeforeJson, AfterJson, RequestPath, RequestMethod, Ip, UserAgent)
       VALUES
        (:module, :action, :actionName, :entity, :entityId, :beforeJson, :afterJson, :requestPath, :requestMethod, :ip, :userAgent)`,
      {
        replacements: {
          module: String(module || ''),
          action: String(action || ''),
          actionName: String(actionName || ''),
          entity: String(entity || ''),
          entityId: String(entityId ?? ''),
          beforeJson,
          afterJson,
          requestPath: pathTrimmed,
          requestMethod,
          ip,
          userAgent,
        },
        transaction,
      }
    );
  } catch (err) {
    // Không chặn nghiệp vụ nếu log fail.
    console.warn('[ActivityLog] insertActivityLog failed:', err?.message || err);
  }
};

module.exports = {
  insertActivityLog,
};

