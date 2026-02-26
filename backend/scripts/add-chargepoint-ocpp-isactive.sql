-- Thêm cột OcppVersion, IsActive vào bảng ChargePoint (SQL Server)
-- Chạy script này một lần trước khi dùng OCPP 1.6/2.0 và bật/tắt trụ sạc.

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ChargePoint' AND COLUMN_NAME = 'OcppVersion'
)
BEGIN
  ALTER TABLE ChargePoint ADD OcppVersion VARCHAR(10) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ChargePoint' AND COLUMN_NAME = 'IsActive'
)
BEGIN
  ALTER TABLE ChargePoint ADD IsActive BIT NOT NULL DEFAULT 1;
END
GO
