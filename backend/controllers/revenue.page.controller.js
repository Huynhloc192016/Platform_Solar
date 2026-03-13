const { sequelize } = require('../config/database');
const { getOwnerIdForFilter } = require('../utils/authorization.util');

/**
 * Doanh thu theo ngày trong tháng (WalletTransaction, Amount > 0).
 * Query: month (1-12), year.
 */
const getRevenueDaily = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const month = Math.max(1, Math.min(12, parseInt(req.query.month, 10) || new Date().getMonth() + 1));
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    const ownerJoin = ownerId ? 'INNER JOIN UserApp ua ON wt.UserAppId = ua.Id' : '';
    const ownerWhere = ownerId ? `AND ua.OwnerId = ${ownerId}` : '';

    const rows = await sequelize.query(
      `SELECT 
         CAST(wt.DateCreate AS DATE) AS DateOnly,
         ISNULL(SUM(CAST(wt.Amount AS DECIMAL(18,2))), 0) AS Revenue
       FROM WalletTransaction wt
       ${ownerJoin}
       WHERE wt.Amount > 0
         AND YEAR(wt.DateCreate) = :year
         AND MONTH(wt.DateCreate) = :month
         ${ownerWhere}
       GROUP BY CAST(wt.DateCreate AS DATE)
       ORDER BY DateOnly`,
      {
        replacements: { year, month },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const data = (rows || []).map((r) => ({
      date: r.DateOnly ? new Date(r.DateOnly).toISOString().slice(0, 10) : null,
      amount: parseFloat(r.Revenue || 0),
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

/**
 * Doanh thu theo tháng trong năm (WalletTransaction, Amount > 0).
 * Query: year.
 */
const getRevenueMonthly = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();

    const ownerJoin = ownerId ? 'INNER JOIN UserApp ua ON wt.UserAppId = ua.Id' : '';
    const ownerWhere = ownerId ? `AND ua.OwnerId = ${ownerId}` : '';

    const rows = await sequelize.query(
      `SELECT 
         MONTH(wt.DateCreate) AS MonthNum,
         ISNULL(SUM(CAST(wt.Amount AS DECIMAL(18,2))), 0) AS Revenue
       FROM WalletTransaction wt
       ${ownerJoin}
       WHERE wt.Amount > 0
         AND YEAR(wt.DateCreate) = :year
         ${ownerWhere}
       GROUP BY MONTH(wt.DateCreate)
       ORDER BY MonthNum`,
      {
        replacements: { year },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const monthNames = [
      'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
      'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
    ];
    const data = (rows || []).map((r) => ({
      month: r.MonthNum,
      monthName: monthNames[(r.MonthNum || 1) - 1] || `Tháng ${r.MonthNum}`,
      amount: parseFloat(r.Revenue || 0),
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getRevenueDaily,
  getRevenueMonthly,
};
