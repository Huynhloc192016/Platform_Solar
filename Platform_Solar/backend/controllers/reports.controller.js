const { sequelize } = require('../config/database');
const { getOwnerIdForFilter } = require('../utils/authorization.util');

const parseDateRange = (req) => {
  const { from, to } = req.query || {};
  const now = new Date();
  const toDate = to ? new Date(to) : now;
  const fromDate = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

  const normalize = (d) => d.toISOString().slice(0, 10);

  return {
    from: normalize(fromDate),
    to: normalize(toDate),
  };
};

// KPI overview for reports dashboard
const getReportsKpi = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const { from, to } = parseDateRange(req);

    const ownerJoinTx = ownerId
      ? 'INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId INNER JOIN ChargeStation cs ON cp.ChargeStationId = cs.ChargeStationId'
      : '';
    const ownerWhereTx = ownerId ? 'AND cs.OwnerId = :ownerId' : '';

    const ownerJoinWt = ownerId
      ? 'INNER JOIN UserApp ua ON wt.UserAppId = ua.Id'
      : '';
    const ownerWhereWt = ownerId ? 'AND ua.OwnerId = :ownerId' : '';

    const [energyRows, revenueRows, sessionsRows, activeStationsRows] = await Promise.all([
      sequelize.query(
        `SELECT 
           ISNULL(SUM(CAST(t.MeterStop AS FLOAT) - CAST(t.MeterStart AS FLOAT)), 0) AS TotalEnergy
         FROM Transactions t
         ${ownerJoinTx}
         WHERE 
           t.MeterStart IS NOT NULL
           AND t.MeterStop IS NOT NULL
           AND CAST(t.StartTime AS DATE) BETWEEN :from AND :to
           ${ownerWhereTx}`,
        {
          replacements: { from, to, ownerId },
          type: sequelize.QueryTypes.SELECT,
        }
      ),
      sequelize.query(
        `SELECT 
           ISNULL(SUM(CAST(wt.Amount AS DECIMAL(18,2))), 0) AS TotalRevenue
         FROM WalletTransaction wt
         ${ownerJoinWt}
         WHERE 
           wt.Amount > 0
           AND CAST(wt.DateCreate AS DATE) BETWEEN :from AND :to
           ${ownerWhereWt}`,
        {
          replacements: { from, to, ownerId },
          type: sequelize.QueryTypes.SELECT,
        }
      ),
      sequelize.query(
        `SELECT COUNT(*) AS TotalSessions
         FROM Transactions t
         ${ownerJoinTx}
         WHERE CAST(t.StartTime AS DATE) BETWEEN :from AND :to
         ${ownerWhereTx}`,
        {
          replacements: { from, to, ownerId },
          type: sequelize.QueryTypes.SELECT,
        }
      ),
      sequelize.query(
        `SELECT COUNT(DISTINCT cs.ChargeStationId) AS ActiveStations
         FROM Transactions t
         INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId
         INNER JOIN ChargeStation cs ON cp.ChargeStationId = cs.ChargeStationId
         WHERE CAST(t.StartTime AS DATE) BETWEEN :from AND :to
         ${ownerId ? 'AND cs.OwnerId = :ownerId' : ''}`,
        {
          replacements: { from, to, ownerId },
          type: sequelize.QueryTypes.SELECT,
        }
      ),
    ]);

    res.json({
      success: true,
      data: {
        totalEnergy: parseFloat(energyRows[0]?.TotalEnergy || 0),
        totalRevenue: parseFloat(revenueRows[0]?.TotalRevenue || 0),
        totalSessions: parseInt(sessionsRows[0]?.TotalSessions || 0, 10),
        activeStations: parseInt(activeStationsRows[0]?.ActiveStations || 0, 10),
      },
    });
  } catch (err) {
    next(err);
  }
};

