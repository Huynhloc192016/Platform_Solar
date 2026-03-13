const { sequelize } = require('../config/database');

const parseDateTime = (raw, endOfDay = false) => {
  if (!raw) return null;
  const s = String(raw).trim();
  // Support YYYY-MM-DD or ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return endOfDay ? `${s} 23:59:59` : `${s} 00:00:00`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  // Sequelize will pass JS Date to driver
  return d;
};

/**
 * GET /dashboard/activity-logs
 * Query: module, actionName, entity, entityId, from, to, page, limit
 */
const getActivityLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const moduleRaw = (req.query.module || '').trim();
    const actionNameRaw = (req.query.actionName || '').trim();
    const entityRaw = (req.query.entity || '').trim();
    const entityIdRaw = (req.query.entityId || '').trim();

    const fromVal = parseDateTime(req.query.from, false);
    const toVal = parseDateTime(req.query.to, true);

    const whereParts = [];
    const replacements = {};

    if (moduleRaw) {
      whereParts.push('al.Module = :module');
      replacements.module = moduleRaw;
    }
    if (actionNameRaw) {
      whereParts.push('al.ActionName = :actionName');
      replacements.actionName = actionNameRaw;
    }
    if (entityRaw) {
      whereParts.push('al.Entity = :entity');
      replacements.entity = entityRaw;
    }
    if (entityIdRaw) {
      whereParts.push('al.EntityId = :entityId');
      replacements.entityId = entityIdRaw;
    }
    if (fromVal) {
      whereParts.push('al.CreatedAt >= :from');
      replacements.from = fromVal;
    }
    if (toVal) {
      whereParts.push('al.CreatedAt <= :to');
      replacements.to = toVal;
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countRows = await sequelize.query(
      `SELECT COUNT(*) as total
       FROM ActivityLog al
       ${whereClause}`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );
    const total = parseInt(countRows?.[0]?.total || 0, 10);

    const rows = await sequelize.query(
      `SELECT
         al.Id,
         al.CreatedAt,
         al.Module,
         al.Action,
         al.ActionName,
         al.Entity,
         al.EntityId,
         al.BeforeJson,
         al.AfterJson,
         al.RequestPath,
         al.RequestMethod,
         al.Ip,
         al.UserAgent
       FROM ActivityLog al
       ${whereClause}
       ORDER BY al.CreatedAt DESC, al.Id DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      {
        replacements: { ...replacements, offset, limit },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    res.json({
      success: true,
      data: rows || [],
      total,
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActivityLogs,
};

