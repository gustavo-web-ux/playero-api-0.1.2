const express = require('express');
const { register, login } = require('../controllers/authSap.controller');
const router = express.Router();

router.post('/login', login);
router.post('/register', register);

module.exports = router;
