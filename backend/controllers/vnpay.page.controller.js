const { sequelize } = require('../config/database');

/**
 * Danh sách giao dịch nạp tiền VNPay (theo logic platform cũ).
 * DepositHistory (Message = Nạp tiền từ VNPay) JOIN UserApp JOIN VnpIPNLog (DepositCode = vnp_TxnRef).
 * Query params: page, limit, search, dateFrom, dateTo.
 */
const getVnpayTransactions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const searchRaw = (req.query.search || '').trim();
    const searchParam = searchRaw ? `%${searchRaw}%` : null;
    const dateFromRaw = (req.query.dateFrom || '').trim();
    const dateToRaw = (req.query.dateTo || '').trim();

    let dateFromVal = null;
    let dateToVal = null;
    if (dateFromRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateFromRaw)) {
      dateFromVal = `${dateFromRaw} 00:00:00`;
    }
    if (dateToRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateToRaw)) {
      dateToVal = `${dateToRaw} 23:59:59`;
    }

    const searchWhere = searchParam
      ? `AND (v.vnp_TransactionNo LIKE :search OR dp.DepositCode LIKE :search OR v.vnp_BankCode LIKE :search OR ISNULL(u.Fullname,'') LIKE :search OR ISNULL(u.Phone,'') LIKE :search OR ISNULL(u.Id,'') LIKE :search)`
      : '';
    const dateFromWhere = dateFromVal ? 'AND dp.DateCreate >= :dateFrom' : '';
    const dateToWhere = dateToVal ? 'AND dp.DateCreate <= :dateTo' : '';

    const replacements = {
      ...(searchParam ? { search: searchParam } : {}),
      ...(dateFromVal ? { dateFrom: dateFromVal } : {}),
      ...(dateToVal ? { dateTo: dateToVal } : {}),
    };

    const countSql = `
      SELECT COUNT(*) as total
      FROM DepositHistory dp
      INNER JOIN UserApp u ON u.Id = dp.UserAppId
      INNER JOIN VnpIPNLog v ON v.vnp_TxnRef = dp.DepositCode
      WHERE dp.Message = N'Nạp tiền từ VNPay'
      ${searchWhere} ${dateFromWhere} ${dateToWhere}
    `;
    const listSql = `
      SELECT
        u.Id AS UserAppId,
        u.Fullname AS FullName,
        u.Phone,
        v.vnp_TransactionNo,
        dp.Amount,
        dp.DateCreate,
        v.vnp_BankCode,
        v.vnp_ResponseCode AS StatusCode
      FROM DepositHistory dp
      INNER JOIN UserApp u ON u.Id = dp.UserAppId
      INNER JOIN VnpIPNLog v ON v.vnp_TxnRef = dp.DepositCode
      WHERE dp.Message = N'Nạp tiền từ VNPay'
      ${searchWhere} ${dateFromWhere} ${dateToWhere}
      ORDER BY dp.DateCreate DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const [countResult, rows] = await Promise.all([
      sequelize.query(countSql, { replacements, type: sequelize.QueryTypes.SELECT }),
      sequelize.query(listSql, { replacements, type: sequelize.QueryTypes.SELECT }),
    ]);

    const total = parseInt(countResult[0]?.total || 0, 10);
    const data = rows.map((r) => ({
      userAppId: r.UserAppId ?? null,
      fullName: r.FullName ?? null,
      phone: r.Phone ?? null,
      transactionCode: r.vnp_TransactionNo ?? null,
      amount: r.Amount != null ? parseFloat(String(r.Amount)) : null,
      dateCreate: r.DateCreate ?? null,
      bankCode: r.vnp_BankCode ?? null,
      status: r.StatusCode ?? null,
    }));

    res.json({
      success: true,
      data,
      total,
      page,
      limit,
    });
  } catch (err) {
    console.error('VNPay transactions list error:', err.message, err.original?.message || '');
    if (err.name === 'SequelizeDatabaseError' || err.original?.code === 'EREQUEST') {
      return res.json({
        success: true,
        data: [],
        total: 0,
        page: 1,
        limit: req.query.limit ? Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20)) : 20,
      });
    }
    next(err);
  }
};

module.exports = {
  getVnpayTransactions,
};
