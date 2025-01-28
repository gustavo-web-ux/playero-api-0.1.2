const { getConnection, sql } = require('../database/init');

const getSucursales = async (req, res) => {
  const userId = req.user.userId;

  try {
    const pool = await getConnection();

    // 1. Obtener el rol del usuario y su sucursal predeterminada (si existe)
    const userInfoQuery = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT r.id_rol, r.global_access, u.default_sucursal_id
        FROM dbo.rol r
        INNER JOIN dbo.user_roles ur ON r.id_rol = ur.role_id
        INNER JOIN dbo.users u ON u.id = ur.user_id
        WHERE ur.user_id = @userId
      `);

    const userInfo = userInfoQuery.recordset[0];

    if (!userInfo) {
      return res.status(403).json({ autorizado: false, message: 'No se encontró la información del usuario.' });
    }

    let sucursales;

    // 2. Si el rol tiene acceso global (admin), devolver todas las sucursales
    if (userInfo.global_access) {
      const sucursalesQuery = await pool.request().query(`
        SELECT id_sucursal, descripcion
        FROM dbo.sucursal
      `);
      sucursales = sucursalesQuery.recordset;
    } else {
      // 3. Si no es admin, obtener solo las sucursales a las que el usuario tiene acceso
      const sucursalesQuery = await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          SELECT s.id_sucursal, s.descripcion
          FROM dbo.sucursal s
          INNER JOIN dbo.permisos p ON p.id_sucursal = s.id_sucursal
          WHERE p.id_user = @userId
        `);
      sucursales = sucursalesQuery.recordset;
    }

    // 4. Devolver las sucursales y la sucursal predeterminada (si existe)
    return res.json({
      sucursales: sucursales,
      defaultSucursalId: userInfo.default_sucursal_id || null
    });
  } catch (error) {
    console.error('Error al obtener las sucursales:', error);
    res.status(500).json({ message: 'Error interno al obtener las sucursales.' });
  }
};

const createSucursal = async (req, res) => {
  try {
    const pool = await getConnection();

    // Obtener los valores enviados desde el cuerpo de la solicitud
    const { descripcion, codigo_sucursal } = req.body;

    // Validar que los campos requeridos no estén vacíos
    if (!descripcion || !codigo_sucursal) {
      return res.status(400).json({
        message: 'Los campos descripcion y codigo_sucursal son obligatorios.',
      });
    }

    // Ejecutar la consulta de inserción
    const insertQuery = await pool.request()
      .input('descripcion', sql.VarChar, descripcion)
      .input('codigo_sucursal', sql.VarChar, codigo_sucursal)
      .query(`
        INSERT INTO dbo.sucursal (descripcion, codigo_sucursal)
        VALUES (@descripcion, @codigo_sucursal)
      `);

    // Verificar si se insertó el registro correctamente
    if (insertQuery.rowsAffected[0] > 0) {
      return res.status(201).json({
        message: 'Sucursal creada exitosamente.',
        data: {
          descripcion,
          codigo_sucursal,
        },
      });
    } else {
      return res.status(500).json({
        message: 'Error al crear la sucursal.',
      });
    }

  } catch (error) {
    console.error('Error al crear la sucursal:', error);
    res.status(500).json({ message: 'Error interno al crear la sucursal.' });
  }
};

const updateSucursalN = async (req, res) => {
  try {
    const pool = await getConnection();

    // Obtener los valores enviados desde el cuerpo de la solicitud y parámetros
    const { id_sucursal } = req.params;
    const { descripcion, codigo_sucursal } = req.body;

    // Validar que el ID de la sucursal y los campos requeridos no estén vacíos
    if (!id_sucursal) {
      return res.status(400).json({
        message: 'El ID de la sucursal es obligatorio.',
      });
    }

    if (!descripcion || !codigo_sucursal) {
      return res.status(400).json({
        message: 'Los campos descripcion y codigo_sucursal son obligatorios.',
      });
    }

    // Ejecutar la consulta de actualización
    const updateQuery = await pool.request()
      .input('id_sucursal', sql.Int, id_sucursal)
      .input('descripcion', sql.VarChar, descripcion)
      .input('codigo_sucursal', sql.VarChar, codigo_sucursal)
      .query(`
        UPDATE dbo.sucursal
        SET descripcion = @descripcion,
            codigo_sucursal = @codigo_sucursal
        WHERE id_sucursal = @id_sucursal
      `);

    // Verificar si se actualizó algún registro
    if (updateQuery.rowsAffected[0] > 0) {
      return res.status(200).json({
        message: 'Sucursal actualizada exitosamente.',
        data: {
          id_sucursal,
          descripcion,
          codigo_sucursal,
        },
      });
    } else {
      return res.status(404).json({
        message: 'Sucursal no encontrada o no se realizaron cambios.',
      });
    }

  } catch (error) {
    console.error('Error al actualizar la sucursal:', error);
    res.status(500).json({ message: 'Error interno al actualizar la sucursal.' });
  }
};

