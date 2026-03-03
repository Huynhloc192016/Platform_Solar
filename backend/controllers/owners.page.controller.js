const { sequelize } = require('../config/database');
const { hashPassword } = require('../utils/password.util');

// Thêm chủ đầu tư mới (chỉ admin)
const createOwner = async (req, res, next) => {
  try {
    if (req.user?.ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thêm chủ đầu tư',
      });
    }

    const { Name, Address, Phone, Email } = req.body;

    if (!Name || !Name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tên chủ đầu tư là bắt buộc',
      });
    }

    await sequelize.query(
      `INSERT INTO Owner (Name, Address, Phone, Email, CreateDate, Status)
       VALUES (:name, :address, :phone, :email, GETDATE(), 1)`,
      {
        replacements: {
          name: Name.trim(),
          address: (Address || '').trim() || null,
          phone: (Phone || '').trim() || null,
          email: (Email || '').trim() || null,
        },
      }
    );

    res.json({
      success: true,
      message: 'Đã thêm chủ đầu tư thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Chi tiết chủ đầu tư (cho form sửa)
const getOwnerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userOwnerId = req.user?.ownerId;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'ID không hợp lệ' });
    }

    const whereClause = userOwnerId ? `AND o.OwnerId = ${userOwnerId}` : '';
    const owners = await sequelize.query(
      `SELECT o.OwnerId, o.Name, o.Address, o.Phone, o.Email, o.Status,
        (SELECT COUNT(*) FROM ChargeStation cs WHERE cs.OwnerId = o.OwnerId) as StationCount
       FROM Owner o WHERE o.OwnerId = :id ${whereClause}`,
      { replacements: { id: parseInt(id, 10) }, type: sequelize.QueryTypes.SELECT }
    );

    const owner = owners?.[0];
    if (!owner) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy chủ đầu tư' });
    }

    res.json({
      success: true,
      data: {
        ...owner,
        StationCount: parseInt(owner.StationCount || 0, 10),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Cập nhật chủ đầu tư (chỉ admin)
const updateOwner = async (req, res, next) => {
  try {
    if (req.user?.ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Chủ đầu tư không có quyền thao tác.',
      });
    }
    const { id } = req.params;
    const { Name, Address, Phone, Email } = req.body;

    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'ID không hợp lệ' });
    }
    if (!Name || !Name.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Tên chủ đầu tư là bắt buộc' });
    }

    await sequelize.query(
      `UPDATE Owner SET Name = :name, Address = :address, Phone = :phone, Email = :email
       WHERE OwnerId = :id`,
      {
        replacements: {
          id: parseInt(id, 10),
          name: Name.trim(),
          address: (Address || '').trim() || null,
          phone: (Phone || '').trim() || null,
          email: (Email || '').trim() || null,
        },
      }
    );

    res.json({
      success: true,
      message: 'Đã cập nhật chủ đầu tư thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Xóa chủ đầu tư (chỉ admin)
const deleteOwner = async (req, res, next) => {
  try {
    if (req.user?.ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Chủ đầu tư không có quyền thao tác.',
      });
    }
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'ID không hợp lệ' });
    }

    const ownerId = parseInt(id, 10);

    const [stationCheck] = await sequelize.query(
      `SELECT COUNT(*) as cnt FROM ChargeStation WHERE OwnerId = :ownerId`,
      { replacements: { ownerId }, type: sequelize.QueryTypes.SELECT }
    );
    if (stationCheck?.cnt > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa vì còn ${stationCheck.cnt} trạm liên kết. Vui lòng chuyển hoặc xóa trạm trước.`,
      });
    }

    const [accountCheck] = await sequelize.query(
      `SELECT COUNT(*) as cnt FROM Account WHERE OwnerId = :ownerId`,
      { replacements: { ownerId }, type: sequelize.QueryTypes.SELECT }
    );
    if (accountCheck?.cnt > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa vì còn ${accountCheck.cnt} tài khoản liên kết.`,
      });
    }

    await sequelize.query(`DELETE FROM Owner WHERE OwnerId = :ownerId`, {
      replacements: { ownerId },
    });

    res.json({
      success: true,
      message: 'Đã xóa chủ đầu tư thành công',
    });
  } catch (error) {
    if (error.message?.includes('REFERENCE') || error.message?.includes('foreign key')) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa vì còn dữ liệu liên kết.',
      });
    }
    next(error);
  }
};

