const { Account, Permission, Owner } = require('../models');
const { comparePassword } = require('../utils/password.util');
const { generateToken } = require('../utils/jwt.util');
const { sendSuccess, sendError } = require('../utils/response.util');
const { ROLES } = require('../utils/constants');

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return sendError(res, 'Username and password are required', 400);
    }

    // Query với tên cột đúng theo schema database
    const { sequelize } = require('../config/database');
    const results = await sequelize.query(
      `SELECT TOP 1 [AccountId], [Name], [UserName], [Password], [Code], [DepartmentId], [PermissionId], [OwnerId], [CreateDate], [Images]
       FROM [Account] 
       WHERE [UserName] = :username`,
      {
        replacements: { username },
        type: sequelize.QueryTypes.SELECT
      }
    );

    const account = results && results.length > 0 ? results[0] : null;

    if (!account || !account.AccountId) {
      return sendError(res, 'Invalid credentials', 401);
    }

    // Không có cột Status trong schema, bỏ qua check này
    // if (account.Status !== 1) {
    //   return sendError(res, 'Account is inactive', 401);
    // }

    const isPasswordValid = await comparePassword(password, account.Password || '');

    if (!isPasswordValid) {
      return sendError(res, 'Invalid credentials', 401);
    }

    // Determine role based on PermissionId (tạm thời không query Permission table)
    let role = ROLES.OWNER;
    // Có thể check PermissionId trực tiếp nếu có logic khác
    // if (account.PermissionId === 1) { // Giả sử 1 là Admin
    //   role = ROLES.ADMIN;
    // }

    const tokenPayload = {
      id: account.AccountId,
      username: account.UserName,
      fullName: account.Name,
      email: null, // Không có Email trong schema
      role: role,
      ownerId: account.OwnerId,
      permissionId: account.PermissionId,
    };

    const token = generateToken(tokenPayload);

    return sendSuccess(res, 'Login successful', {
      token,
      user: {
        id: account.AccountId,
        username: account.UserName,
        fullName: account.Name,
        email: null,
        role: role,
        ownerId: account.OwnerId,
      },
    });
  } catch (error) {
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

    // Determine role based on PermissionId (tạm thời không query Permission table)
    let role = ROLES.OWNER;
    // Có thể check PermissionId trực tiếp nếu có logic khác
    // if (account.PermissionId === 1) { // Giả sử 1 là Admin
    //   role = ROLES.ADMIN;
    // }

    return sendSuccess(res, 'User information retrieved', {
      id: account.AccountId,
      username: account.UserName,
      fullName: account.Name,
      email: null,
      phone: null,
      role: role,
      ownerId: account.OwnerId,
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
