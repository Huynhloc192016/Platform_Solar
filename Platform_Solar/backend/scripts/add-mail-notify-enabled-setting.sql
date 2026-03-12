-- Thêm cấu hình bật/tắt gửi thông báo Email (không thêm cột, chỉ thêm 1 dòng trong bảng NotificationSetting).
-- Chạy trên SQL Server sau khi bảng NotificationSetting đã tồn tại.

IF NOT EXISTS (SELECT 1 FROM NotificationSetting WHERE SettingKey = 'mail_notify_enabled')
  INSERT INTO NotificationSetting (SettingKey, SettingValue, UpdatedAt)
  VALUES ('mail_notify_enabled', 'true', GETDATE());
GO