// Energy trend by day
const getEnergyTrend = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const { from, to } = parseDateRange(req);

    const rows = await sequelize.query(
      `SELECT 
         CAST(t.StartTime AS DATE) AS DateOnly,
         ISNULL(SUM(CAST(t.MeterStop AS FLOAT) - CAST(t.MeterStart AS FLOAT)), 0) AS TotalEnergy
       FROM Transactions t
       INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId
       INNER JOIN ChargeStation cs ON cp.ChargeStationId = cs.ChargeStationId
       WHERE 
         t.MeterStart IS NOT NULL
         AND t.MeterStop IS NOT NULL
         AND CAST(t.StartTime AS DATE) BETWEEN :from AND :to
         ${ownerId ? 'AND cs.OwnerId = :ownerId' : ''}
       GROUP BY CAST(t.StartTime AS DATE)
       ORDER BY DateOnly`,
      {
        replacements: { from, to, ownerId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const data = (rows || []).map((r) => ({
      date: r.DateOnly ? new Date(r.DateOnly).toISOString().slice(0, 10) : null,
      energy: parseFloat(r.TotalEnergy || 0),
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Revenue trend by day (WalletTransaction)
const getRevenueTrend = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const { from, to } = parseDateRange(req);

    const ownerJoin = ownerId ? 'INNER JOIN UserApp ua ON wt.UserAppId = ua.Id' : '';
    const ownerWhere = ownerId ? 'AND ua.OwnerId = :ownerId' : '';

    const rows = await sequelize.query(
      `SELECT 
         CAST(wt.DateCreate AS DATE) AS DateOnly,
         ISNULL(SUM(CAST(wt.Amount AS DECIMAL(18,2))), 0) AS Revenue
       FROM WalletTransaction wt
       ${ownerJoin}
       WHERE 
         wt.Amount > 0
         AND CAST(wt.DateCreate AS DATE) BETWEEN :from AND :to
         ${ownerWhere}
       GROUP BY CAST(wt.DateCreate AS DATE)
       ORDER BY DateOnly`,
      {
        replacements: { from, to, ownerId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const data = (rows || []).map((r) => ({
      date: r.DateOnly ? new Date(r.DateOnly).toISOString().slice(0, 10) : null,
      revenue: parseFloat(r.Revenue || 0),
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Top stations by revenue
const getTopStations = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const { from, to } = parseDateRange(req);
    const limit = parseInt(req.query.limit, 10) || 10;

    const ownerJoin = ownerId ? 'INNER JOIN UserApp ua ON wt.UserAppId = ua.Id' : '';
    const ownerWhere = ownerId ? 'AND ua.OwnerId = :ownerId' : '';

    const rows = await sequelize.query(
      `SELECT TOP (:limit)
         cs.ChargeStationId,
         ISNULL(cs.Name, 'N/A') AS StationName,
         ISNULL(SUM(CAST(wt.Amount AS DECIMAL(18,2))), 0) AS Revenue
       FROM WalletTransaction wt
       INNER JOIN Transactions t ON wt.TransactionId = t.TransactionId
       INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId
       INNER JOIN ChargeStation cs ON cp.ChargeStationId = cs.ChargeStationId
       ${ownerJoin}
       WHERE 
         wt.Amount > 0
         AND CAST(wt.DateCreate AS DATE) BETWEEN :from AND :to
         ${ownerWhere}
       GROUP BY cs.ChargeStationId, cs.Name
       ORDER BY Revenue DESC`,
      {
        replacements: { from, to, limit, ownerId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const data = (rows || []).map((r) => ({
      stationId: r.ChargeStationId,
      stationName: r.StationName,
      revenue: parseFloat(r.Revenue || 0),
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Sessions by hour for selected date range
const getSessionsByHour = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const { from, to } = parseDateRange(req);

    const rows = await sequelize.query(
      `SELECT 
         DATEPART(HOUR, t.StartTime) AS Hour,
         COUNT(*) AS Sessions
       FROM Transactions t
       INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId
       INNER JOIN ChargeStation cs ON cp.ChargeStationId = cs.ChargeStationId
       WHERE 
         CAST(t.StartTime AS DATE) BETWEEN :from AND :to
         ${ownerId ? 'AND cs.OwnerId = :ownerId' : ''}
       GROUP BY DATEPART(HOUR, t.StartTime)
       ORDER BY Hour`,
      {
        replacements: { from, to, ownerId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const data = [];
    for (let h = 0; h < 24; h += 1) {
      const row = rows.find((r) => parseInt(r.Hour, 10) === h);
      data.push({
        hour: h,
        sessions: parseInt(row?.Sessions || 0, 10),
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

// Utilization per station based on session duration vs total available time
const getUtilization = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const { from, to } = parseDateRange(req);

    const rows = await sequelize.query(
      `WITH SessionAgg AS (
         SELECT 
           cs.ChargeStationId,
           ISNULL(cs.Name, 'N/A') AS StationName,
           COUNT(*) AS Sessions,
           ISNULL(SUM(CAST(t.MeterStop AS FLOAT) - CAST(t.MeterStart AS FLOAT)), 0) AS Energy,
           ISNULL(SUM(CAST(wt.Amount AS DECIMAL(18,2))), 0) AS Revenue,
           ISNULL(SUM(DATEDIFF(MINUTE, t.StartTime, t.StopTime)), 0) AS ChargingMinutes
         FROM Transactions t
         INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId
         INNER JOIN ChargeStation cs ON cp.ChargeStationId = cs.ChargeStationId
         LEFT JOIN WalletTransaction wt ON wt.TransactionId = t.TransactionId
         WHERE 
           CAST(t.StartTime AS DATE) BETWEEN :from AND :to
           ${ownerId ? 'AND cs.OwnerId = :ownerId' : ''}
         GROUP BY cs.ChargeStationId, cs.Name
       ),
       ConnectorCount AS (
         SELECT 
           cs.ChargeStationId,
           COUNT(DISTINCT cp.ChargePointId) AS ChargePointCount
         FROM ChargeStation cs
         INNER JOIN ChargePoint cp ON cs.ChargeStationId = cp.ChargeStationId
         ${ownerId ? 'WHERE cs.OwnerId = :ownerId' : ''}
         GROUP BY cs.ChargeStationId
       )
       SELECT 
         s.ChargeStationId,
         s.StationName,
         s.Sessions,
         s.Energy,
         s.Revenue,
         s.ChargingMinutes,
         c.ChargePointCount
       FROM SessionAgg s
       INNER JOIN ConnectorCount c ON s.ChargeStationId = c.ChargeStationId`,
      {
        replacements: { from, to, ownerId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const fromDate = new Date(from);
    const toDate = new Date(to);
    const totalMinutesRange = Math.max(
      0,
      Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60)) || 0
    );

    const data = (rows || []).map((r) => {
      const connectorCount = parseInt(r.ChargePointCount || 0, 10) || 1;
      const totalAvailableMinutes = connectorCount * totalMinutesRange;
      const chargingMinutes = parseInt(r.ChargingMinutes || 0, 10);
      const utilizationPct =
        totalAvailableMinutes > 0 ? (chargingMinutes * 100.0) / totalAvailableMinutes : 0;

      return {
        stationId: r.ChargeStationId,
        stationName: r.StationName,
        sessions: parseInt(r.Sessions || 0, 10),
        energy: parseFloat(r.Energy || 0),
        revenue: parseFloat(r.Revenue || 0),
        utilizationPct,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getReportsKpi,
  getEnergyTrend,
  getRevenueTrend,
  getTopStations,
  getSessionsByHour,
  getUtilization,
};

