const { sequelize } = require('../config/database');
const { getOwnerIdForFilter } = require('../utils/authorization.util');

// Danh sách phiên sạc (quản lý phiên sạc)
const getChargingSessions = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const searchRaw = (req.query.search || '').trim();
    const searchParam = searchRaw ? `%${searchRaw}%` : null;
    const dateFromRaw = (req.query.dateFrom || '').trim();
    const dateToRaw = (req.query.dateTo || '').trim();

    const ownerWhere = ownerId ? `cp.OwnerId = ${ownerId}` : '';
    const searchWhere = searchParam
      ? `(CAST(t.TransactionId AS NVARCHAR(50)) LIKE :search OR t.Uid LIKE :search OR t.ChargePointId LIKE :search OR t.StartTagId LIKE :search OR ISNULL(cs.Name,'') LIKE :search)`
      : '';

    let dateFromVal = null;
    let dateToVal = null;
    if (dateFromRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateFromRaw)) {
      dateFromVal = `${dateFromRaw} 00:00:00`;
    }
    if (dateToRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateToRaw)) {
      dateToVal = `${dateToRaw} 23:59:59`;
    }

    const dateFromWhere = dateFromVal ? 't.StartTime >= :dateFrom' : '';
    const dateToWhere = dateToVal ? 't.StartTime <= :dateTo' : '';
    const dateWhereParts = [dateFromWhere, dateToWhere].filter(Boolean);
    const dateWhere = dateWhereParts.length ? dateWhereParts.join(' AND ') : '';

    const whereParts = [ownerWhere, searchWhere, dateWhere].filter(Boolean);
    const whereClause = whereParts.length
      ? `WHERE ${whereParts.join(' AND ')}`
      : '';

    const replacements = {
      ...(searchParam ? { search: searchParam } : {}),
      ...(dateFromVal ? { dateFrom: dateFromVal } : {}),
      ...(dateToVal ? { dateTo: dateToVal } : {}),
    };

    const countResult = await sequelize.query(
      `SELECT COUNT(*) as total
       FROM Transactions t
       INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId
       LEFT JOIN ChargeStation cs ON cp.ChargeStationId = cs.ChargeStationId
       ${whereClause}`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );
    const total = parseInt(countResult[0]?.total || 0, 10);

    const sessions = await sequelize.query(
      `SELECT
        t.TransactionId,
        t.Uid,
        t.ChargePointId,
        t.StartTagId,
        t.StartTime,
        t.MeterStart,
        t.StopTime,
        t.MeterStop,
        ISNULL(cs.Name, 'N/A') as StationName
       FROM Transactions t
       INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId
       LEFT JOIN ChargeStation cs ON cp.ChargeStationId = cs.ChargeStationId
       ${whereClause}
       ORDER BY t.StartTime DESC
       OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );

    const data = sessions.map((row) => ({
      TransactionId: row.TransactionId,
      Uid: row.Uid,
      ChargePointId: row.ChargePointId,
      StartTagId: row.StartTagId,
      StartTime: row.StartTime,
      MeterStart: row.MeterStart,
      ConnectionStatus:
        row.StartTime != null ? 'Kết nối thành công' : 'Kết nối thất bại',
      StopTagId: row.StartTagId,
      StopTime: row.StopTime,
      MeterStop: row.MeterStop,
      StationName: row.StationName,
    }));

    res.json({
      success: true,
      data,
      total,
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
};

// Cập nhật phiên sạc
const updateSession = async (req, res, next) => {
  try {
    if (getOwnerIdForFilter(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: 'Chủ đầu tư không có quyền thao tác.' });
    }
    const { id } = req.params;
    const ownerId = getOwnerIdForFilter(req.user);
    const { StartTime, StopTime, MeterStart, MeterStop } = req.body;

    const ownerFilter = ownerId
      ? `AND EXISTS (SELECT 1 FROM ChargePoint cp WHERE cp.ChargePointId = t.ChargePointId AND cp.OwnerId = ${ownerId})`
      : '';
    const [existing] = await sequelize.query(
      `SELECT t.TransactionId FROM Transactions t WHERE t.TransactionId = :id ${ownerFilter}`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy phiên sạc hoặc không có quyền.' });
    }

    const updates = [];
    const replacements = { id };
    if (StartTime !== undefined) {
      updates.push('StartTime = :StartTime');
      replacements.StartTime = StartTime;
    }
    if (StopTime !== undefined) {
      updates.push('StopTime = :StopTime');
      replacements.StopTime = StopTime;
    }
    if (MeterStart !== undefined) {
      updates.push('MeterStart = :MeterStart');
      replacements.MeterStart = MeterStart;
    }
    if (MeterStop !== undefined) {
      updates.push('MeterStop = :MeterStop');
      replacements.MeterStop = MeterStop;
    }
    if (updates.length === 0) {
      return res.json({ success: true, message: 'Không có thay đổi.' });
    }

    await sequelize.query(
      `UPDATE Transactions SET ${updates.join(', ')} WHERE TransactionId = :id`,
      { replacements }
    );
    res.json({ success: true, message: 'Cập nhật phiên sạc thành công.' });
  } catch (error) {
    next(error);
  }
};

// Xóa phiên sạc
const deleteSession = async (req, res, next) => {
  try {
    if (getOwnerIdForFilter(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: 'Chủ đầu tư không có quyền thao tác.' });
    }
    const { id } = req.params;
    const ownerId = getOwnerIdForFilter(req.user);

    const ownerFilter = ownerId
      ? `AND EXISTS (SELECT 1 FROM ChargePoint cp WHERE cp.ChargePointId = t.ChargePointId AND cp.OwnerId = ${ownerId})`
      : '';
    const [existing] = await sequelize.query(
      `SELECT t.TransactionId FROM Transactions t WHERE t.TransactionId = :id ${ownerFilter}`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy phiên sạc hoặc không có quyền.' });
    }

    await sequelize.query('DELETE FROM WalletTransaction WHERE TransactionId = :id', {
      replacements: { id },
    });
    await sequelize.query('DELETE FROM Transactions WHERE TransactionId = :id', {
      replacements: { id },
    });
    res.json({ success: true, message: 'Đã xóa phiên sạc.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChargingSessions,
  updateSession,
  deleteSession,
};

