const { verifyToken, isAmin } = require('./AuthJwt.middleware');
const {
  checkRolesExisted,
  checkDuplicatedUsernameOrEmail
} = require('./verifySignup.middleware');

module.exports.authJwt = {
  verifyToken,
  isAmin
};

module.exports.verifySignup = {
  checkRolesExisted,
  checkDuplicatedUsernameOrEmail
};
