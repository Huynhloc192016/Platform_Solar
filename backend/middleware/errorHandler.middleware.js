const { sendError } = require('../utils/response.util');

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  // Log đầy đủ để debug (đặc biệt khi kết nối production DB)
  console.error('[ErrorHandler]', {
    message: err.message,
    name: err.name,
    code: err.code,
    statusCode,
    path: req?.path,
    stack: err.stack,
  });
  if (err.sql) {
    console.error('[ErrorHandler] SQL:', err.sql);
  }
  if (err.original) {
    console.error('[ErrorHandler] Original:', err.original?.message || err.original);
  }

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors?.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return sendError(res, 'Validation error', 400, errors);
  }

  // Sequelize database errors
  if (err.name === 'SequelizeDatabaseError') {
    return sendError(res, 'Database error', 500, err.original?.message || err.message);
  }

  // Connection / timeout errors
  if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeConnectionRefusedError' || err.name === 'SequelizeTimeoutError') {
    console.error('[ErrorHandler] DB connection issue:', err.message);
    return sendError(res, 'Database connection error', 500, err.message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 401);
  }

  // Default error
  return sendError(res, message, statusCode);
};

module.exports = errorHandler;
