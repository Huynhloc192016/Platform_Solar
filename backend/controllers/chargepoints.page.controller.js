const { sequelize } = require('../config/database');
const http = require('http');
const https = require('https');
const { getOwnerIdForFilter } = require('../utils/authorization.util');

// Parse LastMeterRemote: MeterKWH|CurrentChargeKW|SoC|Voltage|Temperature|Current (from OCPP MeterValues)
function parseLastMeterRemote(raw) {
  const result = { Voltage: null, Current: null, SoC: null, CurrentChargeKW: null };
  if (raw == null || typeof raw !== 'string') return result;
  const parts = raw.trim().split('|');
  if (parts.length < 6) return result;
  const n = (s) => {
    const v = parseFloat(String(s).replace(/[^\d.-]/g, ''));
    return Number.isFinite(v) ? v : null;
  };
  result.Voltage = n(parts[3]);
  result.Current = n(parts[5]);
  result.SoC = n(parts[2]);
  result.CurrentChargeKW = n(parts[1]);
  return result;
}

// Danh sách tất cả trụ sạc (ChargePoint)
const getChargePoints = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
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
        chargePoints = chargePoints.map((cp) => ({
          ...cp,
          OcppVersion: null,
          IsActive: true,
        }));
      } else {
        throw colErr;
      }
    }

    const chargePointIds = chargePoints.map((cp) => cp.ChargePointId);
    let lastSeenByCp = {};
    if (chargePointIds.length > 0) {
      const inList = chargePointIds.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(',');
      try {
        const lastSeenRows = await sequelize.query(
          `SELECT ChargePointId, MAX(lastSeen) AS LastSeen FROM ConnectorStatus WHERE ChargePointId IN (${inList}) GROUP BY ChargePointId`,
          { type: sequelize.QueryTypes.SELECT }
        );
        lastSeenRows.forEach((r) => {
          lastSeenByCp[r.ChargePointId] = r.LastSeen ?? r.lastSeen ?? null;
        });
      } catch (_) {
        // lastSeen column may not exist in some DB
      }
    }
    let connectorsByCp = {};
    if (chargePointIds.length > 0) {
      const inList = chargePointIds.map((id) => `'${String(id).replace(/'/g, "''")}'`).join(',');
      let connectorRows;
      try {
        connectorRows = await sequelize.query(
          `WITH Latest AS (
            SELECT ChargePointId, ConnectorId, ConnectorName, LastStatus, LastStatusTime, LastMeterRemote, RemoteTime,
                   ROW_NUMBER() OVER (PARTITION BY ChargePointId, ConnectorId ORDER BY LastStatusTime DESC) AS rn
            FROM ConnectorStatus
            WHERE ChargePointId IN (${inList})
          )
          SELECT ChargePointId, ConnectorId, ConnectorName, LastStatus, LastStatusTime, LastMeterRemote, RemoteTime
          FROM Latest WHERE rn = 1
          ORDER BY ChargePointId, ConnectorId`,
          { type: sequelize.QueryTypes.SELECT }
        );
      } catch (connErr) {
        connectorRows = [];
      }
      connectorRows.forEach((row) => {
        if (!connectorsByCp[row.ChargePointId]) connectorsByCp[row.ChargePointId] = [];
        const lastStatus = row.LastStatus != null ? String(row.LastStatus).trim() : (row.lastStatus != null ? String(row.lastStatus).trim() : null);
        const rawMeter = row.LastMeterRemote ?? row.lastMeterRemote ?? null;
        const meter = parseLastMeterRemote(rawMeter);
        connectorsByCp[row.ChargePointId].push({
          ConnectorId: row.ConnectorId,
          ConnectorName: row.ConnectorName || `Súng ${row.ConnectorId}`,
          LastStatus: lastStatus || 'Unavailable',
          LastStatusTime: row.LastStatusTime ?? row.lastStatusTime,
          RemoteTime: row.RemoteTime ?? row.remoteTime ?? null,
          Voltage: meter.Voltage,
          Current: meter.Current,
          SoC: meter.SoC,
          CurrentChargeKW: meter.CurrentChargeKW,
        });
      });
    }

    const result = chargePoints.map((cp) => {
      const connectors = connectorsByCp[cp.ChargePointId] || [];
      const chargePointState = cp.ChargePointState || (connectors[0] && connectors[0].LastStatus) || 'Unavailable';
      return {
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
        ChargePointState: chargePointState,
        LastSeen: lastSeenByCp[cp.ChargePointId] ?? null,
        connectors,
      };
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Thêm trụ sạc mới
const createChargePoint = async (req, res, next) => {
  try {
    if (getOwnerIdForFilter(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: 'Chủ đầu tư không có quyền thao tác.' });
    }
    const {
      ChargePointId,
      Name,
      ChargeStationId,
      ChargePointModel,
      chargerPower,
      outputType,
      connectorType,
      OwnerId,
      OcppVersion,
      IsActive,
    } = req.body;
    const userOwnerId = getOwnerIdForFilter(req.user);

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
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy trạm sạc' });
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
            chargerPower:
              chargerPower != null && chargerPower !== '' ? parseFloat(chargerPower) : 0,
            outputType: outputType?.trim() || null,
            connectorType: connectorType?.trim() || null,
            ocppVersion: (OcppVersion && String(OcppVersion).trim()) || null,
            isActive:
              IsActive === false ||
              IsActive === 0 ||
              (typeof IsActive === 'string' &&
                IsActive.toLowerCase() === 'off')
                ? 0
                : 1,
            ownerId: ownerId || null,
          },
        }
      );
    } catch (insertErr) {
      const insertMsg =
        (insertErr.message || '') + (insertErr.original?.message || '');
      if (
        insertMsg.includes('OcppVersion') ||
        insertMsg.includes('IsActive') ||
        insertMsg.includes('Invalid column')
      ) {
        await sequelize.query(
          `INSERT INTO ChargePoint (ChargePointId, Name, ChargeStationId, ChargePointModel, chargerPower, outputType, connectorType, OwnerId)
           VALUES (:chargePointId, :name, :chargeStationId, :chargePointModel, :chargerPower, :outputType, :connectorType, :ownerId)`,
          {
            replacements: {
              chargePointId: String(ChargePointId).trim(),
              name: Name?.trim() || null,
              chargeStationId: parseInt(ChargeStationId, 10),
              chargePointModel: ChargePointModel?.trim() || null,
              chargerPower:
                chargerPower != null && chargerPower !== ''
                  ? parseFloat(chargerPower)
                  : 0,
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
      return res
        .status(400)
        .json({ success: false, message: 'ID trụ sạc đã tồn tại' });
    }
    next(error);
  }
};

// Cập nhật trụ sạc
const updateChargePoint = async (req, res, next) => {
  try {
    if (getOwnerIdForFilter(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: 'Chủ đầu tư không có quyền thao tác.' });
    }
    const chargePointId = req.params.id ? decodeURIComponent(req.params.id) : null;
    const {
      Name,
      ChargeStationId,
      ChargePointModel,
      chargerPower,
      outputType,
      connectorType,
      OwnerId,
      OcppVersion,
      IsActive,
    } = req.body;
    const userOwnerId = getOwnerIdForFilter(req.user);

    if (!chargePointId) {
      return res
        .status(400)
        .json({ success: false, message: 'ID trụ không hợp lệ' });
    }
    if (!ChargeStationId) {
      return res
        .status(400)
        .json({ success: false, message: 'Trạm sạc là bắt buộc' });
    }

    const ownerFilter = userOwnerId ? `AND cp.OwnerId = ${userOwnerId}` : '';
    const [existing] = await sequelize.query(
      `SELECT ChargePointId, ChargeStationId FROM ChargePoint WHERE ChargePointId = :id ${ownerFilter}`,
      { replacements: { id: chargePointId }, type: sequelize.QueryTypes.SELECT }
    );

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy trụ sạc' });
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
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy trạm sạc' });
    }

    const ownerId = OwnerId ? parseInt(OwnerId, 10) : null;

    const updateReplacements = {
      chargePointId,
      name: Name?.trim() || null,
      chargeStationId: newStationId,
      chargePointModel: ChargePointModel?.trim() || null,
      chargerPower:
        chargerPower != null && chargerPower !== '' ? parseFloat(chargerPower) : 0,
      outputType: outputType?.trim() || null,
      connectorType: connectorType?.trim() || null,
      ocppVersion: (OcppVersion && String(OcppVersion).trim()) || null,
      isActive:
        IsActive === false ||
        IsActive === 0 ||
        (typeof IsActive === 'string' && IsActive.toLowerCase() === 'off')
          ? 0
          : 1,
      ownerId,
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
      const updateMsg =
        (updateErr.message || '') + (updateErr.original?.message || '');
      if (
        updateMsg.includes('OcppVersion') ||
        updateMsg.includes('IsActive') ||
        updateMsg.includes('Invalid column')
      ) {
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
    if (getOwnerIdForFilter(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: 'Chủ đầu tư không có quyền thao tác.' });
    }
    const chargePointId = req.params.id ? decodeURIComponent(req.params.id) : null;
    const userOwnerId = getOwnerIdForFilter(req.user);

    if (!chargePointId) {
      return res
        .status(400)
        .json({ success: false, message: 'ID trụ không hợp lệ' });
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
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy trụ sạc' });
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
    if (
      error.name === 'SequelizeForeignKeyConstraintError' ||
      error.message?.includes('REFERENCE constraint')
    ) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa trụ sạc vì còn dữ liệu liên kết.',
      });
    }
    next(error);
  }
};

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Dừng phiên sạc (gửi RemoteStopTransaction xuống OCPP server)
const stopChargingSession = async (req, res) => {
  try {
    const chargePointId = req.params.id;
    const connectorId = req.body?.connectorId != null ? Number(req.body.connectorId) : null;
    if (!chargePointId || connectorId == null || connectorId < 1) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu chargePointId hoặc connectorId (1 hoặc 2).',
      });
    }

    const rows = await sequelize.query(
      `SELECT TOP 1 TransactionId FROM Transactions 
       WHERE ChargePointId = :chargePointId AND ConnectorId = :connectorId AND MeterStop IS NULL`,
      {
        replacements: { chargePointId, connectorId },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    const transactionId = rows[0]?.TransactionId;
    if (transactionId == null) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phiên sạc đang chạy cho connector này.',
      });
    }

    const baseUrl = (process.env.OCPP_SERVER_URL || 'http://localhost:8481').replace(/\/$/, '');
    const url = `${baseUrl}/RemoteStopTransaction?id=${encodeURIComponent(chargePointId)}&TransactionId=${encodeURIComponent(transactionId)}`;
    const { ok, statusCode, body } = await httpGet(url);

    if (!ok) {
      return res.status(502).json({
        success: false,
        message: 'OCPP server trả lỗi.',
        detail: (body || '').slice(0, 200),
      });
    }

    return res.json({
      success: true,
      message: 'Đã gửi lệnh dừng sạc.',
    });
  } catch (err) {
    console.error('stopChargingSession:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Lỗi khi gọi OCPP server.',
    });
  }
};

module.exports = {
  getChargePoints,
  createChargePoint,
  updateChargePoint,
  deleteChargePoint,
  stopChargingSession,
};

