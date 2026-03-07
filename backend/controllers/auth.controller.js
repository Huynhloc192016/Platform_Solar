const { Account, Permission, Owner } = require('../models');
const { comparePasswordWithLegacy } = require('../utils/password.util');
const { generateToken } = require('../utils/jwt.util');
const { sendSuccess, sendError } = require('../utils/response.util');
const { ROLES } = require('../utils/constants');

const login = async (req, res, next) => {
  const { username, password } = req.body;
  try {
    console.log('[Auth] Login attempt:', { username: username || '(empty)' });

    if (!username || !password) {
      console.warn('[Auth] Login failed: missing username or password');
      return sendError(res, 'Username and password are required', 400);
    }

    // Query với tên cột đúng theo schema database
    const { sequelize } = require('../config/database');
    let results;
    try {
      results = await sequelize.query(
        `SELECT TOP 1 [AccountId], [Name], [UserName], [Password], [Code], [DepartmentId], [PermissionId], [OwnerId], [CreateDate], [Images]
         FROM [Account] 
         WHERE [UserName] = :username`,
        {
          replacements: { username },
          type: sequelize.QueryTypes.SELECT
        }
      );
    } catch (dbErr) {
      console.error('[Auth] Database query error:', {
        message: dbErr.message,
        name: dbErr.name,
        stack: dbErr.stack,
      });
      throw dbErr;
    }

    const account = results && results.length > 0 ? results[0] : null;

    if (!account || !account.AccountId) {
      console.warn('[Auth] Login failed: account not found for username:', username);
      return sendError(res, 'Invalid credentials', 401);
    }

    console.log('[Auth] Account found:', {
      accountId: account.AccountId,
      userName: account.UserName,
      hasPassword: !!account.Password,
      passwordLength: account.Password ? String(account.Password).length : 0,
    });

    // Không có cột Status trong schema, bỏ qua check này
    // if (account.Status !== 1) {
    //   return sendError(res, 'Account is inactive', 401);
    // }

    let isPasswordValid = false;
    try {
      isPasswordValid = await comparePasswordWithLegacy(password, account.Password || '');
    } catch (compareErr) {
      console.error('[Auth] Password compare error:', {
        message: compareErr.message,
        hint: 'Check bcrypt vs legacy Base64 format',
      });
      throw compareErr;
    }

    if (!isPasswordValid) {
      console.warn('[Auth] Login failed: invalid password for username:', username);
      return sendError(res, 'Invalid credentials', 401);
    }

    // Admin: PermissionId === 1 → full quyền (role Admin, ownerId null để frontend hiển thị đủ menu)
    let role = (account.PermissionId === 1) ? ROLES.ADMIN : ROLES.OWNER;
    const isAdmin = role === ROLES.ADMIN;

    const tokenPayload = {
      id: account.AccountId,
      username: account.UserName,
      fullName: account.Name,
      email: null,
      role,
      ownerId: isAdmin ? null : account.OwnerId,
      permissionId: account.PermissionId,
    };

    const token = generateToken(tokenPayload);

    console.log('[Auth] Login success:', { username: account.UserName, accountId: account.AccountId, role });
    return sendSuccess(res, 'Login successful', {
      token,
      user: {
        id: account.AccountId,
        username: account.UserName,
        fullName: account.Name,
        email: null,
        role,
        ownerId: isAdmin ? null : account.OwnerId,
      },
    });
  } catch (error) {
    console.error('[Auth] Login error:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
    });
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    // Query với raw SQL để match schema thực tế
    const { sequelize } = require('../config/database');
    const results = await sequelize.query(
      `SELECT TOP 1 [AccountId], [Name], [UserName], [Code], [DepartmentId], [PermissionId], [OwnerId], [CreateDate], [Images]
       FROM [Account] 
       WHERE [AccountId] = :accountId`,
      {
        replacements: { accountId: req.user.id },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const account = results && results.length > 0 ? results[0] : null;

    if (!account) {
      return sendError(res, 'Account not found', 404);
    }

    // Admin: PermissionId === 1 → full quyền
    let role = (account.PermissionId === 1) ? ROLES.ADMIN : ROLES.OWNER;
    const isAdmin = role === ROLES.ADMIN;

    return sendSuccess(res, 'User information retrieved', {
      id: account.AccountId,
      username: account.UserName,
      fullName: account.Name,
      email: null,
      phone: null,
      role,
      ownerId: isAdmin ? null : account.OwnerId,
      permissionId: account.PermissionId,
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    // In a stateless JWT system, logout is typically handled client-side
    // by removing the token. If you need server-side logout, implement token blacklisting.
    return sendSuccess(res, 'Logout successful');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  getMe,
  logout,
};
