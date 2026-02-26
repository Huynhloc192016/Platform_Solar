const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response.util');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(
      res,
      'Validation failed',
      400,
      errors.array()
    );
  }
  next();
};

module.exports = validate;
