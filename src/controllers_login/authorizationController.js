const { getConnection, sql } = require('../database/init');

const getUserAuthorizations = async (req, res) => {
  const userId = req.user.userId; // ID del usuario autenticado
  const sucursalId = req.query.sucursalId; // Acceder al parámetro de la URL "sucursalId"

  if (!sucursalId) {
    return res.status(400).json({ autorizado: false, message: 'El parámetro sucursalId es obligatorio.' });
  }

  try {
    const pool = await getConnection();

    // 1. Obtener el rol del usuario y verificar acceso global
    const roleQuery = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT TOP 1 r.id_rol, r.global_access 
        FROM dbo.rol r
        INNER JOIN dbo.user_roles ur ON r.id_rol = ur.role_id
        WHERE ur.user_id = @userId
      `);

    const userRole = roleQuery.recordset[0]; // Rol del usuario

    if (!userRole) {
      return res.status(403).json({ autorizado: false, message: 'No se encontró el rol del usuario.' });
    }

    let autorizaciones;

    // 2. Si tiene acceso global, devolver todas las autorizaciones
    if (userRole.global_access) {
      const allAuthQuery = await pool.request().query(`
        SELECT DISTINCT id_autorizacion, descripcion, clave
        FROM dbo.autorizaciones
      `);
      autorizaciones = allAuthQuery.recordset;

      // Excluir claves específicas (como 'personas.edicion') para el rol administrador
      autorizaciones = autorizaciones.filter(auth => auth.clave !== 'personas.vista');
    } else {
      // 3. Si no tiene acceso global, obtener autorizaciones específicas del usuario para la sucursal indicada
      const userAuthQuery = await pool.request()
        .input('userId', sql.Int, userId)
        .input('sucursalId', sql.Int, sucursalId)
        .query(`
          SELECT DISTINCT a.id_autorizacion, a.descripcion, a.clave
          FROM dbo.autorizaciones a
          INNER JOIN dbo.autorizacion_rol ar ON a.id_autorizacion = ar.id_autorizacion
          INNER JOIN dbo.user_roles ur ON ur.role_id = ar.id_rol
          INNER JOIN dbo.permisos p ON p.id_user = ur.user_id AND p.id_rol = ur.role_id
          WHERE ur.user_id = @userId AND p.id_sucursal = @sucursalId
        `);
      autorizaciones = userAuthQuery.recordset;
    }

    // 4. Devolver las autorizaciones en formato JSON
    return res.json({
      autorizado: true,
      autorizaciones,
    });
  } catch (error) {
    console.error('Error al obtener autorizaciones:', error);
    res.status(500).json({ message: 'Error interno al obtener autorizaciones.' });
  }
};


module.exports = { getUserAuthorizations };