const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization')?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Agrega el usuario decodificado al request
    next();
  } catch (error) {
    res.status(403).json({ message: "Invalid or expired token." });
  }
};

module.exports = authenticateToken;