// Danh sách Owner (cho dropdown + danh sách chủ đầu tư)
const getOwners = async (req, res, next) => {
  try {
    const ownerId = req.user?.ownerId;
    const whereClause = ownerId ? `WHERE o.OwnerId = ${ownerId}` : '';

    const owners = await sequelize.query(
      `SELECT 
        o.OwnerId, 
        o.Name,
        (SELECT COUNT(*) FROM ChargeStation cs WHERE cs.OwnerId = o.OwnerId) as StationCount,
        (SELECT TOP 1 a.UserName FROM Account a WHERE a.OwnerId = o.OwnerId ORDER BY a.AccountId) as LoginUserName
       FROM Owner o ${whereClause} ORDER BY o.Name`,
      { type: sequelize.QueryTypes.SELECT }
    );

    res.json({
      success: true,
      data: owners.map((o) => ({
        OwnerId: o.OwnerId,
        Name: o.Name,
        StationCount: parseInt(o.StationCount || 0, 10),
        LoginUserName: o.LoginUserName || null,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// Tạo mới hoặc reset mật khẩu tài khoản đăng nhập cho chủ đầu tư
const createOrResetOwnerAccount = async (req, res, next) => {
  try {
    if (req.user?.ownerId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thao tác tài khoản cho chủ đầu tư',
      });
    }

    const { id } = req.params;
    const ownerId = parseInt(id, 10);

    if (!ownerId || Number.isNaN(ownerId)) {
      return res.status(400).json({
        success: false,
        message: 'ID chủ đầu tư không hợp lệ',
      });
    }

    const owners = await sequelize.query(
      `SELECT OwnerId, Name FROM Owner WHERE OwnerId = :ownerId`,
      {
        replacements: { ownerId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const owner = owners?.[0];
    if (!owner) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chủ đầu tư',
      });
    }

    const existingAccounts = await sequelize.query(
      `SELECT TOP 1 AccountId, UserName 
       FROM Account 
       WHERE OwnerId = :ownerId 
       ORDER BY AccountId`,
      {
        replacements: { ownerId },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const existing = existingAccounts?.[0];
    const DEFAULT_PASSWORD = 'Admin@2026';
    const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

    if (existing) {
      await sequelize.query(
        `UPDATE Account 
         SET Password = :password 
         WHERE AccountId = :accountId`,
        {
          replacements: {
            password: hashedPassword,
            accountId: existing.AccountId,
          },
        }
      );

      return res.json({
        success: true,
        message:
          'Đã reset mật khẩu tài khoản chủ đầu tư về mật khẩu mặc định',
        data: {
          action: 'reset',
          ownerId,
          username: existing.UserName,
        },
      });
    }

    const baseUsername = `owner${ownerId}`;
    const usernameCountResult = await sequelize.query(
      `SELECT COUNT(*) as cnt 
       FROM Account 
       WHERE UserName LIKE :prefix`,
      {
        replacements: { prefix: `${baseUsername}%` },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const existingCountRaw = usernameCountResult?.[0]?.cnt;
    const existingCount = parseInt(existingCountRaw || 0, 10);
    const username =
      existingCount > 0 ? `${baseUsername}_${existingCount + 1}` : baseUsername;

    const OWNER_PERMISSION_ID = 2;

    await sequelize.query(
      `INSERT INTO Account (Name, UserName, Password, OwnerId, PermissionId, CreateDate)
       VALUES (:name, :username, :password, :ownerId, :permissionId, GETDATE())`,
      {
        replacements: {
          name: owner.Name || `Owner ${ownerId}`,
          username,
          password: hashedPassword,
          ownerId,
          permissionId: OWNER_PERMISSION_ID,
        },
      }
    );

    return res.json({
      success: true,
      message:
        'Đã tạo tài khoản đăng nhập cho chủ đầu tư với mật khẩu mặc định',
      data: {
        action: 'created',
        ownerId,
        username,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOwner,
  getOwnerById,
  updateOwner,
  deleteOwner,
  getOwners,
  createOrResetOwnerAccount,
};

