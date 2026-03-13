-- Bảng lưu lịch sử mail đã gửi (thông báo trụ/súng bất thường)
-- Chạy script này một lần trên SQL Server.

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MailLog')
BEGIN
  CREATE TABLE MailLog (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    EventType NVARCHAR(50) NOT NULL,
    ChargePointId NVARCHAR(255) NULL,
    ConnectorId INT NULL,
    StationName NVARCHAR(255) NULL,
    Subject NVARCHAR(500) NULL,
    ToEmail NVARCHAR(1000) NULL,
    Body NVARCHAR(MAX) NULL,
    Status NVARCHAR(20) NOT NULL,
    SentAt DATETIME NULL,
    ErrorMessage NVARCHAR(500) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
  );
END
GO
