-- Bảng lưu access_token và refresh_token Zalo OA (dùng cho refresh token)
-- Chạy script này một lần trên SQL Server.

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ZaloOAToken')
BEGIN
  CREATE TABLE ZaloOAToken (
    Id INT NOT NULL PRIMARY KEY DEFAULT 1,
    AccessToken NVARCHAR(MAX) NULL,
    RefreshToken NVARCHAR(MAX) NULL,
    ExpiresAt BIGINT NULL,
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT CK_ZaloOAToken_SingleRow CHECK (Id = 1)
  );

  INSERT INTO ZaloOAToken (Id, AccessToken, RefreshToken, ExpiresAt, UpdatedAt)
  VALUES (1, NULL, NULL, NULL, GETDATE());
END
GO
