-- Thêm cột Type, Latitude, Longitude vào bảng ChargeStation (SQL Server)
-- Chạy script này một lần trước khi dùng tính năng Trạng thái, Loại, Lat/Long trong quản lý trạm sạc.

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ChargeStation' AND COLUMN_NAME = 'Type'
)
BEGIN
  ALTER TABLE ChargeStation ADD Type NVARCHAR(50) NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ChargeStation' AND COLUMN_NAME = 'Latitude'
)
BEGIN
  ALTER TABLE ChargeStation ADD Latitude FLOAT NULL;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'ChargeStation' AND COLUMN_NAME = 'Longitude'
)
BEGIN
  ALTER TABLE ChargeStation ADD Longitude FLOAT NULL;
END
GO
