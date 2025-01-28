const Role = require('../models/Role.model');
const User = require('../models/UserAuth.model');

const checkDuplicatedUsernameOrEmail = async (req, res, next) => {
  const user = await User.findOne({ username: req.body.username });

  if (user) return res.status(400).json({ message: 'The user already exists' });

  const email = await User.findOne({ email: req.body.email });

  if (email) { return res.status(400).json({ message: 'The email already exists' }); }

  next();
};

const checkRolesExisted = async (req, res, next) => {
  const reqRoles = req.body.roles;

  const listRoles = await Role.find({});
  const roleArr = listRoles.map((role) => role.name);

  if (reqRoles) {
    for (let i = 0; i < reqRoles.length; i++) {
      if (!roleArr.includes(reqRoles[i])) {
        console.log(reqRoles[i]);
        return res
          .status(400)
          .json({ message: `Role ${reqRoles[i]} does not exists` });
      }
    }
  }
  next();
};
module.exports = {
  checkRolesExisted,
  checkDuplicatedUsernameOrEmail
};
