/**
 * Barrel: re-export tất cả handler từ các controller theo domain.
 * Routes vẫn dùng file này; logic nằm trong từng *page.controller.js.
 */
const dashboardPage = require('./dashboard.page.controller');
const stationsPage = require('./stations.page.controller');
const chargePointsPage = require('./chargepoints.page.controller');
const sessionsPage = require('./sessions.page.controller');
const ordersPage = require('./orders.page.controller');
const usersPage = require('./users.page.controller');
const ownersPage = require('./owners.page.controller');
const exportPage = require('./export.page.controller');
const servicePage = require('./service.page.controller');

module.exports = {
  ...dashboardPage,
  ...stationsPage,
  ...chargePointsPage,
  ...sessionsPage,
  ...ordersPage,
  ...usersPage,
  ...ownersPage,
  ...exportPage,
  ...servicePage,
};
