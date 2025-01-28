const { getConnection, sql } = require('../database/init');

// Verificar si un usuario tiene un permiso específico
const checkPermission = async (req, res) => {
    const { actionId, sucursalId } = req.body; // Acción y sucursal a validar
    const userId = req.user.userId; // Usuario autenticado, extraído del token

    try {
        const pool = await getConnection();

        // 1. Verificar que el actionId existe en la tabla de autorizaciones
        const actionQuery = await pool.request()
            .input('actionId', sql.Int, actionId)
            .query(`
                SELECT id_autorizacion
                FROM dbo.autorizaciones
                WHERE id_autorizacion = @actionId
            `);

        if (actionQuery.recordset.length === 0) {
            return res.status(400).json({ autorizado: false, message: 'ActionId no válido.' });
        }

        // 2. Verificar que el sucursalId existe en la tabla de sucursales
        const sucursalQuery = await pool.request()
            .input('sucursalId', sql.Int, sucursalId)
            .query(`
                SELECT id_sucursal
                FROM dbo.sucursal
                WHERE id_sucursal = @sucursalId
            `);

        if (sucursalQuery.recordset.length === 0) {
            return res.status(400).json({ autorizado: false, message: 'SucursalId no válido.' });
        }

        // 3. Obtener el rol del usuario y verificar si tiene acceso global
        const roleQuery = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT r.id_rol, r.global_access 
                FROM dbo.rol r
                INNER JOIN dbo.user_roles ur ON r.id_rol = ur.role_id
                WHERE ur.user_id = @userId
            `);

        const userRole = roleQuery.recordset[0];

        if (!userRole) {
            return res.status(403).json({ autorizado: false, message: 'No se encontró el rol del usuario.' });
        }

        // 4. Si el rol tiene acceso global, permitir automáticamente
        if (userRole.global_access) {
            return res.json({ autorizado: true, message: 'Acceso global permitido por rol.' });
        }

        // 5. Verificar permisos específicos (acción y sucursal) para usuarios no admin
        const permissionQuery = await pool.request()
            .input('userId', sql.Int, userId)
            .input('actionId', sql.Int, actionId)
            .input('sucursalId', sql.Int, sucursalId)
            .query(`
                SELECT 1
                FROM dbo.permisos p
                INNER JOIN dbo.autorizacion_rol ar ON p.id_user = @userId
                WHERE p.id_sucursal = @sucursalId AND ar.id_autorizacion = @actionId
            `);

        if (permissionQuery.recordset.length > 0) {
            return res.json({ autorizado: true, message: 'Permiso concedido.' });
        }

        return res.status(403).json({ autorizado: false, message: 'Permiso denegado.' });
    } catch (error) {
        console.error('Error al verificar permisos:', error);
        res.status(500).json({ message: 'Error interno al verificar permisos.' });
    }
};





module.exports = { checkPermission };
