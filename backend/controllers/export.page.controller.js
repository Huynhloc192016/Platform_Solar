const { sequelize } = require('../config/database');
const ExcelJS = require('exceljs');

const sanitizeFilename = (s) => (s || '').replace(/[/\\?*:|"]/g, '_').trim() || 'export';

/**
 * Xuất báo cáo đơn sạc theo khoảng ngày, trạm, trụ (xlsx).
 * Query params: stationId (bắt buộc), chargePointId (tùy chọn), dateFrom (YYYY-MM-DD), dateTo (YYYY-MM-DD).
 */
const exportOrdersForReport = async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    const stationId = parseInt(req.query.stationId, 10);
    const chargePointId = (req.query.chargePointId || '').trim() || null;
    const chargePointNameFromQuery = (req.query.chargePointName || '').trim() || null;
    const dateFromRaw = (req.query.dateFrom || '').trim();
    const dateToRaw = (req.query.dateTo || '').trim();

    if (!stationId || !Number.isInteger(stationId) || stationId < 1) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn trạm.' });
    }
    const dateFrom = dateFromRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateFromRaw) ? dateFromRaw : null;
    const dateTo = dateToRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateToRaw) ? dateToRaw : null;
    if (!dateFrom || !dateTo) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn từ ngày và đến ngày hợp lệ (YYYY-MM-DD).' });
    }
    if (dateFrom > dateTo) {
      return res.status(400).json({ success: false, message: 'Từ ngày phải nhỏ hơn hoặc bằng đến ngày.' });
    }

    const ownerWhere = ownerId
      ? `AND cp.OwnerId = ${ownerId}`
      : '';
    const stationWhere = `AND cp.ChargeStationId = :stationId`;
    const chargePointWhere = chargePointId ? `AND cp.ChargePointId = :chargePointId` : '';
    const replacements = {
      stationId,
      dateFrom,
      dateTo,
      ...(chargePointId ? { chargePointId } : {}),
    };

    // Lấy tên trụ cho tên file (kể cả khi không có dòng nào)
    let chargePointName = 'Tat_ca_tru';
    if (chargePointId) {
      if (chargePointNameFromQuery) {
        chargePointName = chargePointNameFromQuery;
      } else {
        const ownerCpWhere = ownerId ? `AND cp.OwnerId = ${ownerId}` : '';
        const cpRows = await sequelize.query(
          `SELECT ISNULL(cp.Name, cp.ChargePointId) AS Name FROM ChargePoint cp WHERE cp.ChargePointId = :chargePointId ${ownerCpWhere}`,
          { replacements: { chargePointId }, type: sequelize.QueryTypes.SELECT }
        );
        const cpRow = cpRows && cpRows[0];
        chargePointName = (cpRow && (cpRow.Name ?? cpRow.name)) ?? chargePointId;
      }
    }

    const rows = await sequelize.query(
      `SELECT
        wt.UserAppId AS UserAppId,
        ISNULL(o.Name, 'N/A') AS OwnerName,
        ISNULL(cs.Name, 'N/A') AS StationName,
        ISNULL(cp.Name, cp.ChargePointId) AS ChargePointName,
        t.ConnectorId AS ConnectorId,
        t.StartTime AS StartTime,
        t.StopTime AS StopTime,
        t.MeterStart AS MeterStart,
        t.MeterStop AS MeterStop,
        CASE WHEN t.MeterStop IS NOT NULL AND t.MeterStart IS NOT NULL
          THEN CAST(t.MeterStop AS FLOAT) - CAST(t.MeterStart AS FLOAT) ELSE NULL END AS EnergyUsed,
        ISNULL(wt.Amount, 0) AS Amount
       FROM WalletTransaction wt
       INNER JOIN Transactions t ON t.TransactionId = wt.TransactionId
       INNER JOIN ChargePoint cp ON cp.ChargePointId = t.ChargePointId
       INNER JOIN ChargeStation cs ON cs.ChargeStationId = cp.ChargeStationId
       LEFT JOIN Owner o ON o.OwnerId = cs.OwnerId
       WHERE CAST(t.StartTime AS DATE) >= :dateFrom
         AND CAST(t.StartTime AS DATE) <= :dateTo
         ${ownerWhere} ${stationWhere} ${chargePointWhere}
       ORDER BY t.StartTime ASC`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo cáo đơn sạc', { views: [{ state: 'frozen', ySplit: 1 }] });

    const headers = [
      'Mã người dùng',
      'Chủ đầu tư',
      'Tên trạm sạc',
      'Tên trụ',
      'Súng',
      'Thời gian bắt đầu phiên sạc',
      'Thời gian kết thúc phiên sạc',
      'Số kW bắt đầu',
      'Số kW kết thúc',
      'Số điện tiêu thụ',
      'Giá tiền đơn sạc',
    ];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };

    const formatDt = (v) => {
      if (v == null) return '';
      const d = new Date(v);
      return isNaN(d.getTime()) ? String(v) : d.toLocaleString('vi-VN');
    };
    const formatNum = (v) => (v == null || v === '') ? '' : Number(v);

    rows.forEach((r) => {
      sheet.addRow([
        r.UserAppId ?? '',
        r.OwnerName ?? '',
        r.StationName ?? '',
        r.ChargePointName ?? '',
        r.ConnectorId ?? '',
        formatDt(r.StartTime),
        formatDt(r.StopTime),
        formatNum(r.MeterStart),
        formatNum(r.MeterStop),
        formatNum(r.EnergyUsed),
        formatNum(r.Amount),
      ]);
    });

    if (chargePointId && rows.length > 0) {
      const first = rows[0];
      const nameFromRow = first.ChargePointName ?? first.chargePointName;
      if (nameFromRow) chargePointName = nameFromRow;
    }
    const safeTru = sanitizeFilename(chargePointName);
    const filename = `Bao_cao_don_sac_${safeTru}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  exportOrdersForReport,
};
