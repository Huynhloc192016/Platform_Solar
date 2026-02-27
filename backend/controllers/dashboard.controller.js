const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const { hashPassword } = require('../utils/password.util');

// Tổng quan thống kê
const getStats = async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId; // From JWT token (can be null for admin)
    
    // Query stats using raw SQL queries
    const [
      totalStationsResult,
      activeStationsResult,
      totalChargePointsResult,
      chargePointsStatusResult,
      activeTransactionsResult,
      totalUsersResult,
      totalEnergyResult,
      todayEnergyResult,
      todayRevenueResult
    ] = await Promise.all([
      // Total stations
      sequelize.query(
        `SELECT COUNT(*) as count FROM ChargeStation ${ownerId ? `WHERE OwnerId = ${ownerId}` : ''}`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      // Active stations (Status = 1 or active)
      sequelize.query(
        `SELECT COUNT(*) as count FROM ChargeStation ${ownerId ? `WHERE OwnerId = ${ownerId} AND` : 'WHERE'} Status = 1`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      // Total charge points
      sequelize.query(
        `SELECT COUNT(*) as count FROM ChargePoint ${ownerId ? `WHERE OwnerId = ${ownerId}` : ''}`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      // Charge points by status (from ConnectorStatus)
      sequelize.query(
        `SELECT cs.LastStatus as ChargePointState, COUNT(DISTINCT cs.ChargePointId) as count 
         FROM ConnectorStatus cs
         INNER JOIN ChargePoint cp ON cs.ChargePointId = cp.ChargePointId
         ${ownerId ? `WHERE cp.OwnerId = ${ownerId}` : ''}
         GROUP BY cs.LastStatus`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      // Active transactions (StopTime IS NULL AND StartTime is today - realtime)
      sequelize.query(
        `SELECT COUNT(*) as count 
         FROM Transactions 
         WHERE StopTime IS NULL 
         AND CAST(StartTime AS DATE) = CAST(GETDATE() AS DATE)`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      // Total users
      sequelize.query(
        `SELECT COUNT(*) as count FROM UserApp ${ownerId ? `WHERE OwnerId = ${ownerId}` : ''}`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      // Total energy (from Transactions - MeterStop - MeterStart)
      sequelize.query(
        `SELECT ISNULL(SUM(CAST(MeterStop AS FLOAT) - CAST(MeterStart AS FLOAT)), 0) as total 
         FROM Transactions 
         WHERE MeterStop IS NOT NULL AND MeterStart IS NOT NULL`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      // Today energy
      sequelize.query(
        `SELECT ISNULL(SUM(CAST(MeterStop AS FLOAT) - CAST(MeterStart AS FLOAT)), 0) as total 
         FROM Transactions 
         WHERE CAST(StartTime AS DATE) = CAST(GETDATE() AS DATE)
         AND MeterStop IS NOT NULL AND MeterStart IS NOT NULL`,
        { type: sequelize.QueryTypes.SELECT }
      ),
      // Today revenue (from WalletTransaction)
      sequelize.query(
        `SELECT ISNULL(SUM(CAST(Amount AS DECIMAL(18,2))), 0) as total 
         FROM WalletTransaction 
         WHERE CAST(DateCreate AS DATE) = CAST(GETDATE() AS DATE) AND Amount > 0`,
        { type: sequelize.QueryTypes.SELECT }
      )
    ]);
    
    // Process charge points status
    const statusCounts = {
      Available: 0,
      Charging: 0,
      Unavailable: 0,
      Faulted: 0,
      Preparing: 0,
      Finishing: 0
    };
    
    chargePointsStatusResult.forEach(item => {
      const status = item.ChargePointState || 'Unavailable';
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status] = parseInt(item.count || 0);
      } else {
        statusCounts.Unavailable += parseInt(item.count || 0);
      }
    });
    
    // Calculate available = Available + Preparing
    const availableChargePoints = statusCounts.Available + statusCounts.Preparing;
    const chargingChargePoints = statusCounts.Charging + statusCounts.Finishing;
    const offlineChargePoints = statusCounts.Unavailable + statusCounts.Faulted;
    
    res.json({
      success: true,
      data: {
        totalStations: parseInt(totalStationsResult[0]?.count || 0),
        activeStations: parseInt(activeStationsResult[0]?.count || 0),
        totalChargePoints: parseInt(totalChargePointsResult[0]?.count || 0),
        availableChargePoints: availableChargePoints,
        chargingChargePoints: chargingChargePoints,
        offlineChargePoints: offlineChargePoints,
        activeTransactions: parseInt(activeTransactionsResult[0]?.count || 0),
        totalUsers: parseInt(totalUsersResult[0]?.count || 0),
        totalEnergy: parseFloat(totalEnergyResult[0]?.total || 0) || 0,
        todayEnergy: parseFloat(todayEnergyResult[0]?.total || 0) || 0,
        todayRevenue: parseFloat(todayRevenueResult[0]?.total || 0) || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// Danh sách trạm + trụ
const getStations = async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    const whereClause = ownerId ? `WHERE cs.OwnerId = ${ownerId}` : '';

    let stations;
    try {
      stations = await sequelize.query(
        `SELECT
          cs.ChargeStationId,
          cs.Name,
          cs.Address,
          cs.Status,
          CASE WHEN ISNULL(cs.Type, 1) = 1 THEN 'Public' ELSE 'Private' END as Type,
          cs.Lat AS Latitude,
          cs.Long AS Longitude,
          cs.QtyChargePoint,
          cs.OwnerId,
          ISNULL(o.Name, 'N/A') as OwnerName,
          (SELECT COUNT(*) FROM Transactions t 
           INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId 
           WHERE cp.ChargeStationId = cs.ChargeStationId AND t.StopTime IS NULL) as ActiveTransactions
         FROM ChargeStation cs
         LEFT JOIN Owner o ON cs.OwnerId = o.OwnerId
         ${whereClause}
         ORDER BY cs.CreateDate DESC`,
        { type: sequelize.QueryTypes.SELECT }
      );
    } catch (colError) {
      // Thu thập message từ Sequelize/tedious (có thể nằm trong original.errors khi colError.message rỗng)
      const parts = [
        colError.message,
        colError.original?.message,
        colError.parent?.message
      ].filter(Boolean);
      const errList = colError.original?.errors || colError.parent?.errors;
      if (Array.isArray(errList)) {
        errList.forEach(e => {
          const item = Array.isArray(e) ? e[0] : e;
          if (item && item.message) parts.push(item.message);
        });
      }
      const fullMessage = (parts.join(' ') || '').toLowerCase();
      const isColumnError =
        (fullMessage.includes('invalid column') && (fullMessage.includes('type') || fullMessage.includes('latitude') || fullMessage.includes('longitude') || fullMessage.includes(' lat') || fullMessage.includes(' long'))) ||
        /invalid column name\s+'?(type|latitude|longitude|lat|long)'?/i.test(fullMessage);
      if (!isColumnError) {
        return next(colError);
      }
      // Bảng chưa có cột Type/Latitude/Longitude — chạy script add-chargestation-type-lat-long.sql
      stations = await sequelize.query(
        `SELECT
          cs.ChargeStationId,
          cs.Name,
          cs.Address,
          cs.Status,
          cs.QtyChargePoint,
          cs.OwnerId,
          ISNULL(o.Name, 'N/A') as OwnerName,
          (SELECT COUNT(*) FROM Transactions t 
           INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId 
           WHERE cp.ChargeStationId = cs.ChargeStationId AND t.StopTime IS NULL) as ActiveTransactions
         FROM ChargeStation cs
         LEFT JOIN Owner o ON cs.OwnerId = o.OwnerId
         ${whereClause}
         ORDER BY cs.CreateDate DESC`,
        { type: sequelize.QueryTypes.SELECT }
      );
      stations = stations.map(s => ({ ...s, Type: 'Public', Latitude: null, Longitude: null }));
    }

    // Get charge points for each station
    for (let station of stations) {
      const ownerFilter = ownerId ? `AND cp.OwnerId = ${ownerId}` : '';
      
      try {
        const chargePoints = await sequelize.query(
          `SELECT DISTINCT
            cp.ChargePointId,
            ISNULL(cp.Name, '') as Name,
            cp.ChargePointModel,
            cp.chargerPower,
            cp.outputType,
            cp.connectorType,
            (SELECT TOP 1 cs.LastStatus 
             FROM ConnectorStatus cs 
             WHERE cs.ChargePointId = cp.ChargePointId 
             ORDER BY cs.LastStatusTime DESC) as ChargePointState
           FROM ChargePoint cp
           WHERE cp.ChargeStationId = ${station.ChargeStationId} ${ownerFilter}
           ORDER BY cp.ChargePointId`,
          { type: sequelize.QueryTypes.SELECT }
        );

        // Map charge points and set default status if null
        station.ChargePoints = chargePoints.map(cp => ({
          ChargePointId: cp.ChargePointId,
          Name: cp.Name || null,
          ChargePointModel: cp.ChargePointModel,
          chargerPower: cp.chargerPower,
          outputType: cp.outputType,
          connectorType: cp.connectorType,
          ChargePointState: cp.ChargePointState || 'Unavailable'
        }));
      } catch (cpError) {
        // If Name column doesn't exist, try without it
        console.error('Error fetching charge points with Name, trying without Name:', cpError.message);
        const chargePoints = await sequelize.query(
          `SELECT DISTINCT
            cp.ChargePointId,
            cp.ChargePointModel,
            cp.chargerPower,
            cp.outputType,
            cp.connectorType,
            (SELECT TOP 1 cs.LastStatus 
             FROM ConnectorStatus cs 
             WHERE cs.ChargePointId = cp.ChargePointId 
             ORDER BY cs.LastStatusTime DESC) as ChargePointState
           FROM ChargePoint cp
           WHERE cp.ChargeStationId = ${station.ChargeStationId} ${ownerFilter}
           ORDER BY cp.ChargePointId`,
          { type: sequelize.QueryTypes.SELECT }
        );

        station.ChargePoints = chargePoints.map(cp => ({
          ChargePointId: cp.ChargePointId,
          Name: null,
          ChargePointModel: cp.ChargePointModel,
          chargerPower: cp.chargerPower,
          outputType: cp.outputType,
          connectorType: cp.connectorType,
          ChargePointState: cp.ChargePointState || 'Unavailable'
        }));
      }
    }
    
    res.json({
      success: true,
      data: stations
    });
  } catch (error) {
    console.error('Error in getStations:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    next(error);
  }
};

// 5 trụ gần nhất, ưu tiên đang sạc
const getRecentChargePoints = async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    const ownerFilter = ownerId ? `AND cp.OwnerId = ${ownerId}` : '';
    
    // Lấy 5 trụ gần nhất, ưu tiên trụ đang sạc
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

    const result = chargePoints.map(cp => ({
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
      LastStatusTime: cp.LastStatusTime
    }));
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getRecentChargePoints:', error);
    next(error);
  }
};

// 5 giao dịch gần đây
const getRecentTransactions = async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    const whereClause = ownerId 
      ? `WHERE cp.OwnerId = ${ownerId}` 
      : '';
    
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
      data: transactions
    });
  } catch (error) {
    next(error);
  }
};

// Danh sách phiên sạc (quản lý phiên sạc)
const getChargingSessions = async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
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
      dateFromVal = dateFromRaw + ' 00:00:00';
    }
    if (dateToRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateToRaw)) {
      dateToVal = dateToRaw + ' 23:59:59';
    }

    const dateFromWhere = dateFromVal ? `t.StartTime >= :dateFrom` : '';
    const dateToWhere = dateToVal ? `t.StartTime <= :dateTo` : '';
    const dateWhereParts = [dateFromWhere, dateToWhere].filter(Boolean);
    const dateWhere = dateWhereParts.length ? dateWhereParts.join(' AND ') : '';

    const whereParts = [ownerWhere, searchWhere, dateWhere].filter(Boolean);
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const replacements = { ...(searchParam ? { search: searchParam } : {}), ...(dateFromVal ? { dateFrom: dateFromVal } : {}), ...(dateToVal ? { dateTo: dateToVal } : {}) };

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
      ConnectionStatus: row.StartTime != null ? 'Kết nối thành công' : 'Kết nối thất bại',
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

