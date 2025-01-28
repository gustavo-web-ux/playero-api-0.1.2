const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true, // for azure
    trustServerCertificate: true, // change to true for local dev / self-signed certs
  },
};

const connectDB = async () => {
  try {
    await sql.connect(config);
    console.log('Connected to the database');
  } catch (err) {
    console.error('Database connection failed: ', err.message);
  }
};

module.exports = connectDB;
