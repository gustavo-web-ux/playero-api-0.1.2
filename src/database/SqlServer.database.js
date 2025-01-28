const sql = require('mssql');
const dbSettings = require('../config/mssql.config');

let pool;

const connectToDatabase = () => {
  try {
    //console.log('Connecting to SRV: ' + dbSettings.server + ' DB: ' + dbSettings.database);
    pool = sql.connect(dbSettings);
    console.log('Connected to SRV: ' + dbSettings.server + ' DB: ' + dbSettings.database);
  } catch (error) {
    console.error('ERROR OCCURRED: => ', error);
  }
};

const getConnection = () => {
  if (pool) {
    return pool;
  } else {
    throw new Error('The connection to the database is not available');
  }
};



module.exports = { sql, getConnection, connectToDatabase};
