const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getConnection, sql } = require('../database/init');
 

const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required." });
    }

    try {
        const pool = await getConnection();

        // Consulta el usuario en la base de datos
        const result = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT id, username, password, salt, nombre, apellido FROM dbo.users WHERE username = @username');

        const user = result.recordset[0];

        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        // Recuperar el salt y el hash de la contraseña almacenada
        const { salt, password: storedHash, nombre, apellido } = user;

        // Comparar la contraseña ingresada con el hash almacenado
        const isPasswordValid = await bcrypt.compare(password, storedHash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Credenciales invalidas." });
        }

        // Generar el token JWT
        const token = jwt.sign(
            { userId: user.id, roleId: user.role_id },
            process.env.JWT_SECRET,
            //{ expiresIn: '5m' } // Establecer la expiración a 5 minutos
            { expiresIn: '2h' }
        );

        //const expirationTime = Date.now() + 5 * 60 * 1000; // 5 minutos en milisegundos
        const expirationTime = Date.now() + 2 * 60 * 60 * 1000; // 2 horas

        // Configurar la cookie con el token
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development',
            sameSite: 'Lax',
            path: '/',
            expires: new Date(expirationTime),
        });

        // Enviar la respuesta con nombre, apellido y demás datos
        res.json({
            message: 'Login exitoso.',
            expirationTime,
            userData: {
                nombre: nombre,
                apellido: apellido,
            }
        });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// Validar token
