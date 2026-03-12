const { sequelize } = require('../config/database');
const { hashPassword } = require('../utils/password.util');
const { getOwnerIdForFilter } = require('../utils/authorization.util');
const { insertActivityLog } = require('../utils/activity-log.util');

const sqlIdent = (name) => `[${String(name).replace(/]/g, ']]')}]`;

const pickColumn = (availableSet, candidates) => {
  const map = new Map();
  for (const col of availableSet) {
    map.set(String(col).toLowerCase(), col);
  }
  for (const c of candidates) {
    const actual = map.get(String(c).toLowerCase());
    if (actual) return actual;
  }
  return null;
};

const getTableColumns = async (tableName) => {
  const rows = await sequelize.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = :tableName`,
    { replacements: { tableName }, type: sequelize.QueryTypes.SELECT }
  );
  return new Set((rows || []).map((r) => r.COLUMN_NAME));
};

const requireAdmin = (req, res) => {
  if (getOwnerIdForFilter(req.user)) {
    res
      .status(403)
      .json({ success: false, message: 'Chủ đầu tư không có quyền thao tác.' });
    return false;
  }
  return true;
};

const getUserAppColumnsOrFail = async (res) => {
  const userAppCols = await getTableColumns('UserApp');
  const userIdCol = pickColumn(userAppCols, ['Id', 'UserAppId', 'UserId', 'ID']);
  if (!userIdCol) {
    res
      .status(500)
      .json({ success: false, message: 'Không tìm thấy cột ID trong bảng UserApp.' });
    return null;
  }
  return { userAppCols, userIdCol };
};

const getUserAppSnapshotById = async (id, cols, transaction) => {
  const userNameCol = pickColumn(cols.userAppCols, ['UserName', 'Username', 'User_Name']);
  const fullNameCol = pickColumn(cols.userAppCols, ['Fullname', 'FullName', 'Name']);
  const emailCol = pickColumn(cols.userAppCols, ['Email', 'EMail', 'Mail']);
  const phoneCol = pickColumn(cols.userAppCols, ['Phone', 'PhoneNumber', 'Mobile', 'Tel']);
  const createdAtCol = pickColumn(cols.userAppCols, [
    'CreateDate',
    'DateCreate',
    'CreatedAt',
    'CreateAt',
  ]);
  const statusCol = pickColumn(cols.userAppCols, [
    'IsActive',
    'Active',
    'IsLocked',
    'Locked',
    'Status',
  ]);
  const ownerIdCol = pickColumn(cols.userAppCols, ['OwnerId', 'OwnerID']);
  const balanceCol = pickColumn(cols.userAppCols, ['Balance']);

  const selectUserName = userNameCol ? `ua.${sqlIdent(userNameCol)}` : 'NULL';
  const selectFullName = fullNameCol ? `ua.${sqlIdent(fullNameCol)}` : 'NULL';
  const selectEmail = emailCol ? `ua.${sqlIdent(emailCol)}` : 'NULL';
  const selectPhone = phoneCol ? `ua.${sqlIdent(phoneCol)}` : 'NULL';
  const selectCreatedAt = createdAtCol ? `ua.${sqlIdent(createdAtCol)}` : 'NULL';
  const selectStatus = statusCol ? `ua.${sqlIdent(statusCol)}` : 'NULL';
  const selectOwnerId = ownerIdCol ? `ua.${sqlIdent(ownerIdCol)}` : 'NULL';
  const selectBalance = balanceCol ? `ua.${sqlIdent(balanceCol)}` : 'NULL';

  const [row] = await sequelize.query(
    `SELECT TOP 1
        ua.${sqlIdent(cols.userIdCol)} as userId,
        ${selectUserName} as userName,
        ${selectFullName} as fullName,
        ${selectEmail} as email,
        ${selectPhone} as phone,
        ${selectBalance} as balance,
        ${selectOwnerId} as ownerId,
        ${selectCreatedAt} as createdAt,
        ${selectStatus} as status
     FROM UserApp ua
     WHERE ua.${sqlIdent(cols.userIdCol)} = :id`,
    {
      replacements: { id },
      type: sequelize.QueryTypes.SELECT,
      transaction,
    }
  );
  return row || null;
};

// Danh sách người dùng (quản lý người dùng)
const getUsers = async (req, res, next) => {
  try {
    const ownerId = getOwnerIdForFilter(req.user);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const searchRaw = (req.query.search || '').trim();
    const searchParam = searchRaw ? `%${searchRaw}%` : null;

    const userAppCols = await getTableColumns('UserApp');

    const userIdCol = pickColumn(userAppCols, ['Id', 'UserAppId', 'UserId', 'ID']);
    if (!userIdCol) {
      return res
        .status(500)
        .json({ success: false, message: 'Không tìm thấy cột ID trong bảng UserApp.' });
    }

    const userNameCol = pickColumn(userAppCols, ['UserName', 'Username', 'User_Name']);
    const fullNameCol = pickColumn(userAppCols, ['Fullname', 'FullName', 'Name']);
    const emailCol = pickColumn(userAppCols, ['Email', 'EMail', 'Mail']);
    const phoneCol = pickColumn(userAppCols, ['Phone', 'PhoneNumber', 'Mobile', 'Tel']);
    const createdAtCol = pickColumn(userAppCols, [
      'CreateDate',
      'DateCreate',
      'CreatedAt',
      'CreateAt',
    ]);
    const statusCol = pickColumn(userAppCols, [
      'IsActive',
      'Active',
      'IsLocked',
      'Locked',
      'Status',
    ]);
    const ownerIdCol = pickColumn(userAppCols, ['OwnerId', 'OwnerID']);

    const whereParts = [];
    const replacements = {};

    if (ownerId && ownerIdCol) {
      whereParts.push(`ua.${sqlIdent(ownerIdCol)} = :ownerId`);
      replacements.ownerId = ownerId;
    }

    if (searchParam) {
      const searchParts = [];
      searchParts.push(
        `CAST(ua.${sqlIdent(userIdCol)} AS NVARCHAR(50)) LIKE :search`
      );
      if (userNameCol) {
        searchParts.push(
          `ISNULL(ua.${sqlIdent(userNameCol)}, '') LIKE :search`
        );
      }
      if (fullNameCol) {
        searchParts.push(
          `ISNULL(ua.${sqlIdent(fullNameCol)}, '') LIKE :search`
        );
      }
      if (emailCol) {
        searchParts.push(
          `ISNULL(ua.${sqlIdent(emailCol)}, '') LIKE :search`
        );
      }
      if (phoneCol) {
        searchParts.push(
          `ISNULL(ua.${sqlIdent(phoneCol)}, '') LIKE :search`
        );
      }
      whereParts.push(`(${searchParts.join(' OR ')})`);
      replacements.search = searchParam;
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countResult = await sequelize.query(
      `SELECT COUNT(*) as total
       FROM UserApp ua
       ${whereClause}`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );
    const total = parseInt(countResult[0]?.total || 0, 10);

    const selectUserName = userNameCol ? `ua.${sqlIdent(userNameCol)}` : 'NULL';
    const selectFullName = fullNameCol ? `ua.${sqlIdent(fullNameCol)}` : 'NULL';
    const selectEmail = emailCol ? `ua.${sqlIdent(emailCol)}` : 'NULL';
    const selectPhone = phoneCol ? `ua.${sqlIdent(phoneCol)}` : 'NULL';
    const selectCreatedAt = createdAtCol ? `ua.${sqlIdent(createdAtCol)}` : 'NULL';
    const selectStatus = statusCol ? `ua.${sqlIdent(statusCol)}` : 'NULL';

    const selectBalance = `ISNULL(ua.${sqlIdent('Balance')}, 0)`;

    const orderByCol = createdAtCol
      ? `ua.${sqlIdent(createdAtCol)}`
      : `ua.${sqlIdent(userIdCol)}`;

    const rows = await sequelize.query(
      `SELECT
         ua.${sqlIdent(userIdCol)} as userId,
         ${selectUserName} as userName,
         ${selectFullName} as fullName,
         ${selectEmail} as email,
         ${selectPhone} as phone,
         ${selectBalance} as balance,
         ${selectCreatedAt} as createdAt,
         ${selectStatus} as status
       FROM UserApp ua
       ${whereClause}
       ORDER BY ${orderByCol} DESC
       OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`,
      { replacements, type: sequelize.QueryTypes.SELECT }
    );

    const statusColKey = statusCol ? String(statusCol).toLowerCase() : null;
    const data = (rows || []).map((r) => {
      let isLocked = null;
      if (statusColKey) {
        const v = r.status;
        if (statusColKey === 'isactive' || statusColKey === 'active') {
          isLocked = !(v === 1 || v === true || v === '1');
        } else if (statusColKey === 'islocked' || statusColKey === 'locked') {
          isLocked = v === 1 || v === true || v === '1';
        } else if (statusColKey === 'status') {
          isLocked = !(Number(v) === 1);
        } else {
          isLocked = null;
        }
      }
      return { ...r, isLocked };
    });

    res.json({
      success: true,
      data,
      total,
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
};

// Reset mật khẩu người dùng (UserApp)
const resetUserPassword = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = req.params.id != null ? String(req.params.id).trim() : '';
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'ID người dùng không hợp lệ' });
    }

    const cols = await getUserAppColumnsOrFail(res);
    if (!cols) return;

    const passwordCol = pickColumn(cols.userAppCols, [
      'Password',
      'PassWord',
      'Pwd',
      'HashedPassword',
      'HashPassword',
    ]);
    if (!passwordCol) {
      return res.status(500).json({
        success: false,
        message: 'Bảng UserApp chưa có cột mật khẩu (Password).',
      });
    }

    const DEFAULT_PASSWORD = 'SolarEV@2026';
    const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

    const before = await getUserAppSnapshotById(id, cols);
    if (!before) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    await sequelize.query(
      `UPDATE UserApp
       SET ${sqlIdent(passwordCol)} = :password
       WHERE ${sqlIdent(cols.userIdCol)} = :id`,
      { replacements: { id, password: hashedPassword } }
    );

    const after = await getUserAppSnapshotById(id, cols);
    await insertActivityLog({
      module: 'users',
      action: 'UPDATE',
      actionName: 'USER_RESET_PASSWORD',
      entity: 'UserApp',
      entityId: id,
      before,
      after,
      req,
    });

    return res.json({
      success: true,
      message: `Đã reset mật khẩu người dùng về mật khẩu mặc định: ${DEFAULT_PASSWORD}`,
      data: { userId: id },
    });
  } catch (error) {
    next(error);
  }
};

// Khóa/mở khóa người dùng (UserApp)
const setUserLock = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = req.params.id != null ? String(req.params.id).trim() : '';
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'ID người dùng không hợp lệ' });
    }

    const locked = !!req.body?.locked;

    const cols = await getUserAppColumnsOrFail(res);
    if (!cols) return;

    const statusCol = pickColumn(cols.userAppCols, [
      'IsActive',
      'Active',
      'IsLocked',
      'Locked',
      'Status',
    ]);
    if (!statusCol) {
      return res.status(500).json({
        success: false,
        message: 'Bảng UserApp chưa có cột trạng thái để khóa/mở khóa.',
      });
    }

    const statusColKey = String(statusCol).toLowerCase();
    let valueToSet = locked ? 1 : 0;
    if (
      statusColKey === 'isactive' ||
      statusColKey === 'active' ||
      statusColKey === 'status'
    ) {
      valueToSet = locked ? 0 : 1;
    } else if (statusColKey === 'islocked' || statusColKey === 'locked') {
      valueToSet = locked ? 1 : 0;
    }

    const before = await getUserAppSnapshotById(id, cols);
    if (!before) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    await sequelize.query(
      `UPDATE UserApp
       SET ${sqlIdent(statusCol)} = :value
       WHERE ${sqlIdent(cols.userIdCol)} = :id`,
      { replacements: { id, value: valueToSet } }
    );

    const after = await getUserAppSnapshotById(id, cols);
    await insertActivityLog({
      module: 'users',
      action: 'UPDATE',
      actionName: locked ? 'USER_LOCK' : 'USER_UNLOCK',
      entity: 'UserApp',
      entityId: id,
      before,
      after,
      req,
    });

    return res.json({
      success: true,
      message: locked
        ? 'Đã khóa tài khoản người dùng.'
        : 'Đã mở khóa tài khoản người dùng.',
      data: { userId: id, locked },
    });
  } catch (error) {
    next(error);
  }
};

// Xóa người dùng (UserApp)
const deleteUser = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = req.params.id != null ? String(req.params.id).trim() : '';
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'ID người dùng không hợp lệ' });
    }

    const cols = await getUserAppColumnsOrFail(res);
    if (!cols) return;

    const walletCols = await getTableColumns('WalletTransaction');
    const walletUserIdCol = pickColumn(walletCols, [
      'UserAppId',
      'UserId',
      'UserAppID',
    ]);
    if (walletUserIdCol) {
      const wtCountResult = await sequelize.query(
        `SELECT COUNT(*) as cnt
         FROM WalletTransaction wt
         WHERE wt.${sqlIdent(walletUserIdCol)} = :id`,
        { replacements: { id }, type: sequelize.QueryTypes.SELECT }
      );
      const cnt = parseInt(wtCountResult?.[0]?.cnt || 0, 10);
      if (cnt > 0) {
        return res.status(400).json({
          success: false,
          message: `Không thể xóa vì người dùng đã có ${cnt} giao dịch ví. Vui lòng khóa tài khoản thay vì xóa.`,
        });
      }
    }

    const before = await getUserAppSnapshotById(id, cols);
    if (!before) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    await sequelize.query(
      `DELETE FROM UserApp WHERE ${sqlIdent(cols.userIdCol)} = :id`,
      { replacements: { id } }
    );

    await insertActivityLog({
      module: 'users',
      action: 'DELETE',
      actionName: 'USER_DELETE',
      entity: 'UserApp',
      entityId: id,
      before,
      after: null,
      req,
    });

    return res.json({ success: true, message: 'Đã xóa người dùng.' });
  } catch (error) {
    next(error);
  }
};

// Cộng thêm tiền vào số dư người dùng (UserApp.Balance)
const addUserBalance = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = req.params.id != null ? String(req.params.id).trim() : '';
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'ID người dùng không hợp lệ' });
    }

    const amountRaw = req.body?.amount;
    const amount =
      typeof amountRaw === 'string'
        ? Number(amountRaw.trim())
        : Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Số tiền nạp không hợp lệ' });
    }

    const cols = await getUserAppColumnsOrFail(res);
    if (!cols) return;

    const result = await sequelize.transaction(async (transaction) => {
      const before = await getUserAppSnapshotById(id, cols, transaction);
      if (!before) {
        return {
          ok: false,
          status: 404,
          payload: { success: false, message: 'Không tìm thấy người dùng.' },
        };
      }

      const [row] = await sequelize.query(
        `SELECT ISNULL(ua.${sqlIdent('Balance')}, 0) as balance
         FROM UserApp ua
         WHERE ua.${sqlIdent(cols.userIdCol)} = :id`,
        {
          replacements: { id },
          type: sequelize.QueryTypes.SELECT,
          transaction,
        }
      );
      const currentBalance = Number(row?.balance ?? 0) || 0;
      const newBalance = currentBalance + amount;

      await sequelize.query(
        `UPDATE UserApp
         SET ${sqlIdent('Balance')} = :balance
         WHERE ${sqlIdent(cols.userIdCol)} = :id`,
        { replacements: { id, balance: newBalance }, transaction }
      );

      const after = await getUserAppSnapshotById(id, cols, transaction);
      await insertActivityLog({
        module: 'users',
        action: 'UPDATE',
        actionName: 'USER_BALANCE_ADD',
        entity: 'UserApp',
        entityId: id,
        before,
        after,
        req,
        transaction,
      });

      return {
        ok: true,
        data: {
          userId: id,
          previousBalance: currentBalance,
          amountAdded: amount,
          balance: newBalance,
        },
      };
    });

    if (!result?.ok) {
      return res.status(result.status || 400).json(result.payload);
    }
    return res.json({
      success: true,
      message: 'Nạp tiền thành công.',
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

// Set số dư người dùng theo ý muốn (UserApp.Balance)
const setUserBalance = async (req, res, next) => {
  try {
    if (!requireAdmin(req, res)) return;
    const id = req.params.id != null ? String(req.params.id).trim() : '';
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: 'ID người dùng không hợp lệ' });
    }

    const balanceRaw = req.body?.balance;
    const balance =
      typeof balanceRaw === 'string'
        ? Number(balanceRaw.trim())
        : Number(balanceRaw);
    if (!Number.isFinite(balance) || balance < 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Số dư không hợp lệ' });
    }

    const cols = await getUserAppColumnsOrFail(res);
    if (!cols) return;

    const result = await sequelize.transaction(async (transaction) => {
      const before = await getUserAppSnapshotById(id, cols, transaction);
      if (!before) {
        return {
          ok: false,
          status: 404,
          payload: { success: false, message: 'Không tìm thấy người dùng.' },
        };
      }

      const [row] = await sequelize.query(
        `SELECT ISNULL(ua.${sqlIdent('Balance')}, 0) as balance
         FROM UserApp ua
         WHERE ua.${sqlIdent(cols.userIdCol)} = :id`,
        {
          replacements: { id },
          type: sequelize.QueryTypes.SELECT,
          transaction,
        }
      );
      const previousBalance = Number(row?.balance ?? 0) || 0;

      await sequelize.query(
        `UPDATE UserApp
         SET ${sqlIdent('Balance')} = :balance
         WHERE ${sqlIdent(cols.userIdCol)} = :id`,
        { replacements: { id, balance }, transaction }
      );

      const after = await getUserAppSnapshotById(id, cols, transaction);
      await insertActivityLog({
        module: 'users',
        action: 'UPDATE',
        actionName: 'USER_BALANCE_SET',
        entity: 'UserApp',
        entityId: id,
        before,
        after,
        req,
        transaction,
      });

      return {
        ok: true,
        data: { userId: id, previousBalance, balance },
      };
    });

    if (!result?.ok) {
      return res.status(result.status || 400).json(result.payload);
    }
    return res.json({
      success: true,
      message: 'Cập nhật số dư thành công.',
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  resetUserPassword,
  setUserLock,
  deleteUser,
  addUserBalance,
  setUserBalance,
};

