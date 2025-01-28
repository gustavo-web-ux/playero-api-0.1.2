const { getConnection, sql } = require('../database/init');

const getRoles = async (req, res) => {
    try {
        const pool = await getConnection();

        // Obtener los parámetros de paginación y filtro desde la solicitud
        const page = parseInt(req.query.page, 10) || 1; // Página actual (por defecto, 1)
        const limit = parseInt(req.query.limit, 10) || 10; // Registros por página (por defecto, 10)
        const offset = (page - 1) * limit; // Calcular el desplazamiento
        const filter = req.query.filter || ''; // Filtro general (cadena vacía por defecto)

        // Consulta para obtener el total de registros con el filtro aplicado, excluyendo el rol "admin"
        const totalQuery = await pool.request()
            .input('filter', sql.NVarChar, `%${filter}%`)
            .query(`
                SELECT COUNT(*) AS total
                FROM dbo.rol
                WHERE nombre_rol LIKE @filter
                AND id_rol != 1 -- Excluir el rol admin por ID
            `);

        const totalRecords = totalQuery.recordset[0]?.total || 0; // Total de registros filtrados

        // Consulta para obtener los roles con paginación y filtro, excluyendo el rol "admin"
        const rolesQuery = await pool.request()
            .input('filter', sql.NVarChar, `%${filter}%`)
            .input('offset', sql.Int, offset)
            .input('limit', sql.Int, limit)
            .query(`
                SELECT id_rol, nombre_rol, global_access
                FROM dbo.rol
                WHERE nombre_rol LIKE @filter
                AND id_rol != 1 -- Excluir el rol admin por ID
                ORDER BY id_rol
                OFFSET @offset ROWS
                FETCH NEXT @limit ROWS ONLY
            `);

        const roles = rolesQuery.recordset;

        // Validar si hay roles registrados con el filtro aplicado
        if (!roles || roles.length === 0) {
            return res.status(404).json({ message: 'No se encontraron roles registrados.' });
        }

        // Devolver los roles, el total de registros y otros datos útiles para la paginación
        return res.status(200).json({
            roles: roles,
            totalRecords: totalRecords, // Total de registros en la tabla
            totalPages: Math.ceil(totalRecords / limit), // Total de páginas
            currentPage: page, // Página actual
        });
    } catch (error) {
        console.error('Error al obtener los roles:', error);
        res.status(500).json({ message: 'Error interno al obtener los roles.' });
    }
};


const createRole = async (req, res) => {
    const { nombre_rol, global_access, autorizaciones } = req.body;

    if (!nombre_rol || global_access === undefined) {
        return res.status(400).json({ error: 'Nombre del rol y acceso global son obligatorios' });
    }

    const pool = await getConnection();

    try {
        // Inserta el rol en la tabla `rol`
        const result = await pool
            .request()
            .input('nombre_rol', sql.VarChar, nombre_rol)
            .input('global_access', sql.Bit, global_access)
            .query('INSERT INTO rol (nombre_rol, global_access) OUTPUT inserted.id_rol VALUES (@nombre_rol, @global_access)');

        const id_rol = result.recordset[0].id_rol;

        if (global_access == 0) {
            // Si no tiene acceso global, asocia el rol con las autorizaciones
            for (const id_autorizacion of autorizaciones) {
                await pool
                    .request()
                    .input('id_rol', sql.Int, id_rol)
                    .input('id_autorizacion', sql.Int, id_autorizacion)
                    .query('INSERT INTO autorizacion_rol (id_rol, id_autorizacion) VALUES (@id_rol, @id_autorizacion)');
            }
        }

        res.status(201).json({ message: 'Rol creado exitosamente', id_rol });
    } catch (error) {
        console.error('Error al crear rol:', error);
        res.status(500).json({ error: 'Error interno al crear rol' });
    }
};