const validateToken = async (req, res) => {
    const token = req.cookies.token; // Leer el token de la cookie

    if (!token) {
        return res.status(403).json({ message: 'Token requerido.' });
    }

    try {
        // Verificar el token con la clave secreta
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Obtener el userId del token decodificado
        const userId = decoded.userId;

        // Consultar el roleId desde la tabla user_roles
        const pool = await getConnection();
        const roleQuery = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT role_id
                FROM dbo.user_roles
                WHERE user_id = @userId
            `);

        if (!roleQuery.recordset.length) {
            return res.status(403).json({ message: 'No se encontró el rol del usuario.' });
        }

        const roleId = roleQuery.recordset[0].role_id;

        // Si el token es válido, devolver los datos del usuario y su rol
        res.json({
            valido: true,
            user: {
                userId: decoded.userId,
                roleId: roleId,  // Incluyendo el roleId en la respuesta
                iat: decoded.iat,
                exp: decoded.exp
            }
        });
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ message: 'Token expirado.' });
        } else if (error instanceof jwt.JsonWebTokenError) {
            return res.status(401).json({ message: 'Token inválido.' });
        } else {
            console.error(error);
            return res.status(500).json({ message: 'Error interno al verificar el token.' });
        }
    }
};


// Cerrar sesión
const logout = (req, res) => {
    // Limpiar la cookie del token
    // res.clearCookie('token', {
    //     httpOnly: true,
    //     secure: process.env.NODE_ENV === 'production',
    //     sameSite: 'strict',
    // });

    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development',  // Permitir cookies en desarrollo también
        sameSite: 'Lax',
        path: '/',           // Elimina la cookie en todo el dominio
    });

    res.json({ message: 'Logout exitoso.' });
};

// Registrar usuario
const register = async (req, res) => {
    let { username, password, role_ids, nombre, apellido, sucursal_ids, isGlobalAccess } = req.body;

    // Limpieza y validación básica
    username = username?.trim();
    nombre = nombre?.trim();
    apellido = apellido?.trim();
    isGlobalAccess = Boolean(isGlobalAccess);

    if (
        !username ||
        !password ||
        !role_ids ||
        !role_ids.length ||
        !nombre ||
        !apellido ||
        (!isGlobalAccess && (!sucursal_ids || !sucursal_ids.length))
    ) {
        return res.status(400).json({
            message: "Username, password, roles, nombre, apellido y sucursales (cuando no es acceso global) son obligatorios.",
        });
    }

    if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]+$/.test(nombre)) {
        return res.status(400).json({ message: "Nombre contiene caracteres inválidos." });
    }
    if (!/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]+$/.test(apellido)) {
        return res.status(400).json({ message: "Apellido contiene caracteres inválidos." });
    }

    try {
        const pool = await getConnection();

        // Validar si el username ya existe
        const existingUser = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT * FROM dbo.users WHERE username = @username');

        if (existingUser.recordset.length > 0) {
            return res.status(400).json({ message: "Username ya registrado." });
        }

        // Validar si los roles son válidos
        for (const role_id of role_ids) {
            const validRole = await pool.request()
                .input('roleId', sql.Int, role_id)
                .query('SELECT * FROM dbo.rol WHERE id_rol = @roleId');

            if (!validRole.recordset.length) {
                return res.status(400).json({ message: `Invalid role: ${role_id}` });
            }
        }

        // Obtener el ID del rol admin
        const adminRole = await pool.request()
            .query("SELECT id_rol FROM dbo.rol WHERE LOWER(nombre_rol) = 'Administrador'");
        const adminRoleId = adminRole.recordset[0]?.id_rol;

        const isAdmin = role_ids.includes(adminRoleId);

        if (isAdmin && !isGlobalAccess) {
            return res.status(400).json({
                message: "El rol Administrador requiere acceso global.",
            });
        }

        if (!isAdmin && isGlobalAccess) {
            return res.status(400).json({
                message: "Solo el rol Administrador puede tener acceso global.",
            });
        }

        // Hash de la contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const transaction = pool.transaction();
        await transaction.begin();

        // Insertar usuario
        const result = await transaction.request()
            .input('username', sql.VarChar, username)
            .input('password', sql.VarChar, hashedPassword)
            .input('nombre', sql.NVarChar, nombre)
            .input('apellido', sql.NVarChar, apellido)
            .input('salt', sql.VarChar, salt)
            .query(`
                INSERT INTO dbo.users (username, password, nombre, apellido, salt) 
                OUTPUT INSERTED.id 
                VALUES (@username, @password, @nombre, @apellido, @salt)
            `);

        if (!result.recordset || !result.recordset[0]?.id) {
            await transaction.rollback();
            return res.status(500).json({ message: "Error creating user." });
        }

        const userId = result.recordset[0].id;

        // Insertar roles
        for (const role_id of role_ids) {
            await transaction.request()
                .input('userId', sql.Int, userId)
                .input('roleId', sql.Int, role_id)
                .query('INSERT INTO dbo.user_roles (user_id, role_id) VALUES (@userId, @roleId)');
        }

        // Insertar permisos si no es acceso global
        if (!isGlobalAccess) {
            for (let i = 0; i < sucursal_ids.length; i++) {
                const sucursalId = sucursal_ids[i];
                const roleId = role_ids[i];

                // Validar si ya existe un permiso
                const existingPermission = await transaction.request()
                    .input('userId', sql.Int, userId)
                    .input('sucursalId', sql.Int, sucursalId)
                    .query(`
                        SELECT * FROM dbo.permisos
                        WHERE id_user = @userId AND id_sucursal = @sucursalId
                    `);

                if (existingPermission.recordset.length > 0) {
                    await transaction.rollback();
                    return res.status(400).json({
                        message: `El usuario ya tiene un rol asignado en la sucursal ${sucursalId}.`,
                    });
                }

                // Insertar permiso
                await transaction.request()
                    .input('userId', sql.Int, userId)
                    .input('sucursalId', sql.Int, sucursalId)
                    .input('roleId', sql.Int, roleId)
                    .input('globalAccess', sql.Bit, 0)
                    .query(`
                        INSERT INTO dbo.permisos (id_user, id_sucursal, id_rol, global_access)
                        VALUES (@userId, @sucursalId, @roleId, @globalAccess)
                    `);
            }
        }

        await transaction.commit();
        res.status(201).json({ message: "Usuario creado con éxito." });
    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};


const getUsers = async (req, res) => {
    const { user_id } = req.params;

    if (!user_id) {
        return res.status(400).json({ message: "User ID is required." });
    }

    try {
        const pool = await getConnection();

        const adminRoleQuery = `
            SELECT id_rol 
            FROM dbo.rol 
            WHERE LOWER(nombre_rol) = 'Administrador'
        `;
        const adminRoleResult = await pool.request().query(adminRoleQuery);
        const adminRoleId = adminRoleResult.recordset[0]?.id_rol;

        // Consultar datos del usuario
        const userQuery = `
            SELECT u.id, u.username, u.nombre, u.apellido
            FROM dbo.users u
            WHERE u.id = @userId
        `;
        const userResult = await pool.request()
            .input('userId', sql.Int, user_id)
            .query(userQuery);

        if (userResult.recordset.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado." });
        }

        const user = userResult.recordset[0];

        // Consultar roles del usuario
        const rolesQuery = `
            SELECT r.id_rol, r.nombre_rol
            FROM dbo.user_roles ur
            JOIN dbo.rol r ON ur.role_id = r.id_rol
            WHERE ur.user_id = @userId
        `;
        const rolesResult = await pool.request()
            .input('userId', sql.Int, user_id)
            .query(rolesQuery);

        const roles = rolesResult.recordset;
        user.roles = roles;

        // Determinar si el usuario es administrador
        const isAdmin = roles.some(role => role.id_rol === adminRoleId);

        if (isAdmin) {
            user.sucursal = [];
            user.globalAccess = true;
        } else {
            const permissionsQuery = `
                SELECT p.id_sucursal, s.descripcion AS sucursalName, p.global_access, p.id_rol
                FROM dbo.permisos p
                JOIN dbo.sucursal s ON p.id_sucursal = s.id_sucursal
                WHERE p.id_user = @userId
            `;
            const permissionsResult = await pool.request()
                .input('userId', sql.Int, user_id)
                .query(permissionsQuery);

            user.sucursal = permissionsResult.recordset.map(permission => ({
                sucursalId: permission.id_sucursal,
                sucursalName: permission.sucursalName,
                globalAccess: permission.global_access,
                roleId: permission.id_rol,
            }));
            user.globalAccess = false;
        }

        res.status(200).json({ user });
    } catch (error) {
        console.error("Error retrieving user data:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};


const getAllUsers = async (req, res) => {
    const { page = 1, pageSize = 10, filtro = '' } = req.query; // Paginación y filtro por defecto

    try {
        const pool = await getConnection();

        // Consulta con paginación y filtro general
        const result = await pool.request()
            .input('offset', sql.Int, (page - 1) * pageSize)
            .input('pageSize', sql.Int, pageSize)
            .input('filtro', sql.VarChar, `%${filtro}%`)
            .query(`
                SELECT
                    us.id,
                    us.username,
                    us.nombre,
                    us.apellido,
                    MAX(CASE 
                        WHEN r.nombre_rol = 'Administrador' THEN r.nombre_rol 
                        ELSE NULL 
                    END) AS user_rol
                FROM dbo.users us
                    LEFT JOIN dbo.user_roles ur ON us.id = ur.user_id
                    LEFT JOIN dbo.rol r ON ur.role_id = r.id_rol
                WHERE username LIKE '%' OR nombre LIKE '%' OR apellido LIKE '%'
                GROUP BY us.id, us.username, us.nombre, us.apellido
                ORDER BY us.id DESC
                OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
            `);

        const totalRecordsResult = await pool.request()
            .input('filtro', sql.VarChar, `%${filtro}%`)
            .query(`
                SELECT COUNT(*) as total 
                FROM dbo.users
                WHERE username LIKE @filtro OR nombre LIKE @filtro OR apellido LIKE @filtro
            `);

        const totalRecords = totalRecordsResult.recordset[0].total;

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "No se encontraron usuarios." });
        }

        return res.json({ users: result.recordset, totalRecords });  // Devolver los usuarios y el total de registros

    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// Ruta para obtener los roles disponibles
const getRoles = async (req, res) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .query('SELECT id_rol, nombre_rol FROM dbo.rol');

        // Verifica si se obtuvieron roles
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: 'No roles found.' });
        }

        // Retorna la lista de roles
        res.status(200).json({ roles: result.recordset });
    } catch (error) {
        console.error("Error fetching roles:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

const updateUser = async (req, res) => {
    let { userId, username, password, role_ids, nombre, apellido, sucursal_ids } = req.body;

    if (!userId) {
        return res.status(400).json({ message: "User ID is required." });
    }

    try {
        const pool = await getConnection();

        const transaction = pool.transaction();
        await transaction.begin();

        // Verificar si el usuario existe
        const existingUser = await transaction.request()
            .input('userId', sql.Int, userId)
            .query('SELECT * FROM dbo.users WHERE id = @userId');

        if (!existingUser.recordset.length) {
            await transaction.rollback();
            return res.status(404).json({ message: "User not found." });
        }

        // Obtener el ID del rol admin
        const adminRoleQuery = `SELECT id_rol FROM dbo.rol WHERE LOWER(nombre_rol) = 'Administrador'`;
        const adminRoleResult = await pool.request().query(adminRoleQuery);
        const adminRoleId = adminRoleResult.recordset[0]?.id_rol;

        // Validar si el usuario es admin en la solicitud actual
        const isAdmin = role_ids && role_ids.includes(adminRoleId);

        // Validaciones de formato para nombre y apellido
        if (nombre && !/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]+$/.test(nombre)) {
            return res.status(400).json({ message: "Nombre contiene caracteres inválidos." });
        }
        if (apellido && !/^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s]+$/.test(apellido)) {
            return res.status(400).json({ message: "Apellido contiene caracteres inválidos." });
        }

        // Validar si el nuevo username ya existe
        if (username) {
            const existingUsername = await transaction.request()
                .input('username', sql.VarChar, username)
                .input('userId', sql.Int, userId)
                .query('SELECT * FROM dbo.users WHERE username = @username AND id != @userId');

            if (existingUsername.recordset.length > 0) {
                await transaction.rollback();
                return res.status(400).json({ message: "Username ya registrado." });
            }
        }

        // Actualizar nombre de usuario, nombre y apellido
        if (username || nombre || apellido) {
            await transaction.request()
                .input('userId', sql.Int, userId)
                .input('username', sql.VarChar, username?.trim() || existingUser.recordset[0].username)
                .input('nombre', sql.NVarChar, nombre?.trim() || existingUser.recordset[0].nombre)
                .input('apellido', sql.NVarChar, apellido?.trim() || existingUser.recordset[0].apellido)
                .input('fecha_modificacion', sql.DateTime, new Date())  // Aquí estamos añadiendo la fecha de modificación
                .query(`
                    UPDATE dbo.users 
                    SET username = @username, nombre = @nombre, apellido = @apellido, fecha_modificacion = @fecha_modificacion
                    WHERE id = @userId
                `);
        }

        // Actualizar contraseña si se proporciona
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            await transaction.request()
                .input('userId', sql.Int, userId)
                .input('password', sql.VarChar, hashedPassword)
                .input('salt', sql.VarChar, salt)
                .query(`
                    UPDATE dbo.users 
                    SET password = @password, salt = @salt
                    WHERE id = @userId
                `);
        }

        // Eliminar todos los roles y permisos previos
        await transaction.request()
            .input('userId', sql.Int, userId)
            .query('DELETE FROM dbo.user_roles WHERE user_id = @userId');

        await transaction.request()
            .input('userId', sql.Int, userId)
            .query('DELETE FROM dbo.permisos WHERE id_user = @userId');

        if (isAdmin) {
            // Asignar solo el rol de admin
            await transaction.request()
                .input('userId', sql.Int, userId)
                .input('roleId', sql.Int, adminRoleId)
                .query('INSERT INTO dbo.user_roles (user_id, role_id) VALUES (@userId, @roleId)');
        } else {
            // Manejar roles y permisos si no es admin
            if (role_ids && role_ids.length > 0) {
                for (const role_id of role_ids) {
                    await transaction.request()
                        .input('userId', sql.Int, userId)
                        .input('roleId', sql.Int, role_id)
                        .query('INSERT INTO dbo.user_roles (user_id, role_id) VALUES (@userId, @roleId)');
                }
            }

            if (sucursal_ids && sucursal_ids.length > 0) {
                for (let i = 0; i < sucursal_ids.length; i++) {
                    const sucursalId = sucursal_ids[i];
                    const roleId = role_ids[i];

                    await transaction.request()
                        .input('userId', sql.Int, userId)
                        .input('sucursalId', sql.Int, sucursalId)
                        .input('roleId', sql.Int, roleId)
                        .input('globalAccess', sql.Bit, 0)
                        .query(`
                            INSERT INTO dbo.permisos (id_user, id_sucursal, id_rol, global_access)
                            VALUES (@userId, @sucursalId, @roleId, @globalAccess)
                        `);
                }
            }
        }

        await transaction.commit();
        res.status(200).json({ message: "User updated successfully." });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};




module.exports = { login, register, validateToken, logout, getAllUsers, getRoles, getUsers, updateUser };
