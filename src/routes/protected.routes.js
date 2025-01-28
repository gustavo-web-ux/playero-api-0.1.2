const express = require('express');
const auth = require('../middlewares/authSap.middleware');
const router = express.Router();

router.get('/protected', auth, (req, res) => {
  res.json({ message: 'This is a protected route' });
});

module.exports = router;