const getRoleById = async (req, res) => {
    const { id_rol } = req.params;

    if (!id_rol) {
        return res.status(400).json({ error: 'El ID del rol es obligatorio' });
    }

    const pool = await getConnection();

    try {
        // Obtener el nombre del rol
        const roleQuery = await pool.request()
            .input('id_rol', sql.Int, id_rol)
            .query(`
                SELECT id_rol, nombre_rol, global_access
                FROM rol
                WHERE id_rol = @id_rol
            `);

        const role = roleQuery.recordset[0];

        if (!role) {
            return res.status(404).json({ error: 'Rol no encontrado' });
        }

        // Obtener las autorizaciones asociadas
        const autorizacionesQuery = await pool.request()
            .input('id_rol', sql.Int, id_rol)
            .query(`
                SELECT a.id_autorizacion, a.descripcion, a.clave
                FROM autorizaciones a
                INNER JOIN autorizacion_rol ar ON a.id_autorizacion = ar.id_autorizacion
                WHERE ar.id_rol = @id_rol
            `);

        const autorizaciones = autorizacionesQuery.recordset;

        res.status(200).json({
            rol: {
                id_rol: role.id_rol,
                nombre_rol: role.nombre_rol,
                global_access: role.global_access,
                autorizaciones,
            },
        });
    } catch (error) {
        console.error('Error al obtener el rol:', error);
        res.status(500).json({ error: 'Error interno al obtener el rol' });
    }
};

const updateRole = async (req, res) => {
    const { id_rol } = req.params;
    const { nombre_rol, global_access, autorizaciones } = req.body;

    if (!id_rol || !nombre_rol || global_access === undefined) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const pool = await getConnection();

    try {
        // Validar que el nuevo nombre del rol no exista en otro registro
        const nombreExistenteQuery = await pool.request()
            .input('nombre_rol', sql.VarChar, nombre_rol)
            .input('id_rol', sql.Int, id_rol)
            .query(`
                SELECT COUNT(*) AS total
                FROM rol
                WHERE nombre_rol = @nombre_rol AND id_rol != @id_rol
            `);

        const nombreExistente = nombreExistenteQuery.recordset[0].total > 0;

        if (nombreExistente) {
            return res.status(400).json({ error: 'El nombre del rol ya está registrado' });
        }

        // Actualizar el nombre y acceso global del rol
        await pool.request()
            .input('id_rol', sql.Int, id_rol)
            .input('nombre_rol', sql.VarChar, nombre_rol)
            .input('global_access', sql.Bit, global_access)
            .query(`
                UPDATE rol
                SET nombre_rol = @nombre_rol, global_access = @global_access
                WHERE id_rol = @id_rol
            `);

        // Actualizar las autorizaciones asociadas si no tiene acceso global
        if (global_access == 0) {
            // Eliminar autorizaciones antiguas
            await pool.request()
                .input('id_rol', sql.Int, id_rol)
                .query('DELETE FROM autorizacion_rol WHERE id_rol = @id_rol');

            // Insertar las nuevas autorizaciones
            for (const id_autorizacion of autorizaciones) {
                await pool.request()
                    .input('id_rol', sql.Int, id_rol)
                    .input('id_autorizacion', sql.Int, id_autorizacion)
                    .query('INSERT INTO autorizacion_rol (id_rol, id_autorizacion) VALUES (@id_rol, @id_autorizacion)');
            }
        }

        res.status(200).json({ message: 'Rol actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar el rol:', error);
        res.status(500).json({ error: 'Error interno al actualizar el rol' });
    }
};



const getAutorizaciones = async (req, res) => {
    try {
        const pool = await getConnection();

        // Consulta para recuperar las descripciones de autorizaciones
        const result = await pool.request().query(`
            SELECT *
            FROM autorizaciones
        `);

        const autorizaciones = result.recordset;

        if (!autorizaciones.length) {
            return res.status(404).json({ message: 'No se encontraron autorizaciones.' });
        }

        res.status(200).json(autorizaciones); // Devuelve las autorizaciones
    } catch (error) {
        console.error('Error al obtener las autorizaciones:', error);
        res.status(500).json({ message: 'Error interno al obtener las autorizaciones.' });
    }
};



module.exports = { getRoles, createRole, getAutorizaciones, getRoleById, updateRole };