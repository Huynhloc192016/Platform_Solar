const { sequelize } = require('../config/database');
const { getOwnerIdForFilter } = require('../utils/authorization.util');
const { insertActivityLog } = require('../utils/activity-log.util');

const getOrderSnapshotById = async (id) => {
  const [row] = await sequelize.query(
    `SELECT TOP 1
       wt.WalletTransactionId,
       wt.UserAppId,
       wt.TransactionId,
       wt.Amount,
       wt.DateCreate,
       wt.MeterValue,
       wt.StopMethod,
       wt.CurrentBalance,
       wt.NewBalance
     FROM WalletTransaction wt
     WHERE wt.WalletTransactionId = :id`,
    { replacements: { id }, type: sequelize.QueryTypes.SELECT }
  );
  return row || null;
};

// Danh sách đơn sạc (quản lý đơn sạc)
const getChargingOrders = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const searchRaw = (req.query.search || '').trim();
    const searchParam = searchRaw ? `%${searchRaw}%` : null;
    const dateFromRaw = (req.query.dateFrom || '').trim();
    const dateToRaw = (req.query.dateTo || '').trim();

    const ownerWhere = ownerId
      ? `AND EXISTS (SELECT 1 FROM Transactions t INNER JOIN ChargePoint cp ON cp.ChargePointId = t.ChargePointId AND t.TransactionId = wt.TransactionId WHERE cp.OwnerId = ${ownerId})`
      : '';
    const searchWhere = searchParam
      ? `AND (CAST(wt.WalletTransactionId AS NVARCHAR(50)) LIKE :search OR CAST(wt.UserAppId AS NVARCHAR(50)) LIKE :search OR CAST(wt.TransactionId AS NVARCHAR(50)) LIKE :search)`
      : '';

    let dateFromVal = null;
    let dateToVal = null;
    if (dateFromRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateFromRaw)) {
      dateFromVal = `${dateFromRaw} 00:00:00`;
    }
    if (dateToRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateToRaw)) {
      dateToVal = `${dateToRaw} 23:59:59`;
    }
    const dateFromWhere = dateFromVal ? 'AND wt.DateCreate >= :dateFrom' : '';
    const dateToWhere = dateToVal ? 'AND wt.DateCreate <= :dateTo' : '';

    const replacements = {
      ...(searchParam ? { search: searchParam } : {}),
      ...(dateFromVal ? { dateFrom: dateFromVal } : {}),
      ...(dateToVal ? { dateTo: dateToVal } : {}),
    };

    const countResult = await sequelize.query(
      `SELECT COUNT(*) as total
       FROM WalletTransaction wt
       WHERE 1=1 ${ownerWhere} ${searchWhere} ${dateFromWhere} ${dateToWhere}`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );
    const total = parseInt(countResult[0]?.total || 0, 10);

    const orders = await sequelize.query(
      `SELECT
        wt.WalletTransactionId,
        wt.UserAppId,
        wt.TransactionId,
        wt.Amount,
        wt.DateCreate,
        wt.MeterValue,
        wt.StopMethod,
        wt.CurrentBalance,
        wt.NewBalance,
        CASE WHEN t.MeterStop IS NOT NULL AND t.MeterStart IS NOT NULL THEN CAST(t.MeterStop AS FLOAT) - CAST(t.MeterStart AS FLOAT) ELSE NULL END as EnergyUsed
       FROM WalletTransaction wt
       LEFT JOIN Transactions t ON t.TransactionId = wt.TransactionId
       WHERE 1=1 ${ownerWhere} ${searchWhere} ${dateFromWhere} ${dateToWhere}
       ORDER BY wt.DateCreate DESC
       OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );

    const data = orders.map((row) => ({
      WalletTransactionId: row.WalletTransactionId,
      UserAppId: row.UserAppId,
      TransactionId: row.TransactionId,
      EnergyUsed:
        row.EnergyUsed != null ? row.EnergyUsed : row.MeterValue ?? row.meterValue,
      DateCreate: row.DateCreate,
      meterValue: row.MeterValue ?? row.meterValue,
      Amount: row.Amount,
      stopMethod: row.StopMethod ?? row.stopMethod,
      currentBalance: row.CurrentBalance ?? row.currentBalance,
      newBalance: row.NewBalance ?? row.newBalance,
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

// Cập nhật đơn sạc
const updateOrder = async (req, res, next) => {
  try {
    if (getOwnerIdForFilter(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: 'Chủ đầu tư không có quyền thao tác.' });
    }
    const { id } = req.params;
    const ownerId = getOwnerIdForFilter(req.user);
    const { Amount, meterValue, stopMethod, currentBalance, newBalance, UserAppId } =
      req.body;

    const ownerCheck = ownerId
      ? `AND EXISTS (SELECT 1 FROM Transactions t INNER JOIN ChargePoint cp ON cp.ChargePointId = t.ChargePointId AND t.TransactionId = wt.TransactionId WHERE cp.OwnerId = ${ownerId})`
      : '';
    const [existing] = await sequelize.query(
      `SELECT TOP 1 wt.WalletTransactionId FROM WalletTransaction wt WHERE wt.WalletTransactionId = :id ${ownerCheck}`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy đơn sạc hoặc không có quyền.' });
    }

    const before = await getOrderSnapshotById(id);

    const updates = [];
    const replacements = { id };
    if (Amount !== undefined) {
      updates.push('Amount = :Amount');
      replacements.Amount = Amount;
    }
    if (meterValue !== undefined) {
      updates.push('MeterValue = :meterValue');
      replacements.meterValue = meterValue;
    }
    if (stopMethod !== undefined) {
      updates.push('StopMethod = :stopMethod');
      replacements.stopMethod = stopMethod;
    }
    if (currentBalance !== undefined) {
      updates.push('CurrentBalance = :currentBalance');
      replacements.currentBalance = currentBalance;
    }
    if (newBalance !== undefined) {
      updates.push('NewBalance = :newBalance');
      replacements.newBalance = newBalance;
    }
    if (UserAppId !== undefined && UserAppId !== '') {
      updates.push('UserAppId = :UserAppId');
      replacements.UserAppId = Number(UserAppId);
    }
    if (updates.length === 0) {
      return res.json({ success: true, message: 'Không có thay đổi.' });
    }

    await sequelize.query(
      `UPDATE WalletTransaction SET ${updates.join(', ')} WHERE WalletTransactionId = :id`,
      { replacements }
    );

    const after = await getOrderSnapshotById(id);
    await insertActivityLog({
      module: 'transactions',
      action: 'UPDATE',
      actionName: 'ORDER_UPDATE',
      entity: 'WalletTransaction',
      entityId: id,
      before,
      after,
      req,
    });

    res.json({ success: true, message: 'Cập nhật đơn sạc thành công.' });
  } catch (error) {
    next(error);
  }
};

// Xóa đơn sạc
const deleteOrder = async (req, res, next) => {
  try {
    if (getOwnerIdForFilter(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: 'Chủ đầu tư không có quyền thao tác.' });
    }
    const { id } = req.params;
    const ownerId = getOwnerIdForFilter(req.user);

    const ownerCheck = ownerId
      ? `AND EXISTS (SELECT 1 FROM Transactions t INNER JOIN ChargePoint cp ON cp.ChargePointId = t.ChargePointId AND t.TransactionId = wt.TransactionId WHERE cp.OwnerId = ${ownerId})`
      : '';
    const [existing] = await sequelize.query(
      `SELECT TOP 1 wt.WalletTransactionId FROM WalletTransaction wt WHERE wt.WalletTransactionId = :id ${ownerCheck}`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy đơn sạc hoặc không có quyền.' });
    }

    const before = await getOrderSnapshotById(id);

    await sequelize.query(
      'DELETE FROM WalletTransaction WHERE WalletTransactionId = :id',
      { replacements: { id } }
    );

    await insertActivityLog({
      module: 'transactions',
      action: 'DELETE',
      actionName: 'ORDER_DELETE',
      entity: 'WalletTransaction',
      entityId: id,
      before,
      after: null,
      req,
    });

    res.json({ success: true, message: 'Đã xóa đơn sạc.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChargingOrders,
  updateOrder,
  deleteOrder,
};

