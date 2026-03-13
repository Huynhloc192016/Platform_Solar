const { sequelize } = require('../config/database');
const { getOwnerIdForFilter } = require('../utils/authorization.util');

// Tổng quan thống kê (Dashboard)
const getStats = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);

    const [
      totalStationsResult,
      activeStationsResult,
      totalChargePointsResult,
      chargePointsStatusResult,
      activeTransactionsResult,
      totalUsersResult,
      totalEnergyResult,
      todayEnergyResult,
      todayRevenueResult,
    ] = await Promise.all([
      sequelize.query(
        `SELECT COUNT(*) as count FROM ChargeStation ${ownerId ? `WHERE OwnerId = ${ownerId}` : ''}`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COUNT(*) as count FROM ChargeStation ${ownerId ? `WHERE OwnerId = ${ownerId} AND` : 'WHERE'} Status = 1`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COUNT(*) as count FROM ChargePoint ${ownerId ? `WHERE OwnerId = ${ownerId}` : ''}`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT cs.LastStatus as ChargePointState, COUNT(DISTINCT cs.ChargePointId) as count 
         FROM ConnectorStatus cs
         INNER JOIN ChargePoint cp ON cs.ChargePointId = cp.ChargePointId
         ${ownerId ? `WHERE cp.OwnerId = ${ownerId}` : ''}
         GROUP BY cs.LastStatus`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COUNT(*) as count 
         FROM Transactions 
         WHERE StopTime IS NULL 
         AND CAST(StartTime AS DATE) = CAST(GETDATE() AS DATE)`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COUNT(*) as count FROM UserApp ${ownerId ? `WHERE OwnerId = ${ownerId}` : ''}`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT ISNULL(SUM(CAST(MeterStop AS FLOAT) - CAST(MeterStart AS FLOAT)), 0) as total 
         FROM Transactions 
         WHERE MeterStop IS NOT NULL AND MeterStart IS NOT NULL`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT ISNULL(SUM(CAST(MeterStop AS FLOAT) - CAST(MeterStart AS FLOAT)), 0) as total 
         FROM Transactions 
         WHERE CAST(StartTime AS DATE) = CAST(GETDATE() AS DATE)
         AND MeterStop IS NOT NULL AND MeterStart IS NOT NULL`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT ISNULL(SUM(CAST(Amount AS DECIMAL(18,2))), 0) as total 
         FROM WalletTransaction 
         WHERE CAST(DateCreate AS DATE) = CAST(GETDATE() AS DATE) AND Amount > 0`,
        { type: sequelize.QueryTypes.SELECT }
      ),
    ]);

    const statusCounts = {
      Available: 0,
      Charging: 0,
      Unavailable: 0,
      Faulted: 0,
      Preparing: 0,
      Finishing: 0,
    };

    chargePointsStatusResult.forEach((item) => {
      const status = item.ChargePointState || 'Unavailable';
      if (Object.prototype.hasOwnProperty.call(statusCounts, status)) {
        statusCounts[status] = parseInt(item.count || 0, 10);
      } else {
        statusCounts.Unavailable += parseInt(item.count || 0, 10);
      }
    });

    const availableChargePoints = statusCounts.Available + statusCounts.Preparing;
    const chargingChargePoints = statusCounts.Charging + statusCounts.Finishing;
    const offlineChargePoints = statusCounts.Unavailable + statusCounts.Faulted;

    res.json({
      success: true,
      data: {
        totalStations: parseInt(totalStationsResult[0]?.count || 0, 10),
        activeStations: parseInt(activeStationsResult[0]?.count || 0, 10),
        totalChargePoints: parseInt(totalChargePointsResult[0]?.count || 0, 10),
        availableChargePoints,
        chargingChargePoints,
        offlineChargePoints,
        activeTransactions: parseInt(activeTransactionsResult[0]?.count || 0, 10),
        totalUsers: parseInt(totalUsersResult[0]?.count || 0, 10),
        totalEnergy: parseFloat(totalEnergyResult[0]?.total || 0) || 0,
        todayEnergy: parseFloat(todayEnergyResult[0]?.total || 0) || 0,
        todayRevenue: parseFloat(todayRevenueResult[0]?.total || 0) || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// 5 trụ gần nhất, ưu tiên đang sạc (Dashboard widget)
const getRecentChargePoints = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const ownerFilter = ownerId ? `AND cp.OwnerId = ${ownerId}` : '';

    const chargePoints = await sequelize.query(
      `SELECT TOP 5
        cp.ChargePointId,
        ISNULL(cp.Name, '') as Name,
        cp.ChargePointModel,
        cp.chargerPower,
        cp.outputType,
        cp.connectorType,
        cs.Name as StationName,
        cs.Status as StationStatus,
        ISNULL(o.Name, 'N/A') as OwnerName,
        cs2.LastStatus as ChargePointState,
        cs2.LastStatusTime
       FROM ChargePoint cp
       INNER JOIN ChargeStation cs ON cp.ChargeStationId = cs.ChargeStationId
       LEFT JOIN Owner o ON cs.OwnerId = o.OwnerId
       OUTER APPLY (
         SELECT TOP 1 LastStatus, LastStatusTime
         FROM ConnectorStatus cs2
         WHERE cs2.ChargePointId = cp.ChargePointId
         ORDER BY cs2.LastStatusTime DESC
       ) cs2
       WHERE 1=1 ${ownerFilter}
       ORDER BY 
         CASE WHEN cs2.LastStatus = 'Charging' THEN 0 ELSE 1 END,
         cs2.LastStatusTime DESC`,
      { type: sequelize.QueryTypes.SELECT }
    );

    const result = chargePoints.map((cp) => ({
      ChargePointId: cp.ChargePointId,
      Name: cp.Name || cp.ChargePointId,
      ChargePointModel: cp.ChargePointModel,
      chargerPower: cp.chargerPower,
      outputType: cp.outputType,
      connectorType: cp.connectorType,
      StationName: cp.StationName,
      StationStatus: cp.StationStatus,
      OwnerName: cp.OwnerName,
      ChargePointState: cp.ChargePointState || 'Unavailable',
      LastStatusTime: cp.LastStatusTime,
    }));

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 5 giao dịch gần đây (Dashboard widget)
const getRecentTransactions = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const whereClause = ownerId ? `WHERE cp.OwnerId = ${ownerId}` : '';

    const transactions = await sequelize.query(
      `SELECT TOP 5
        t.TransactionId,
        t.Uid,
        t.ChargePointId,
        t.StartTagId,
        t.StartTime,
        t.StopTime,
        t.MeterStart,
        t.MeterStop,
        ISNULL(cs.Name, 'N/A') as StationName,
        ISNULL(ua.Fullname, ISNULL(t.StartTagId, 'N/A')) as UserName,
        CASE WHEN t.StopTime IS NULL THEN 'active' ELSE 'completed' END as Status,
        CASE 
          WHEN t.MeterStop IS NOT NULL AND t.MeterStart IS NOT NULL 
          THEN CAST(t.MeterStop AS FLOAT) - CAST(t.MeterStart AS FLOAT) 
          ELSE 0 
        END as EnergyUsed,
        ISNULL(wt.Amount, 0) as Cost
       FROM Transactions t
       INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId
       LEFT JOIN ChargeStation cs ON cp.ChargeStationId = cs.ChargeStationId
       LEFT JOIN WalletTransaction wt ON wt.TransactionId = t.TransactionId
       LEFT JOIN UserApp ua ON ua.Id = wt.UserAppId
       ${whereClause}
       ORDER BY t.StartTime DESC`,
      { type: sequelize.QueryTypes.SELECT }
    );

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

// Năng lượng theo giờ trong ngày (0-23h) - chart dashboard
const getEnergyByHourToday = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);

    const ownerJoin = ownerId
      ? 'INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId'
      : '';
    const ownerWhere = ownerId ? `AND cp.OwnerId = ${ownerId}` : '';

    const rows = await sequelize.query(
      `SELECT 
         DATEPART(HOUR, t.StartTime) as Hour,
         ISNULL(SUM(CAST(t.MeterStop AS FLOAT) - CAST(t.MeterStart AS FLOAT)), 0) as Energy
       FROM Transactions t
       ${ownerJoin}
       WHERE 
         CAST(t.StartTime AS DATE) = CAST(GETDATE() AS DATE)
         AND t.MeterStart IS NOT NULL
         AND t.MeterStop IS NOT NULL
         ${ownerWhere}
       GROUP BY DATEPART(HOUR, t.StartTime)
       ORDER BY Hour`,
      { type: sequelize.QueryTypes.SELECT }
    );

    const data = [];
    for (let h = 0; h < 24; h += 1) {
      const row = rows.find((r) => parseInt(r.Hour, 10) === h);
      data.push({
        hour: h,
        energy: row ? parseFloat(row.Energy || 0) : 0,
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

// Doanh thu 7 ngày gần nhất - chart dashboard
const getRevenueLast7Days = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);

    const ownerJoin = ownerId
      ? 'INNER JOIN UserApp ua ON wt.UserAppId = ua.Id'
      : '';
    const ownerWhere = ownerId ? `AND ua.OwnerId = ${ownerId}` : '';

    const rows = await sequelize.query(
      `SELECT 
         CAST(wt.DateCreate AS DATE) as DateOnly,
         ISNULL(SUM(CAST(wt.Amount AS DECIMAL(18,2))), 0) as Revenue
       FROM WalletTransaction wt
       ${ownerJoin}
       WHERE 
         wt.Amount > 0
         AND CAST(wt.DateCreate AS DATE) >= DATEADD(DAY, -6, CAST(GETDATE() AS DATE))
         AND CAST(wt.DateCreate AS DATE) <= CAST(GETDATE() AS DATE)
         ${ownerWhere}
       GROUP BY CAST(wt.DateCreate AS DATE)
       ORDER BY DateOnly`,
      { type: sequelize.QueryTypes.SELECT }
    );

    const today = new Date();
    const normalizeDate = (d) => d.toISOString().slice(0, 10);

    const map = new Map();
    rows.forEach((r) => {
      const key = normalizeDate(new Date(r.DateOnly));
      map.set(key, parseFloat(r.Revenue || 0));
    });

    const data = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = normalizeDate(d);
      data.push({
        date: key,
        revenue: map.get(key) || 0,
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStats,
  getRecentChargePoints,
  getRecentTransactions,
  getEnergyByHourToday,
  getRevenueLast7Days,
};