// Danh sách đơn sạc (quản lý đơn sạc)
const getChargingOrders = async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const searchRaw = (req.query.search || '').trim();
    const searchParam = searchRaw ? `%${searchRaw}%` : null;
    const dateFromRaw = (req.query.dateFrom || '').trim();
    const dateToRaw = (req.query.dateTo || '').trim();

    const ownerJoin = ownerId ? 'INNER JOIN UserApp ua ON wt.UserAppId = ua.Id' : '';
    const ownerWhere = ownerId ? `AND ua.OwnerId = ${ownerId}` : '';
    const searchWhere = searchParam
      ? `AND (CAST(wt.WalletTransactionId AS NVARCHAR(50)) LIKE :search OR CAST(wt.UserAppId AS NVARCHAR(50)) LIKE :search OR CAST(wt.TransactionId AS NVARCHAR(50)) LIKE :search)`
      : '';

    let dateFromVal = null;
    let dateToVal = null;
    if (dateFromRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateFromRaw)) dateFromVal = dateFromRaw + ' 00:00:00';
    if (dateToRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateToRaw)) dateToVal = dateToRaw + ' 23:59:59';
    const dateFromWhere = dateFromVal ? 'AND wt.DateCreate >= :dateFrom' : '';
    const dateToWhere = dateToVal ? 'AND wt.DateCreate <= :dateTo' : '';

    const replacements = { ...(searchParam ? { search: searchParam } : {}), ...(dateFromVal ? { dateFrom: dateFromVal } : {}), ...(dateToVal ? { dateTo: dateToVal } : {}) };

    const countResult = await sequelize.query(
      `SELECT COUNT(*) as total
       FROM WalletTransaction wt
       ${ownerJoin}
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
       ${ownerJoin}
       WHERE 1=1 ${ownerWhere} ${searchWhere} ${dateFromWhere} ${dateToWhere}
       ORDER BY wt.DateCreate DESC
       OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );

    const data = orders.map((row) => ({
      WalletTransactionId: row.WalletTransactionId,
      UserAppId: row.UserAppId,
      TransactionId: row.TransactionId,
      EnergyUsed: row.EnergyUsed != null ? row.EnergyUsed : (row.MeterValue ?? row.meterValue),
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

// Cập nhật phiên sạc
const updateSession = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.ownerId;
    const { StartTime, StopTime, MeterStart, MeterStop } = req.body;

    const ownerFilter = ownerId
      ? `AND EXISTS (SELECT 1 FROM ChargePoint cp WHERE cp.ChargePointId = t.ChargePointId AND cp.OwnerId = ${ownerId})`
      : '';
    const [existing] = await sequelize.query(
      `SELECT t.TransactionId FROM Transactions t WHERE t.TransactionId = :id ${ownerFilter}`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiên sạc hoặc không có quyền.' });
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
    const { id } = req.params;
    const ownerId = req.user?.ownerId;

    const ownerFilter = ownerId
      ? `AND EXISTS (SELECT 1 FROM ChargePoint cp WHERE cp.ChargePointId = t.ChargePointId AND cp.OwnerId = ${ownerId})`
      : '';
    const [existing] = await sequelize.query(
      `SELECT t.TransactionId FROM Transactions t WHERE t.TransactionId = :id ${ownerFilter}`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiên sạc hoặc không có quyền.' });
    }

    await sequelize.query('DELETE FROM WalletTransaction WHERE TransactionId = :id', { replacements: { id } });
    await sequelize.query('DELETE FROM Transactions WHERE TransactionId = :id', { replacements: { id } });
    res.json({ success: true, message: 'Đã xóa phiên sạc.' });
  } catch (error) {
    next(error);
  }
};

// Cập nhật đơn sạc
const updateOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.ownerId;
    const { Amount, meterValue, stopMethod, currentBalance, newBalance, UserAppId } = req.body;

    const ownerJoin = ownerId ? 'INNER JOIN UserApp ua ON wt.UserAppId = ua.Id' : '';
    const ownerWhere = ownerId ? `AND ua.OwnerId = ${ownerId}` : '';
    const [existing] = await sequelize.query(
      `SELECT wt.WalletTransactionId FROM WalletTransaction wt ${ownerJoin} WHERE wt.WalletTransactionId = :id ${ownerWhere}`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn sạc hoặc không có quyền.' });
    }

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
    res.json({ success: true, message: 'Cập nhật đơn sạc thành công.' });
  } catch (error) {
    next(error);
  }
};

// Xóa đơn sạc
const deleteOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ownerId = req.user?.ownerId;

    const ownerJoin = ownerId ? 'INNER JOIN UserApp ua ON wt.UserAppId = ua.Id' : '';
    const ownerWhere = ownerId ? `AND ua.OwnerId = ${ownerId}` : '';
    const [existing] = await sequelize.query(
      `SELECT wt.WalletTransactionId FROM WalletTransaction wt ${ownerJoin} WHERE wt.WalletTransactionId = :id ${ownerWhere}`,
      { replacements: { id }, type: sequelize.QueryTypes.SELECT }
    );
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn sạc hoặc không có quyền.' });
    }

    await sequelize.query('DELETE FROM WalletTransaction WHERE WalletTransactionId = :id', { replacements: { id } });
    res.json({ success: true, message: 'Đã xóa đơn sạc.' });
  } catch (error) {
    next(error);
  }
};

// Năng lượng theo giờ trong ngày (0-23h)
const getEnergyByHourToday = async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;

    // Nếu lọc theo Owner, join với ChargePoint để lấy OwnerId
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

    // Chuẩn hoá đủ 24 giờ
    const data = [];
    for (let h = 0; h < 24; h++) {
      const row = rows.find(r => parseInt(r.Hour) === h);
      data.push({
        hour: h,
        energy: row ? parseFloat(row.Energy || 0) : 0
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// Doanh thu 7 ngày gần nhất
const getRevenueLast7Days = async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;

    // Nếu có OwnerId thì join với UserApp để lọc theo Owner
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

    // Chuẩn hoá đủ 7 ngày (từ -6 đến hôm nay)
    const today = new Date();
    const normalizeDate = d => d.toISOString().slice(0, 10);

    const map = new Map();
    rows.forEach(r => {
      const key = normalizeDate(new Date(r.DateOnly));
      map.set(key, parseFloat(r.Revenue || 0));
    });

    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = normalizeDate(d);
      data.push({
        date: key,
        revenue: map.get(key) || 0
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};

// Thêm trạm sạc mới
const createStation = async (req, res, next) => {
  try {
    const { Name, Address, OwnerId, Status, Type, Latitude, Longitude } = req.body;
    const userOwnerId = req.user?.ownerId;
    const ownerId = OwnerId || userOwnerId;

    if (!Name || !Address) {
      return res.status(400).json({
        success: false,
        message: 'Tên và địa chỉ trạm là bắt buộc',
      });
    }

    const baseReplacements = {
      name: Name.trim(),
      address: Address.trim(),
      status: Status !== undefined && Status !== null ? Status : 1,
      ownerId: ownerId || null,
    };

    try {
      await sequelize.query(
        `INSERT INTO ChargeStation (Name, Address, Status, Type, Lat, Long, QtyChargePoint, OwnerId, CreateDate)
         VALUES (:name, :address, :status, :type, :lat, :long, 0, :ownerId, GETDATE())`,
        {
          replacements: {
            ...baseReplacements,
            type: (Type && String(Type).trim().toLowerCase() === 'private') ? 0 : 1,
            lat: Latitude != null && Latitude !== '' ? parseFloat(Latitude) : null,
            long: Longitude != null && Longitude !== '' ? parseFloat(Longitude) : null,
          },
        }
      );
    } catch (insertErr) {
      const insertMsg = (insertErr.message || '') + (insertErr.original?.message || '');
      if (insertMsg.includes('Invalid column') && (insertMsg.includes('Type') || insertMsg.includes('Latitude') || insertMsg.includes('Longitude') || insertMsg.includes('Lat') || insertMsg.includes('Long'))) {
        await sequelize.query(
          `INSERT INTO ChargeStation (Name, Address, Status, QtyChargePoint, OwnerId, CreateDate)
           VALUES (:name, :address, :status, 0, :ownerId, GETDATE())`,
          { replacements: baseReplacements }
        );
      } else {
        throw insertErr;
      }
    }

    res.json({
      success: true,
      message: 'Đã thêm trạm sạc thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Cập nhật trạm sạc
const updateStation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { Name, Address, OwnerId, Status, Type, Latitude, Longitude } = req.body;
    const userOwnerId = req.user?.ownerId;

    if (!id) {
      return res.status(400).json({ success: false, message: 'ID trạm không hợp lệ' });
    }
    if (!Name || !Address) {
      return res.status(400).json({
        success: false,
        message: 'Tên và địa chỉ trạm là bắt buộc',
      });
    }

    const ownerFilter = userOwnerId ? `AND OwnerId = ${userOwnerId}` : '';
    const replacements = {
      id: parseInt(id, 10),
      name: Name.trim(),
      address: Address.trim(),
      ownerId: OwnerId ? parseInt(OwnerId, 10) : userOwnerId || null,
      status: Status !== undefined && Status !== null ? Status : undefined,
      type: (Type && String(Type).trim().toLowerCase() === 'private') ? 0 : 1,
      lat: Latitude != null && Latitude !== '' ? parseFloat(Latitude) : null,
      long: Longitude != null && Longitude !== '' ? parseFloat(Longitude) : null,
    };

    let updateSql = `UPDATE ChargeStation SET Name = :name, Address = :address, OwnerId = :ownerId, Type = :type, Lat = :lat, Long = :long`;
    if (Status !== undefined && Status !== null) {
      updateSql += `, Status = :status`;
    }
    updateSql += ` WHERE ChargeStationId = :id ${ownerFilter}`;

    try {
      await sequelize.query(updateSql, { replacements });
    } catch (updateErr) {
      const updateMsg = (updateErr.message || '') + (updateErr.original?.message || '');
      if (updateMsg.includes('Invalid column') && (updateMsg.includes('Type') || updateMsg.includes('Latitude') || updateMsg.includes('Longitude') || updateMsg.includes('Lat') || updateMsg.includes('Long'))) {
        const baseReplacements = {
          id: replacements.id,
          name: replacements.name,
          address: replacements.address,
          ownerId: replacements.ownerId,
        };
        let fallbackSql = `UPDATE ChargeStation SET Name = :name, Address = :address, OwnerId = :ownerId`;
        if (Status !== undefined && Status !== null) {
          fallbackSql += `, Status = :status`;
          baseReplacements.status = Status;
        }
        fallbackSql += ` WHERE ChargeStationId = :id ${ownerFilter}`;
        await sequelize.query(fallbackSql, { replacements: baseReplacements });
      } else {
        throw updateErr;
      }
    }

    res.json({
      success: true,
      message: 'Đã cập nhật trạm sạc thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Xóa trạm sạc
const deleteStation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userOwnerId = req.user?.ownerId;

    if (!id) {
      return res.status(400).json({ success: false, message: 'ID trạm không hợp lệ' });
    }

    const ownerFilter = userOwnerId ? `AND OwnerId = ${userOwnerId}` : '';
    const stationId = parseInt(id, 10);

    // Kiểm tra có ChargePoint nào đang sạc không
    const [activeCheck] = await sequelize.query(
      `SELECT COUNT(*) as cnt FROM Transactions t
       INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId
       WHERE cp.ChargeStationId = :stationId AND t.StopTime IS NULL`,
      { replacements: { stationId }, type: sequelize.QueryTypes.SELECT }
    );
    if (activeCheck?.cnt > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa trạm đang có giao dịch sạc đang diễn ra',
      });
    }

    await sequelize.query(
      `DELETE FROM ChargeStation WHERE ChargeStationId = :id ${ownerFilter}`,
      { replacements: { id: stationId } }
    );

    res.json({
      success: true,
      message: 'Đã xóa trạm sạc thành công',
    });
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError' || error.message?.includes('REFERENCE constraint')) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa trạm vì còn ChargePoint liên kết. Vui lòng xóa ChargePoint trước.',
      });
    }
    next(error);
  }
};

// Danh sách tất cả trụ sạc (ChargePoint)
const getChargePoints = async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    const ownerFilter = ownerId ? `AND cp.OwnerId = ${ownerId}` : '';

    let chargePoints;
    try {
      chargePoints = await sequelize.query(
        `SELECT
          cp.ChargePointId,
          ISNULL(cp.Name, cp.ChargePointId) as Name,
          cp.ChargePointModel,
          cp.chargerPower,
          cp.outputType,
          cp.connectorType,
          cp.OcppVersion,
          cp.IsActive,
          cp.ChargeStationId,
          cs.Name as StationName,
          cs.Address as StationAddress,
          ISNULL(o.Name, 'N/A') as OwnerName,
          (SELECT TOP 1 cs2.LastStatus 
           FROM ConnectorStatus cs2 
           WHERE cs2.ChargePointId = cp.ChargePointId 
           ORDER BY cs2.LastStatusTime DESC) as ChargePointState
         FROM ChargePoint cp
         INNER JOIN ChargeStation cs ON cp.ChargeStationId = cs.ChargeStationId
         LEFT JOIN Owner o ON cs.OwnerId = o.OwnerId
         WHERE 1=1 ${ownerFilter}
         ORDER BY cs.Name, cp.ChargePointId`,
        { type: sequelize.QueryTypes.SELECT }
      );
    } catch (colErr) {
      const errMessages = (colErr.original?.errors || []).map((e) => (e && e.message) || '');
      const msg = [colErr.message, colErr.original?.message, ...errMessages].join(' ').toLowerCase();
      if (msg.includes('ocppversion') || msg.includes('isactive') || msg.includes('invalid column')) {
        chargePoints = await sequelize.query(
          `SELECT
            cp.ChargePointId,
            ISNULL(cp.Name, cp.ChargePointId) as Name,
            cp.ChargePointModel,
            cp.chargerPower,
            cp.outputType,
            cp.connectorType,
            cp.ChargeStationId,
            cs.Name as StationName,
            cs.Address as StationAddress,
            ISNULL(o.Name, 'N/A') as OwnerName,
            (SELECT TOP 1 cs2.LastStatus 
             FROM ConnectorStatus cs2 
             WHERE cs2.ChargePointId = cp.ChargePointId 
             ORDER BY cs2.LastStatusTime DESC) as ChargePointState
           FROM ChargePoint cp
           INNER JOIN ChargeStation cs ON cp.ChargeStationId = cs.ChargeStationId
           LEFT JOIN Owner o ON cs.OwnerId = o.OwnerId
           WHERE 1=1 ${ownerFilter}
           ORDER BY cs.Name, cp.ChargePointId`,
          { type: sequelize.QueryTypes.SELECT }
        );
        chargePoints = chargePoints.map(cp => ({ ...cp, OcppVersion: null, IsActive: true }));
      } else {
        throw colErr;
      }
    }

    const result = chargePoints.map(cp => ({
      ChargePointId: cp.ChargePointId,
      Name: cp.Name || cp.ChargePointId,
      ChargePointModel: cp.ChargePointModel,
      chargerPower: cp.chargerPower,
      outputType: cp.outputType,
      connectorType: cp.connectorType,
      OcppVersion: cp.OcppVersion,
      IsActive: cp.IsActive !== false && cp.IsActive !== 0,
      ChargeStationId: cp.ChargeStationId,
      StationName: cp.StationName,
      StationAddress: cp.StationAddress,
      OwnerName: cp.OwnerName,
      ChargePointState: cp.ChargePointState || 'Unavailable'
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getChargePoints:', error);
    next(error);
  }
};

// Thêm trụ sạc mới
const createChargePoint = async (req, res, next) => {
  try {
    const { ChargePointId, Name, ChargeStationId, ChargePointModel, chargerPower, outputType, connectorType, OwnerId, OcppVersion, IsActive } = req.body;
    const userOwnerId = req.user?.ownerId;

    if (!ChargePointId || !ChargeStationId) {
      return res.status(400).json({
        success: false,
        message: 'ID trụ và trạm sạc là bắt buộc',
      });
    }

    const stationWhere = userOwnerId
      ? 'WHERE ChargeStationId = :stationId AND OwnerId = :ownerId'
      : 'WHERE ChargeStationId = :stationId';
    const [station] = await sequelize.query(
      `SELECT ChargeStationId, OwnerId FROM ChargeStation ${stationWhere}`,
      {
        replacements: { stationId: parseInt(ChargeStationId, 10), ownerId: userOwnerId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    if (!station) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trạm sạc' });
    }

    const ownerId = OwnerId ? parseInt(OwnerId, 10) : station.OwnerId || userOwnerId || null;

    try {
      await sequelize.query(
        `INSERT INTO ChargePoint (ChargePointId, Name, ChargeStationId, ChargePointModel, chargerPower, outputType, connectorType, OcppVersion, IsActive, OwnerId)
         VALUES (:chargePointId, :name, :chargeStationId, :chargePointModel, :chargerPower, :outputType, :connectorType, :ocppVersion, :isActive, :ownerId)`,
        {
          replacements: {
            chargePointId: String(ChargePointId).trim(),
            name: Name?.trim() || null,
            chargeStationId: parseInt(ChargeStationId, 10),
            chargePointModel: ChargePointModel?.trim() || null,
            chargerPower: chargerPower != null && chargerPower !== '' ? parseFloat(chargerPower) : 0,
            outputType: outputType?.trim() || null,
            connectorType: connectorType?.trim() || null,
            ocppVersion: (OcppVersion && String(OcppVersion).trim()) || null,
            isActive: IsActive === false || IsActive === 0 || (typeof IsActive === 'string' && IsActive.toLowerCase() === 'off') ? 0 : 1,
            ownerId: ownerId || null,
          },
        }
      );
    } catch (insertErr) {
      const insertMsg = (insertErr.message || '') + (insertErr.original?.message || '');
      if (insertMsg.includes('OcppVersion') || insertMsg.includes('IsActive') || insertMsg.includes('Invalid column')) {
        await sequelize.query(
          `INSERT INTO ChargePoint (ChargePointId, Name, ChargeStationId, ChargePointModel, chargerPower, outputType, connectorType, OwnerId)
           VALUES (:chargePointId, :name, :chargeStationId, :chargePointModel, :chargerPower, :outputType, :connectorType, :ownerId)`,
          {
            replacements: {
              chargePointId: String(ChargePointId).trim(),
              name: Name?.trim() || null,
              chargeStationId: parseInt(ChargeStationId, 10),
              chargePointModel: ChargePointModel?.trim() || null,
              chargerPower: chargerPower != null && chargerPower !== '' ? parseFloat(chargerPower) : 0,
              outputType: outputType?.trim() || null,
              connectorType: connectorType?.trim() || null,
              ownerId: ownerId || null,
            },
          }
        );
      } else {
        throw insertErr;
      }
    }

    await sequelize.query(
      `UPDATE ChargeStation SET QtyChargePoint = (SELECT COUNT(*) FROM ChargePoint WHERE ChargeStationId = :stationId) WHERE ChargeStationId = :stationId`,
      { replacements: { stationId: parseInt(ChargeStationId, 10) } }
    );

    res.json({ success: true, message: 'Đã thêm trụ sạc thành công' });
  } catch (error) {
    if (
      error.name === 'SequelizeUniqueConstraintError' ||
      error.message?.includes('duplicate') ||
      error.message?.includes('UNIQUE') ||
      error.message?.includes('PRIMARY KEY')
    ) {
      return res.status(400).json({ success: false, message: 'ID trụ sạc đã tồn tại' });
    }
    next(error);
  }
};

// Cập nhật trụ sạc
const updateChargePoint = async (req, res, next) => {
  try {
    const chargePointId = req.params.id ? decodeURIComponent(req.params.id) : null;
    const { Name, ChargeStationId, ChargePointModel, chargerPower, outputType, connectorType, OwnerId, OcppVersion, IsActive } = req.body;
    const userOwnerId = req.user?.ownerId;

    if (!chargePointId) {
      return res.status(400).json({ success: false, message: 'ID trụ không hợp lệ' });
    }
    if (!ChargeStationId) {
      return res.status(400).json({ success: false, message: 'Trạm sạc là bắt buộc' });
    }

    const ownerFilter = userOwnerId ? `AND cp.OwnerId = ${userOwnerId}` : '';
    const [existing] = await sequelize.query(
      `SELECT ChargePointId, ChargeStationId FROM ChargePoint WHERE ChargePointId = :id ${ownerFilter}`,
      { replacements: { id: chargePointId }, type: sequelize.QueryTypes.SELECT }
    );

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trụ sạc' });
    }

    const newStationId = parseInt(ChargeStationId, 10);
    const stationWhere = userOwnerId
      ? 'WHERE ChargeStationId = :stationId AND OwnerId = :ownerId'
      : 'WHERE ChargeStationId = :stationId';
    const [station] = await sequelize.query(
      `SELECT ChargeStationId FROM ChargeStation ${stationWhere}`,
      { replacements: { stationId: newStationId, ownerId: userOwnerId }, type: sequelize.QueryTypes.SELECT }
    );

    if (!station) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trạm sạc' });
    }

    const ownerId = OwnerId ? parseInt(OwnerId, 10) : null;

    const updateReplacements = {
      chargePointId,
      name: Name?.trim() || null,
      chargeStationId: newStationId,
      chargePointModel: ChargePointModel?.trim() || null,
      chargerPower: chargerPower != null && chargerPower !== '' ? parseFloat(chargerPower) : 0,
      outputType: outputType?.trim() || null,
      connectorType: connectorType?.trim() || null,
      ocppVersion: (OcppVersion && String(OcppVersion).trim()) || null,
      isActive: IsActive === false || IsActive === 0 || (typeof IsActive === 'string' && IsActive.toLowerCase() === 'off') ? 0 : 1,
      ownerId: ownerId,
    };
    try {
      await sequelize.query(
        `UPDATE ChargePoint SET
          Name = :name,
          ChargeStationId = :chargeStationId,
          ChargePointModel = :chargePointModel,
          chargerPower = :chargerPower,
          outputType = :outputType,
          connectorType = :connectorType,
          OcppVersion = :ocppVersion,
          IsActive = :isActive,
          OwnerId = COALESCE(:ownerId, OwnerId)
         WHERE ChargePointId = :chargePointId ${ownerFilter}`,
        { replacements: updateReplacements }
      );
    } catch (updateErr) {
      const updateMsg = (updateErr.message || '') + (updateErr.original?.message || '');
      if (updateMsg.includes('OcppVersion') || updateMsg.includes('IsActive') || updateMsg.includes('Invalid column')) {
        await sequelize.query(
          `UPDATE ChargePoint SET
            Name = :name,
            ChargeStationId = :chargeStationId,
            ChargePointModel = :chargePointModel,
            chargerPower = :chargerPower,
            outputType = :outputType,
            connectorType = :connectorType,
            OwnerId = COALESCE(:ownerId, OwnerId)
           WHERE ChargePointId = :chargePointId ${ownerFilter}`,
          {
            replacements: {
              chargePointId,
              name: updateReplacements.name,
              chargeStationId: updateReplacements.chargeStationId,
              chargePointModel: updateReplacements.chargePointModel,
              chargerPower: updateReplacements.chargerPower,
              outputType: updateReplacements.outputType,
              connectorType: updateReplacements.connectorType,
              ownerId: updateReplacements.ownerId,
            },
          }
        );
      } else {
        throw updateErr;
      }
    }

    const oldStationId = existing.ChargeStationId;
    if (oldStationId !== newStationId) {
      await sequelize.query(
        `UPDATE ChargeStation SET QtyChargePoint = (SELECT COUNT(*) FROM ChargePoint WHERE ChargeStationId = :stationId) WHERE ChargeStationId = :stationId`,
        { replacements: { stationId: oldStationId } }
      );
    }
    await sequelize.query(
      `UPDATE ChargeStation SET QtyChargePoint = (SELECT COUNT(*) FROM ChargePoint WHERE ChargeStationId = :stationId) WHERE ChargeStationId = :stationId`,
      { replacements: { stationId: newStationId } }
    );

    res.json({ success: true, message: 'Đã cập nhật trụ sạc thành công' });
  } catch (error) {
    next(error);
  }
};

// Xóa trụ sạc
const deleteChargePoint = async (req, res, next) => {
  try {
    const chargePointId = req.params.id ? decodeURIComponent(req.params.id) : null;
    const userOwnerId = req.user?.ownerId;

    if (!chargePointId) {
      return res.status(400).json({ success: false, message: 'ID trụ không hợp lệ' });
    }

    const ownerFilter = userOwnerId ? `AND cp.OwnerId = ${userOwnerId}` : '';

    const [activeCheck] = await sequelize.query(
      `SELECT COUNT(*) as cnt FROM Transactions t
       INNER JOIN ChargePoint cp ON t.ChargePointId = cp.ChargePointId
       WHERE cp.ChargePointId = :chargePointId AND t.StopTime IS NULL`,
      { replacements: { chargePointId }, type: sequelize.QueryTypes.SELECT }
    );
    if (activeCheck?.cnt > 0) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa trụ đang có giao dịch sạc đang diễn ra',
      });
    }

    const [cp] = await sequelize.query(
      `SELECT ChargeStationId FROM ChargePoint WHERE ChargePointId = :id ${ownerFilter}`,
      { replacements: { id: chargePointId }, type: sequelize.QueryTypes.SELECT }
    );

    if (!cp) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy trụ sạc' });
    }

    await sequelize.query(`DELETE FROM ConnectorStatus WHERE ChargePointId = :id`, {
      replacements: { id: chargePointId },
    });
    await sequelize.query(
      `DELETE FROM ChargePoint WHERE ChargePointId = :id ${ownerFilter}`,
      { replacements: { id: chargePointId } }
    );

    await sequelize.query(
      `UPDATE ChargeStation SET QtyChargePoint = (SELECT COUNT(*) FROM ChargePoint WHERE ChargeStationId = :stationId) WHERE ChargeStationId = :stationId`,
      { replacements: { stationId: cp.ChargeStationId } }
    );

    res.json({ success: true, message: 'Đã xóa trụ sạc thành công' });
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError' || error.message?.includes('REFERENCE constraint')) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa trụ sạc vì còn dữ liệu liên kết.',
      });
    }
    next(error);
  }
};

// Thêm chủ đầu tư mới (chỉ admin)
const createOwner = async (req, res, next) => {
  try {
    if (req.user?.ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thêm chủ đầu tư',
      });
    }

    const { Name, Address, Phone, Email } = req.body;

    if (!Name || !Name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tên chủ đầu tư là bắt buộc',
      });
    }

    await sequelize.query(
      `INSERT INTO Owner (Name, Address, Phone, Email, CreateDate, Status)
       VALUES (:name, :address, :phone, :email, GETDATE(), 1)`,
      {
        replacements: {
          name: Name.trim(),
          address: (Address || '').trim() || null,
          phone: (Phone || '').trim() || null,
          email: (Email || '').trim() || null,
        },
      }
    );

    res.json({
      success: true,
      message: 'Đã thêm chủ đầu tư thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Chi tiết chủ đầu tư (cho form sửa)
const getOwnerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userOwnerId = req.user?.ownerId;

    if (!id) return res.status(400).json({ success: false, message: 'ID không hợp lệ' });

    const whereClause = userOwnerId ? `AND o.OwnerId = ${userOwnerId}` : '';
    const owners = await sequelize.query(
      `SELECT o.OwnerId, o.Name, o.Address, o.Phone, o.Email, o.Status,
        (SELECT COUNT(*) FROM ChargeStation cs WHERE cs.OwnerId = o.OwnerId) as StationCount
       FROM Owner o WHERE o.OwnerId = :id ${whereClause}`,
      { replacements: { id: parseInt(id, 10) }, type: sequelize.QueryTypes.SELECT }
    );

    const owner = owners?.[0];
    if (!owner) return res.status(404).json({ success: false, message: 'Không tìm thấy chủ đầu tư' });

    res.json({
      success: true,
      data: {
        ...owner,
        StationCount: parseInt(owner.StationCount || 0, 10),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Cập nhật chủ đầu tư (chỉ admin)
const updateOwner = async (req, res, next) => {
  try {
    if (req.user?.ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền sửa chủ đầu tư',
      });
    }
    const { id } = req.params;
    const { Name, Address, Phone, Email } = req.body;

    if (!id) return res.status(400).json({ success: false, message: 'ID không hợp lệ' });
    if (!Name || !Name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên chủ đầu tư là bắt buộc' });
    }

    await sequelize.query(
      `UPDATE Owner SET Name = :name, Address = :address, Phone = :phone, Email = :email
       WHERE OwnerId = :id`,
      {
        replacements: {
          id: parseInt(id, 10),
          name: Name.trim(),
          address: (Address || '').trim() || null,
          phone: (Phone || '').trim() || null,
          email: (Email || '').trim() || null,
        },
      }
    );

    res.json({
      success: true,
      message: 'Đã cập nhật chủ đầu tư thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Xóa chủ đầu tư (chỉ admin)
const deleteOwner = async (req, res, next) => {
  try {
    if (req.user?.ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa chủ đầu tư',
      });
    }
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'ID không hợp lệ' });

    const ownerId = parseInt(id, 10);

    const [stationCheck] = await sequelize.query(
      `SELECT COUNT(*) as cnt FROM ChargeStation WHERE OwnerId = :ownerId`,
      { replacements: { ownerId }, type: sequelize.QueryTypes.SELECT }
    );
    if (stationCheck?.cnt > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa vì còn ${stationCheck.cnt} trạm liên kết. Vui lòng chuyển hoặc xóa trạm trước.`,
      });
    }

    const [accountCheck] = await sequelize.query(
      `SELECT COUNT(*) as cnt FROM Account WHERE OwnerId = :ownerId`,
      { replacements: { ownerId }, type: sequelize.QueryTypes.SELECT }
    );
    if (accountCheck?.cnt > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa vì còn ${accountCheck.cnt} tài khoản liên kết.`,
      });
    }

    await sequelize.query(`DELETE FROM Owner WHERE OwnerId = :ownerId`, {
      replacements: { ownerId },
    });

    res.json({
      success: true,
      message: 'Đã xóa chủ đầu tư thành công',
    });
  } catch (error) {
    if (error.message?.includes('REFERENCE') || error.message?.includes('foreign key')) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa vì còn dữ liệu liên kết.',
      });
    }
    next(error);
  }
};

// Danh sách Owner (cho dropdown + danh sách chủ đầu tư)
const getOwners = async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    const whereClause = ownerId ? `WHERE o.OwnerId = ${ownerId}` : '';

    const owners = await sequelize.query(
      `SELECT 
        o.OwnerId, 
        o.Name,
        (SELECT COUNT(*) FROM ChargeStation cs WHERE cs.OwnerId = o.OwnerId) as StationCount,
        (SELECT TOP 1 a.UserName FROM Account a WHERE a.OwnerId = o.OwnerId ORDER BY a.AccountId) as LoginUserName
       FROM Owner o ${whereClause} ORDER BY o.Name`,
      { type: sequelize.QueryTypes.SELECT }
    );

    res.json({
      success: true,
      data: owners.map(o => ({
        OwnerId: o.OwnerId,
        Name: o.Name,
        StationCount: parseInt(o.StationCount || 0, 10),
        LoginUserName: o.LoginUserName || null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// Tạo mới hoặc reset mật khẩu tài khoản đăng nhập cho chủ đầu tư
const createOrResetOwnerAccount = async (req, res, next) => {
  try {
    // Chỉ admin (không gắn OwnerId) mới được tạo/reset tài khoản chủ đầu tư
    if (req.user?.ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thao tác tài khoản cho chủ đầu tư',
      });
    }

    const { id } = req.params;
    const ownerId = parseInt(id, 10);

    if (!ownerId || Number.isNaN(ownerId)) {
      return res.status(400).json({
        success: false,
        message: 'ID chủ đầu tư không hợp lệ',
      });
    }

    // Kiểm tra chủ đầu tư tồn tại
    const owners = await sequelize.query(
      `SELECT OwnerId, Name FROM Owner WHERE OwnerId = :ownerId`,
      {
        replacements: { ownerId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const owner = owners?.[0];
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chủ đầu tư',
      });
    }

    // Tìm tài khoản hiện tại (nếu có) của chủ đầu tư này
    const existingAccounts = await sequelize.query(
      `SELECT TOP 1 AccountId, UserName 
       FROM Account 
       WHERE OwnerId = :ownerId 
       ORDER BY AccountId`,
      {
        replacements: { ownerId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const existing = existingAccounts?.[0];
    const DEFAULT_PASSWORD = 'Admin@2026';
    const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

    // Nếu đã có tài khoản → reset mật khẩu
    if (existing) {
      await sequelize.query(
        `UPDATE Account 
         SET Password = :password 
         WHERE AccountId = :accountId`,
        {
          replacements: {
            password: hashedPassword,
            accountId: existing.AccountId,
          },
        }
      );

      return res.json({
        success: true,
        message: 'Đã reset mật khẩu tài khoản chủ đầu tư về mật khẩu mặc định',
        data: {
          action: 'reset',
          ownerId,
          username: existing.UserName,
        },
      });
    }

    // Chưa có tài khoản → tạo mới với username tự động
    const baseUsername = `owner${ownerId}`;
    const usernameCountResult = await sequelize.query(
      `SELECT COUNT(*) as cnt 
       FROM Account 
       WHERE UserName LIKE :prefix`,
      {
        replacements: { prefix: `${baseUsername}%` },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const existingCountRaw = usernameCountResult?.[0]?.cnt;
    const existingCount = parseInt(existingCountRaw || 0, 10);
    const username =
      existingCount > 0 ? `${baseUsername}_${existingCount + 1}` : baseUsername;

    // Mặc định PermissionId = 2 cho tài khoản chủ đầu tư
    const OWNER_PERMISSION_ID = 2;

    await sequelize.query(
      `INSERT INTO Account (Name, UserName, Password, OwnerId, PermissionId, CreateDate)
       VALUES (:name, :username, :password, :ownerId, :permissionId, GETDATE())`,
      {
        replacements: {
          name: owner.Name || `Owner ${ownerId}`,
          username,
          password: hashedPassword,
          ownerId,
          permissionId: OWNER_PERMISSION_ID,
        },
      }
    );

    return res.json({
      success: true,
      message:
        'Đã tạo tài khoản đăng nhập cho chủ đầu tư với mật khẩu mặc định',
      data: {
        action: 'created',
        ownerId,
        username,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  getStats, 
  getStations, 
  getRecentTransactions, 
  getChargingSessions,
  getChargingOrders,
  updateSession,
  deleteSession,
  updateOrder,
  deleteOrder,
  getRecentChargePoints,
  getChargePoints,
  createChargePoint,
  updateChargePoint,
  deleteChargePoint,
  getEnergyByHourToday,
  getRevenueLast7Days,
  createStation,
  updateStation,
  deleteStation,
  createOwner,
  getOwnerById,
  updateOwner,
  deleteOwner,
  getOwners,
  createOrResetOwnerAccount,
};

