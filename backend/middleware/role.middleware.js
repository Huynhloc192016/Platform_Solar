const { ROLES } = require('../utils/constants');
const { sendError } = require('../utils/response.util');

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 'Insufficient permissions', 403);
    }

    next();
  };
};

const requireAdmin = requireRole(ROLES.ADMIN);
const requireOwner = requireRole(ROLES.OWNER);

const checkMenuPermission = async (req, res, next) => {
  // This can be extended to check menu permissions from database
  // For now, just pass through
  next();
};

module.exports = {
  requireRole,
  requireAdmin,
  requireOwner,
  checkMenuPermission,
};
