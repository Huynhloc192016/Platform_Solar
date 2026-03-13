const paginationMiddleware = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const sortBy = req.query.sortBy || 'Id';
  const sortOrder = req.query.sortOrder || 'ASC';

  req.pagination = {
    page: Math.max(1, page),
    limit: Math.min(100, Math.max(1, limit)),
    sortBy,
    sortOrder: sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
  };

  next();
};

module.exports = paginationMiddleware;
