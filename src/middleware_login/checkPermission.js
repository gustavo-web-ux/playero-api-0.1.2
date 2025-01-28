const { getConnection, sql } = require('../database/init');

const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const { roleId } = req.user; // Extraído del token JWT

      const pool = await getConnection();
      const result = await pool.request()
        .input('roleId', sql.Int, roleId)
        .input('permission', sql.VarChar, requiredPermission)
        .query(`
            SELECT rp.*
            FROM user_roles ur
            INNER JOIN permiso_rol rp ON ur.role_id = rp.id_rol
            INNER JOIN permiso p ON rp.id_permiso = p.id_permiso
            WHERE ur.user_id = @userId AND p.name = @permission
        `);

      if (!result.recordset.length) {
        return res.status(403).json({ message: 'Permiso denegado.' });
      }

      next();
    } catch (error) {
      console.error('Error verificando permisos:', error);
      res.status(500).json({ message: 'Error interno del servidor.' });
    }
  };
};

module.exports = checkPermission;
