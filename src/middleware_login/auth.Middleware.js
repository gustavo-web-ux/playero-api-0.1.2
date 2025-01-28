const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  // const authHeader = req.headers['authorization'];  // Accede a los encabezados Authorization
  // const token = authHeader && authHeader.split(' ')[1];  // Extrae el token (en el formato "Bearer <token>")

  const token = req.cookies.token;  // Extrae el token de las cookies

  if (!token) {
    return res.status(403).json({ message: 'Token requerido.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: 'Token inválido o expirado.' });
    }

    // Si el token es válido, pasamos la información del usuario al siguiente middleware
    req.user = decoded;
    next();
  });
};

module.exports = authenticateToken;
