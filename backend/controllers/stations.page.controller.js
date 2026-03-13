const { sequelize } = require('../config/database');
const { getOwnerIdForFilter } = require('../utils/authorization.util');

// Danh sách trạm + trụ
const getStations = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
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
      const parts = [
        colError.message,
        colError.original?.message,
        colError.parent?.message,
      ].filter(Boolean);
      const errList = colError.original?.errors || colError.parent?.errors;
      if (Array.isArray(errList)) {
        errList.forEach((e) => {
          const item = Array.isArray(e) ? e[0] : e;
          if (item && item.message) parts.push(item.message);
        });
      }
      const fullMessage = (parts.join(' ') || '').toLowerCase();
      const isColumnError =
        (fullMessage.includes('invalid column') &&
          (fullMessage.includes('type') ||
            fullMessage.includes('latitude') ||
            fullMessage.includes('longitude') ||
            fullMessage.includes(' lat') ||
            fullMessage.includes(' long'))) ||
        /invalid column name\s+'?(type|latitude|longitude|lat|long)'?/i.test(
          fullMessage
        );
      if (!isColumnError) {
        return next(colError);
      }
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
      stations = stations.map((s) => ({
        ...s,
        Type: 'Public',
        Latitude: null,
        Longitude: null,
      }));
    }

    for (const station of stations) {
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

        station.ChargePoints = chargePoints.map((cp) => ({
          ChargePointId: cp.ChargePointId,
          Name: cp.Name || null,
          ChargePointModel: cp.ChargePointModel,
          chargerPower: cp.chargerPower,
          outputType: cp.outputType,
          connectorType: cp.connectorType,
          ChargePointState: cp.ChargePointState || 'Unavailable',
        }));
      } catch (cpError) {
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

        station.ChargePoints = chargePoints.map((cp) => ({
          ChargePointId: cp.ChargePointId,
          Name: null,
          ChargePointModel: cp.ChargePointModel,
          chargerPower: cp.chargerPower,
          outputType: cp.outputType,
          connectorType: cp.connectorType,
          ChargePointState: cp.ChargePointState || 'Unavailable',
        }));
      }
    }

    res.json({
      success: true,
      data: stations,
    });
  } catch (error) {
    next(error);
  }
};

// Thêm trạm sạc mới
const createStation = async (req, res, next) => {
  try {
    if (getOwnerIdForFilter(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: 'Chủ đầu tư không có quyền thao tác.' });
    }
    const { Name, Address, OwnerId, Status, Type, Latitude, Longitude } = req.body;
    const userOwnerId = getOwnerIdForFilter(req.user);
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
            type:
              Type && String(Type).trim().toLowerCase() === 'private'
                ? 0
                : 1,
            lat:
              Latitude != null && Latitude !== ''
                ? parseFloat(Latitude)
                : null,
            long:
              Longitude != null && Longitude !== ''
                ? parseFloat(Longitude)
                : null,
          },
        }
      );
    } catch (insertErr) {
      const insertMsg =
        (insertErr.message || '') + (insertErr.original?.message || '');
      if (
        insertMsg.includes('Invalid column') &&
        (insertMsg.includes('Type') ||
          insertMsg.includes('Latitude') ||
          insertMsg.includes('Longitude') ||
          insertMsg.includes('Lat') ||
          insertMsg.includes('Long'))
      ) {
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
    if (getOwnerIdForFilter(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: 'Chủ đầu tư không có quyền thao tác.' });
    }
    const { id } = req.params;
    const { Name, Address, OwnerId, Status, Type, Latitude, Longitude } = req.body;
    const userOwnerId = getOwnerIdForFilter(req.user);

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'ID trạm không hợp lệ' });
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
      type:
        Type && String(Type).trim().toLowerCase() === 'private'
          ? 0
          : 1,
      lat:
        Latitude != null && Latitude !== ''
          ? parseFloat(Latitude)
          : null,
      long:
        Longitude != null && Longitude !== ''
          ? parseFloat(Longitude)
          : null,
    };

    let updateSql = `UPDATE ChargeStation SET Name = :name, Address = :address, OwnerId = :ownerId, Type = :type, Lat = :lat, Long = :long`;
    if (Status !== undefined && Status !== null) {
      updateSql += `, Status = :status`;
    }
    updateSql += ` WHERE ChargeStationId = :id ${ownerFilter}`;

    try {
      await sequelize.query(updateSql, { replacements });
    } catch (updateErr) {
      const updateMsg =
        (updateErr.message || '') + (updateErr.original?.message || '');
      if (
        updateMsg.includes('Invalid column') &&
        (updateMsg.includes('Type') ||
          updateMsg.includes('Latitude') ||
          updateMsg.includes('Longitude') ||
          updateMsg.includes('Lat') ||
          updateMsg.includes('Long'))
      ) {
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
        await sequelize.query(fallbackSql, {
          replacements: baseReplacements,
        });
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
    if (getOwnerIdForFilter(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: 'Chủ đầu tư không có quyền thao tác.' });
    }
    const { id } = req.params;
    const userOwnerId = getOwnerIdForFilter(req.user);

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'ID trạm không hợp lệ' });
    }

    const ownerFilter = userOwnerId ? `AND OwnerId = ${userOwnerId}` : '';
    const stationId = parseInt(id, 10);

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
    if (
      error.name === 'SequelizeForeignKeyConstraintError' ||
      error.message?.includes('REFERENCE constraint')
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Không thể xóa trạm vì còn ChargePoint liên kết. Vui lòng xóa ChargePoint trước.',
      });
    }
    next(error);
  }
};

module.exports = {
  getStations,
  createStation,
  updateStation,
  deleteStation,
};

