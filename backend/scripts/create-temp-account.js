/**
 * Script tạo 1 tài khoản tạm (temp) để đăng nhập.
 * Chạy từ thư mục backend: node scripts/create-temp-account.js
 *
 * Có thể truyền username/password qua tham số:
 *   node scripts/create-temp-account.js [username] [password]
 * Mặc định: username = tempuser, password = Temp@123
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { sequelize } = require('../config/database');
const { hashPassword } = require('../utils/password.util');

const DEFAULT_USERNAME = 'tempuser';
const DEFAULT_PASSWORD = 'Temp@123';

const run = async () => {
  const username = process.argv[2] || DEFAULT_USERNAME;
  const password = process.argv[3] || DEFAULT_PASSWORD;

  try {
    await sequelize.authenticate();
    console.log('✅ Kết nối database thành công.');
  } catch (err) {
    console.error('❌ Không kết nối được database:', err.message);
    process.exit(1);
  }

  const hashedPassword = await hashPassword(password);

  try {
    await sequelize.query(
      `INSERT INTO [Account] ([Name], [UserName], [Password], [CreateDate])
       VALUES (:name, :username, :password, GETDATE())`,
      {
        replacements: {
          name: `Temp Account (${username})`,
          username,
          password: hashedPassword,
        },
      }
    );
    console.log('✅ Đã tạo tài khoản tạm.');
    console.log('');
    console.log('   Tên đăng nhập:', username);
    console.log('   Mật khẩu:    ', password);
    console.log('');
    console.log('   (Đổi mật khẩu hoặc xóa tài khoản sau khi dùng xong.)');
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError' || (err.original && err.original.number === 2627)) {
      console.error('❌ Tên đăng nhập đã tồn tại. Thử username khác hoặc xóa bản ghi cũ.');
    } else {
      console.error('❌ Lỗi khi tạo tài khoản:', err.message);
      if (err.original) console.error('   Chi tiết:', err.original.message);
    }
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

run();
