const { Schema } = require('mongoose');
const bcrypt = require('bcryptjs');
//const { dbKpiConnection } = require('../database/Mongo.database');
const { dbUsersTeConnection } = require('../database/Mongo.database');

const userSchema = new Schema(
  {
    username: {
      type: String,
      unique: true
    },
    email: {
      type: String,
      unique: true
    },

    password: {
      type: String,
      require: true
    },

    roles: [
      {
        ref: 'Role',
        type: Schema.Types.ObjectId
      }
    ]
  },
  {
    timestamps: true,
    versionKey: false
  }
);

userSchema.statics.encryptPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};
userSchema.statics.comparePassword = async (password, receivedPassword) => {
  return await bcrypt.compare(password, receivedPassword);
};

module.exports = dbUsersTeConnection.model('User', userSchema);
