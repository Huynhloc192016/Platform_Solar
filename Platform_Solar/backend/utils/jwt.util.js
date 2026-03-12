const jwt = require('jsonwebtoken');
const { secret, expiresIn } = require('../config/jwt.config');

const generateToken = (payload) => {
  return jwt.sign(payload, secret, { expiresIn });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    throw error;
  }
};

module.exports = {
  generateToken,
  verifyToken,
};
