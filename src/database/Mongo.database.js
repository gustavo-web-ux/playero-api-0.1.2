const mongoose = require('mongoose');
const config = require('../config/mongo.config');

// Primera base de datos (db1) para kpi
/*const dbKpiConnection = mongoose.createConnection(config.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

dbKpiConnection.on('error', (err) => {
  console.error('Database connection failed for kpi. Exiting now...');
  console.error(err);
  process.exit(1);
});

dbKpiConnection.once('open', () => {
  console.log('Successfully connected to database for kpi');
});*/

// Segunda base de datos (db2) para autenticacionService
const dbUsersTeConnection = mongoose.createConnection(config.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

dbUsersTeConnection.on('error', (err) => {
  console.error('Database connection failed for Users TE. Exiting now...');
  console.error(err);
  process.exit(1);
});

dbUsersTeConnection.once('open', () => {
  console.log('Successfully connected to database for Users TE');
});

module.exports = { dbUsersTeConnection };
