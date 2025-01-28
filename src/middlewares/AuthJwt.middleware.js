const jwt = require('jsonwebtoken');
const config = require('../config/server.config');
const User = require('../models/UserAuth.model');
const Role = require('../models/Role.model');

const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers['x-access-token'];

    if (!token) return res.status(403).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, config.SECRET);
    req.userId = decoded.id;

    const user = await User.findById(req.userId);

    if (!user) return res.status(404).json({ message: 'User not found' });
    next();
  } catch (error) {
    return res.status(401).json({ message: 'unauthorized' });
  }
};

const isAmin = async (req, res, next) => {
  const user = await User.findById(req.userId);
  const roles = await Role.find({ _id: { $in: user.roles } });

  for (let i = 0; i < roles.length; i++) {
    if (roles[i].name === 'admin') {
      next();
      return;
    }
  }

  return res.status(403).json({ message: 'Requires admin role' });
};

module.exports = { verifyToken, isAmin };
