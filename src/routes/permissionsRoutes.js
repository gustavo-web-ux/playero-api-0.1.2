const express = require('express');
const { checkPermission } = require('../controllers_login/permissionsController');
const authenticateToken = require('../middleware_login/auth.Middleware');
const { getUserAuthorizations } = require('../controllers_login/authorizationController')
const router = express.Router();

// Verificar permisos para una acción específica
router.post('/check', authenticateToken, checkPermission);
router.get('/autorizacion', authenticateToken, getUserAuthorizations);

module.exports = router;