const getAllSucursales = async (req, res) => {
  try {
    const pool = await getConnection();

    // Consulta para obtener todas las sucursales
    const sucursalesQuery = await pool.request().query(`
      SELECT id_sucursal, descripcion
      FROM dbo.sucursal
    `);

    const sucursales = sucursalesQuery.recordset;

    // Devolver las sucursales
    return res.json(sucursales);
  } catch (error) {
    console.error('Error al obtener las sucursales:', error);
    res.status(500).json({ message: 'Error interno al obtener las sucursales.' });
  }
};

const getAllSucursal = async (req, res) => {
  try {
    const pool = await getConnection();

    // Parámetros para paginación y filtro (valores por defecto)
    const { page = 1, limit = 10, search = '' } = req.query;

    // Conversión segura a números
    const pageNumber = Math.max(1, Number(page)); // Página no puede ser menor a 1
    const limitNumber = Math.max(1, Number(limit)); // Límite no puede ser menor a 1
    const offset = (pageNumber - 1) * limitNumber; // Desplazamiento (OFFSET)

    // Filtro general aplicado a 'descripcion' y 'codigo_sucursal'
    const filterQuery = search
      ? `WHERE descripcion LIKE '%' + @search + '%'
          OR codigo_sucursal LIKE '%' + @search + '%'`
      : '';

    // Consulta para obtener los registros con paginación y filtro
    const sucursalesQuery = await pool.request()
      .input('search', sql.VarChar, search)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limitNumber)
      .query(`
        SELECT id_sucursal, descripcion, codigo_sucursal
        FROM dbo.sucursal
        ${filterQuery} -- Aplica filtro solo si existe búsqueda
        ORDER BY id_sucursal
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
      `);

    // Consulta para contar el total de registros (sin paginación)
    const totalQuery = await pool.request()
      .input('search', sql.VarChar, search)
      .query(`
        SELECT COUNT(*) AS total
        FROM dbo.sucursal
        ${filterQuery}
      `);

    // Resultados
    const sucursales = sucursalesQuery.recordset;
    const totalRecords = totalQuery.recordset[0].total;

    // Calcular total de páginas
    const totalPages = Math.ceil(totalRecords / limitNumber);

    // Responder con los datos paginados
    return res.json({
      data: sucursales, // Datos de la página actual
      totalRecords,    // Total de registros encontrados
      totalPages,      // Total de páginas calculadas
      currentPage: pageNumber, // Página actual
      pageSize: limitNumber,   // Tamaño de página
    });

  } catch (error) {
    console.error('Error al obtener las sucursales:', error);
    res.status(500).json({ message: 'Error interno al obtener las sucursales.' });
  }
};

const setDefaultSucursal = async (req, res) => {
  const userId = req.user.userId;
  const { sucursalId } = req.body;

  try {
    const pool = await getConnection();

    // Si sucursalId es null, eliminar la sucursal predeterminada
    if (sucursalId === null) {
      await pool.request()
        .input('userId', sql.Int, userId)
        .query(`
          UPDATE dbo.users
          SET default_sucursal_id = NULL
          WHERE id = @userId
        `);
      return res.json({ message: 'Sucursal predeterminada eliminada con éxito.' });
    }

    // Verificar si el usuario tiene acceso a esta sucursal
    const hasAccessQuery = await pool.request()
      .input('userId', sql.Int, userId)
      .input('sucursalId', sql.Int, sucursalId)
      .query(`
        SELECT 1
        FROM dbo.permisos
        WHERE id_user = @userId AND id_sucursal = @sucursalId
        UNION ALL
        SELECT 1
        FROM dbo.rol r
        INNER JOIN dbo.user_roles ur ON r.id_rol = ur.role_id
        WHERE ur.user_id = @userId AND r.global_access = 1
      `);

    if (hasAccessQuery.recordset.length === 0) {
      return res.status(403).json({ message: 'No tienes acceso a esta sucursal.' });
    }

    // Actualizar la sucursal predeterminada del usuario
    await pool.request()
      .input('userId', sql.Int, userId)
      .input('sucursalId', sql.Int, sucursalId)
      .query(`
        UPDATE dbo.users
        SET default_sucursal_id = @sucursalId
        WHERE id = @userId
      `);

    res.json({ message: 'Sucursal predeterminada actualizada con éxito.' });
  } catch (error) {
    console.error('Error al establecer la sucursal predeterminada:', error);
    res.status(500).json({ message: 'Error interno al establecer la sucursal predeterminada.' });
  }
};

module.exports = { getSucursales, setDefaultSucursal, getAllSucursales, getAllSucursal, createSucursal, updateSucursalN };
