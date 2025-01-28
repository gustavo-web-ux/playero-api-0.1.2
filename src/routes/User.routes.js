const { Router } = require('express');
const createUser = require('../controllers/User.controller');
const { authJwt, verifySignup } = require('../middlewares/init');

const router = Router();

router.post(
  '/user',
  [authJwt.verifyToken, authJwt.isAmin, verifySignup.checkRolesExisted],
  createUser
);

module.exports = router;
