-- Bảng lưu lịch sử thay đổi (audit) cho dashboard: Users + Transactions
-- Lưu BEFORE/AFTER, KHÔNG lưu thông tin người thao tác.
-- Chạy script này một lần trên SQL Server.

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ActivityLog')
BEGIN
  CREATE TABLE ActivityLog (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    Module NVARCHAR(50) NOT NULL,         -- users | transactions
    Action NVARCHAR(10) NOT NULL,         -- UPDATE | DELETE
    ActionName NVARCHAR(100) NOT NULL,    -- USER_LOCK, ORDER_UPDATE, SESSION_DELETE, ...
    Entity NVARCHAR(50) NOT NULL,         -- UserApp | WalletTransaction | Transactions
    EntityId NVARCHAR(100) NOT NULL,
    BeforeJson NVARCHAR(MAX) NULL,
    AfterJson NVARCHAR(MAX) NULL,
    RequestPath NVARCHAR(255) NULL,
    RequestMethod NVARCHAR(10) NULL,
    Ip NVARCHAR(64) NULL,
    UserAgent NVARCHAR(512) NULL
  );

  CREATE INDEX IX_ActivityLog_CreatedAt ON ActivityLog (CreatedAt DESC);
  CREATE INDEX IX_ActivityLog_Module_CreatedAt ON ActivityLog (Module, CreatedAt DESC);
  CREATE INDEX IX_ActivityLog_Entity_EntityId_CreatedAt ON ActivityLog (Entity, EntityId, CreatedAt DESC);
END
GO

