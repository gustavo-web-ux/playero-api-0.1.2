const { getUserByUsername, createUser } = require('../models/userSap.model');
const jwt = require('jsonwebtoken');

const register = async (req, res) => {
  const { nombre, url, username, password, activo } = req.body;

  try {
    const userExists = await getUserByUsername(username);

    // if (userExists.recordset.length > 0) {
    //   return res.status(400).json({ message: 'User already exists' });
    // }

    const newUser = {
      nombre,
      url,
      user: username,
      password: password, 
      activo
    };

    await createUser(newUser);

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await getUserByUsername(username);
    const user = result.recordset[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Comparar la contraseña ingresada con la almacenada
    if (password !== user.password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generar token JWT
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  register,
  login,
};
