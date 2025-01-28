const { Schema } = require('mongoose');
const { dbUsersTeConnection } = require('../database/Mongo.database');

const roleSchema = new Schema(
  {
    name: String
  },
  { versionKey: false }
);

module.exports = dbUsersTeConnection.model('Role', roleSchema);
