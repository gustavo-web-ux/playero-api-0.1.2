const { Router } = require('express');
const controller = require('../controllers/Auth.controller');
const { verifySignup } = require('../middlewares/init');

const router = Router();

router.post(
  '/signup',
  [verifySignup.checkDuplicatedUsernameOrEmail, verifySignup.checkRolesExisted],
  controller.signUp
);

router.post('/signin', controller.signIn);

module.exports = router;
