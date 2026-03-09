-- Bảng cấu hình email nhận thông báo (cấu hình từ FE, không giới hạn số lượng)
-- SettingValue lưu JSON array: ["email1@x.com","email2@y.com",...]

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'NotificationSetting')
BEGIN
  CREATE TABLE NotificationSetting (
    SettingKey NVARCHAR(100) PRIMARY KEY,
    SettingValue NVARCHAR(MAX) NULL,
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
  );

  INSERT INTO NotificationSetting (SettingKey, SettingValue)
  VALUES ('mail_notify_emails', '[]');
END
GO
