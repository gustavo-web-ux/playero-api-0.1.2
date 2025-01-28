const express = require('express');
const { login, register, validateToken, logout, getAllUsers, getRoles, getUsers, updateUser } = require('../controllers_login/authController');
const authenticateToken = require('../middleware_login/auth.Middleware');
const router = express.Router();

router.post('/login', login);

// Ruta para registro
router.post('/register', register);

// Validación de token
router.get('/validate', authenticateToken, validateToken);

router.post('/logout', logout);
// Ruta para obtener todos los usuarios
router.get('/users', getAllUsers);

router.get('/getUsers/:user_id', getUsers);
// Ruta para actualización de usuario
router.put('/update', updateUser);

router.get('/roles', getRoles);


module.exports = router;
