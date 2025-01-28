require('dotenv').config();
module.exports = {
  SECRET: process.env.SECRET,
  MONGO_URI: process.env.MONGO_URI,
  PORT: process.env.PORT,

  DB_SERVER: process.env.DB_SERVER,
  DB_PORT: process.env.DB_PORT,
  DB_DATABASE: process.env.DB_DATABASE,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,

  TOKEN_TEST: process.env.TOKEN_TEST,
  NODE_ENV: process.env.NODE_ENV
};