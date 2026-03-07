const { ROLES } = require('./constants');

/** Admin (PermissionId 1) luôn full quyền: không lọc theo OwnerId */
const isAdmin = (user) => user?.role === ROLES.ADMIN;

/**
 * Trả về ownerId dùng cho lọc dữ liệu. Admin => null (xem toàn bộ), Owner => ownerId của họ.
 */
const getOwnerIdForFilter = (user) => {
  if (!user) return null;
  if (user.role === ROLES.ADMIN) return null;
  return user.ownerId ?? null;
};

const filterByOwner = (query, ownerId) => {
  if (ownerId) {
    query.where = query.where || {};
    query.where.OwnerId = ownerId;
  }
  return query;
};

const checkOwnerAccess = (user, resourceOwnerId) => {
  if (user.role === ROLES.ADMIN) {
    return true;
  }
  if (user.role === ROLES.OWNER && user.ownerId === resourceOwnerId) {
    return true;
  }
  return false;
};

const getUserScope = (user) => {
  if (user.role === ROLES.ADMIN) {
    return {};
  }
  return { OwnerId: user.ownerId };
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
  next();
};

const requireOwner = (req, res, next) => {
  if (req.user.role !== ROLES.OWNER) {
    return res.status(403).json({
      success: false,
      message: 'Owner access required',
    });
  }
  next();
};

const checkResourceOwner = (resource, user) => {
  if (user.role === ROLES.ADMIN) {
    return true;
  }
  return resource.OwnerId === user.ownerId;
};

module.exports = {
  isAdmin,
  getOwnerIdForFilter,
  filterByOwner,
  checkOwnerAccess,
  getUserScope,
  requireAdmin,
  requireOwner,
  checkResourceOwner,
};
