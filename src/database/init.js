const { getConnection, sql } = require('./SqlServer.database');
const { querys } = require('./query.database');

module.exports = {
  getConnection,
  querys,
  sql
};
