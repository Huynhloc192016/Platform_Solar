const { sendError } = require('../utils/response.util');

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return sendError(res, 'Validation error', 400, errors);
  }

  // Sequelize database errors
  if (err.name === 'SequelizeDatabaseError') {
    console.error('Database Error Details:', {
      message: err.message,
      sql: err.sql,
      original: err.original?.message || err.original,
    });
    return sendError(res, 'Database error', 500, err.original?.message || err.message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token expired', 401);
  }

  // Default error
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  return sendError(res, message, statusCode);
};

module.exports = errorHandler;
