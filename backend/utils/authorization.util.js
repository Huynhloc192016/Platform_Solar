const { ROLES } = require('./constants');

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
  filterByOwner,
  checkOwnerAccess,
  getUserScope,
  requireAdmin,
  requireOwner,
  checkResourceOwner,
};
