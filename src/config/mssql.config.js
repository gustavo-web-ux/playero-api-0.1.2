const config = require('./env.config');

module.exports = {
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  server: config.DB_SERVER,
  database: config.DB_DATABASE,
  options: {
    encrypt: false, // Cambiar a true para Azure
    enableArithAbort: true,
    trustServerCertificate: true // Cambiar a true para desarrollo local / certificados auto-firmados
  },
  port: parseInt(config.DB_PORT) // Corregir el nombre de la variable
};
