const buildPagination = (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  return { limit, offset, page: parseInt(page) };
};

const buildWhereClause = (filters) => {
  const where = {};
  if (filters) {
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        where[key] = filters[key];
      }
    });
  }
  return where;
};

const buildOrderClause = (sortBy = 'Id', sortOrder = 'ASC') => {
  return [[sortBy, sortOrder]];
};

module.exports = {
  buildPagination,
  buildWhereClause,
  buildOrderClause,
};
