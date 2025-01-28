const bcrypt = require('bcryptjs');
const sql = require('mssql');

const getUserById = async (id) => {
  const request = new sql.Request();
  return await request.query(`SELECT TOP (1000) [id], [nombre], [url], [user], [contrasena], [activo] FROM [sys_playero].[dbo].[config_sap] WHERE id = ${id}`);
};

const getUserByUsername = async (username) => {
  const request = new sql.Request();
  return await request.query(`SELECT TOP (1) [id], [nombre], [url], [user], [contrasena], [activo] FROM [sys_playero].[dbo].[config_sap] WHERE [user] = '${username}'`);
};

const createUser = async (user) => {
  const hashedPassword = await bcrypt.hash(user.password, 10);
  const request = new sql.Request();
  return await request.query(
    `INSERT INTO [sys_playero].[dbo].[config_sap] ([nombre], [url], [user], [contrasena], [activo]) 
    VALUES ('${user.nombre}', '${user.url}', '${user.user}', '${hashedPassword}', '${user.activo}')`
  );
};

module.exports = {
  getUserById,
  getUserByUsername,
  createUser,
};
