const { sequelize } = require('../config/database');

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
        chargePoints = chargePoints.map((cp) => ({
          ...cp,
          OcppVersion: null,
          IsActive: true,
        }));
      } else {
        throw colErr;
      }
    }

    const result = chargePoints.map((cp) => ({
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
      ChargePointState: cp.ChargePointState || 'Unavailable',
    }));

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
    if (req.user?.ownerId) {
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
    if (req.user?.ownerId) {
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
    const userOwnerId = req.user?.ownerId;

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
    if (req.user?.ownerId) {
      return res
        .status(403)
        .json({ success: false, message: 'Chủ đầu tư không có quyền thao tác.' });
    }
    const chargePointId = req.params.id ? decodeURIComponent(req.params.id) : null;
    const userOwnerId = req.user?.ownerId;

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

module.exports = {
  getChargePoints,
  createChargePoint,
  updateChargePoint,
  deleteChargePoint,
};

