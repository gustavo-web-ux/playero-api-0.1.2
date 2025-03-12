const { getConnection, sql } = require('../database/init');

const getPreciosCombustibleSucursal = async (req, res) => {
    const { id_sucursal } = req.params; // Se recibe el id de la sucursal
    let { page = 1, limit = 10 } = req.query; // Se reciben los parámetros de paginación

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;

    const offset = (page - 1) * limit;

    try {
        const pool = await getConnection();

        // Obtener el total de registros
        const totalQuery = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .query(`
                SELECT COUNT(*) AS total
                FROM dbo.precio_combustible_sucursal
                WHERE id_sucursal = @id_sucursal
            `);
        const totalRecords = totalQuery.recordset[0].total;
        const totalPages = Math.ceil(totalRecords / limit);

        // Consultar los precios de combustible con paginación
        const preciosQuery = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .input('limit', sql.Int, limit)
            .input('offset', sql.Int, offset)
            .query(`
                SELECT pcs.id_sucursal, s.descripcion AS sucursal,
                       pcs.id_combustible, c.descripcion AS combustible,
                       pcs.precio
                FROM dbo.precio_combustible_sucursal pcs
                INNER JOIN dbo.sucursal s ON pcs.id_sucursal = s.id_sucursal
                INNER JOIN dbo.combustible c ON pcs.id_combustible = c.id_combustible
                WHERE pcs.id_sucursal = @id_sucursal
                ORDER BY pcs.id_combustible
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `);

        return res.json({
            id_sucursal: id_sucursal,
            page,
            limit,
            totalRecords,
            totalPages,
            precios: preciosQuery.recordset
        });

    } catch (error) {
        console.error('Error al obtener los precios de combustible:', error);
        res.status(500).json({ message: 'Error interno al obtener los precios de combustible.' });
    }
};

const createPrecioCombustible = async (req, res) => {
    const { id_sucursal } = req.params; // id_sucursal en la URL
    const { id_combustible, precio } = req.body; // Datos en el body

    // Validar que los datos requeridos estén presentes
    if (!id_combustible || precio === undefined) {
        return res.status(400).json({ message: "Los campos (id_combustible, precio) son requeridos." });
    }

    try {
        const pool = await getConnection();

        // 1. Validar si el combustible existe
        const combustibleQuery = await pool.request()
            .input('id_combustible', sql.Int, id_combustible)
            .query('SELECT id_combustible FROM dbo.combustible WHERE id_combustible = @id_combustible');

        if (combustibleQuery.recordset.length === 0) {
            return res.status(400).json({ message: "El combustible especificado no existe." });
        }

        // 2. Verificar si ya existe un precio para esta sucursal y este combustible
        const existingQuery = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .input('id_combustible', sql.Int, id_combustible)
            .query(`
          SELECT 1 FROM dbo.precio_combustible_sucursal 
          WHERE id_sucursal = @id_sucursal AND id_combustible = @id_combustible
        `);

        if (existingQuery.recordset.length > 0) {
            return res.status(400).json({ message: "Ya existe un precio para este combustible en esta sucursal. Use la función de actualización." });
        }

        // 3. Insertar un nuevo precio
        await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .input('id_combustible', sql.Int, id_combustible)
            .input('precio', sql.Decimal(10, 2), precio)
            .query(`
          INSERT INTO dbo.precio_combustible_sucursal (id_sucursal, id_combustible, precio)
          VALUES (@id_sucursal, @id_combustible, @precio)
        `);

        return res.status(201).json({ message: "Precio registrado correctamente." });

    } catch (error) {
        console.error('Error al crear el precio de combustible:', error);
        res.status(500).json({ message: "Error interno al registrar el precio de combustible." });
    }
};

const updatePrecioCombustible = async (req, res) => {
    const { id_sucursal, id_combustible } = req.params; // Se reciben en la URL
    const { precio } = req.body; // Nuevo precio

    // Validar que el precio esté presente
    if (precio === undefined) {
        return res.status(400).json({ message: "El campo 'precio' es requerido." });
    }

    try {
        const pool = await getConnection();

        // 1. Verificar si la combinación id_sucursal + id_combustible existe
        const existingQuery = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .input('id_combustible', sql.Int, id_combustible)
            .query(`
          SELECT precio FROM dbo.precio_combustible_sucursal 
          WHERE id_sucursal = @id_sucursal AND id_combustible = @id_combustible
        `);

        if (existingQuery.recordset.length === 0) {
            return res.status(404).json({ message: "No se encontró el registro para actualizar." });
        }

        // 2. Actualizar el precio
        await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .input('id_combustible', sql.Int, id_combustible)
            .input('precio', sql.Decimal(10, 2), precio)
            .query(`
          UPDATE dbo.precio_combustible_sucursal 
          SET precio = @precio 
          WHERE id_sucursal = @id_sucursal AND id_combustible = @id_combustible
        `);

        return res.status(200).json({ message: "Precio actualizado correctamente." });

    } catch (error) {
        console.error('Error al actualizar el precio de combustible:', error);
        res.status(500).json({ message: "Error interno al actualizar el precio de combustible." });
    }
};

const getPreciosClienteSucursal = async (req, res) => {
    const { id_sucursal } = req.params;
    let { page = 1, limit = 10, searchTerm = "" } = req.query; // ✅ Agregar `searchTerm`

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(limit) || limit < 1) limit = 10;

    const offset = (page - 1) * limit;

    try {
        const pool = await getConnection();

        // 🔥 Aplicar filtro solo si `searchTerm` tiene valor
        const searchFilter = searchTerm
            ? `AND (c.descripcion LIKE @searchTerm OR cl.descripcion_cliente LIKE @searchTerm OR pcs.id_ruc LIKE @searchTerm)`
            : "";

        // Obtener el total de registros con filtro
        const totalQuery = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .input('searchTerm', sql.VarChar, `%${searchTerm}%`)
            .query(`
                SELECT COUNT(*) AS total
                FROM dbo.precio_sucursal_cliente pcs
                INNER JOIN dbo.combustible c ON pcs.id_combustible = c.id_combustible
                INNER JOIN dbo.cliente cl ON pcs.id_ruc = cl.ruc
                WHERE pcs.id_sucursal = @id_sucursal
                ${searchFilter}
            `);

        const totalRecords = totalQuery.recordset[0].total;
        const totalPages = Math.max(1, Math.ceil(totalRecords / limit)); // Asegurar al menos 1 página

        // Consultar los precios con filtro y paginación
        const preciosQuery = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .input('searchTerm', sql.VarChar, `%${searchTerm}%`)
            .input('limit', sql.Int, limit)
            .input('offset', sql.Int, offset)
            .query(`
                SELECT pcs.id_sucursal, s.descripcion AS sucursal,
                       pcs.id_combustible, c.descripcion AS combustible,
                       pcs.id_ruc, cl.descripcion_cliente AS cliente,
                       pcs.precio
                FROM dbo.precio_sucursal_cliente pcs
                INNER JOIN dbo.sucursal s ON pcs.id_sucursal = s.id_sucursal
                INNER JOIN dbo.combustible c ON pcs.id_combustible = c.id_combustible
                INNER JOIN dbo.cliente cl ON pcs.id_ruc = cl.ruc
                WHERE pcs.id_sucursal = @id_sucursal
                ${searchFilter} 
                ORDER BY pcs.id_combustible
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `);

        return res.json({
            id_sucursal,
            page,
            limit,
            totalRecords,
            totalPages,
            precios: preciosQuery.recordset
        });

    } catch (error) {
        console.error('❌ Error al obtener los precios de clientes en la sucursal:', error);
        res.status(500).json({ message: 'Error interno al obtener los precios.' });
    }
};

const createPrecioClienteSucursal = async (req, res) => {
    const { id_sucursal } = req.params; // Se recibe en la URL
    const { id_combustible, id_ruc, precio } = req.body; // Datos en el body

    // Validar que los datos requeridos estén presentes
    if (!id_combustible || !id_ruc || precio === undefined) {
        return res.status(400).json({ message: "Los campos (id_combustible, id_ruc, precio) son requeridos." });
    }

    try {
        const pool = await getConnection();

        // 1. Validar si el combustible existe
        const combustibleQuery = await pool.request()
            .input('id_combustible', sql.Int, id_combustible)
            .query('SELECT id_combustible FROM dbo.combustible WHERE id_combustible = @id_combustible');

        if (combustibleQuery.recordset.length === 0) {
            return res.status(400).json({ message: "El combustible especificado no existe." });
        }

        // 2. Validar si el cliente existe
        const clienteQuery = await pool.request()
            .input('id_ruc', sql.VarChar(20), id_ruc)
            .query('SELECT ruc FROM dbo.cliente WHERE ruc = @id_ruc');

        if (clienteQuery.recordset.length === 0) {
            return res.status(400).json({ message: "El cliente especificado no existe." });
        }

        // 3. Verificar si ya existe un precio para este cliente en la sucursal
        const existingQuery = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .input('id_combustible', sql.Int, id_combustible)
            .input('id_ruc', sql.VarChar(20), id_ruc)
            .query(`
          SELECT 1 FROM dbo.precio_sucursal_cliente 
          WHERE id_sucursal = @id_sucursal AND id_combustible = @id_combustible AND id_ruc = @id_ruc
        `);

        if (existingQuery.recordset.length > 0) {
            return res.status(400).json({ message: "Ya existe un precio para este cliente. Use la función de actualización." });
        }

        // 4. Insertar un nuevo precio para el cliente
        await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .input('id_combustible', sql.Int, id_combustible)
            .input('id_ruc', sql.VarChar(20), id_ruc)
            .input('precio', sql.Decimal(10, 2), precio)
            .query(`
          INSERT INTO dbo.precio_sucursal_cliente (id_sucursal, id_combustible, id_ruc, precio)
          VALUES (@id_sucursal, @id_combustible, @id_ruc, @precio)
        `);

        return res.status(201).json({ message: "Precio registrado correctamente." });

    } catch (error) {
        console.error('Error al crear el precio del cliente en la sucursal:', error);
        res.status(500).json({ message: "Error interno al registrar el precio del cliente." });
    }
};

const updatePrecioClienteSucursal = async (req, res) => {
    const { id_sucursal, id_combustible, id_ruc } = req.params; // Se reciben en la URL
    const { precio } = req.body; // Nuevo precio

    // Validar que el precio esté presente
    if (precio === undefined) {
        return res.status(400).json({ message: "El campo 'precio' es requerido." });
    }

    try {
        const pool = await getConnection();

        // 1. Verificar si existe el registro en la base de datos
        const existingQuery = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .input('id_combustible', sql.Int, id_combustible)
            .input('id_ruc', sql.VarChar(20), id_ruc)
            .query(`
          SELECT precio FROM dbo.precio_sucursal_cliente 
          WHERE id_sucursal = @id_sucursal AND id_combustible = @id_combustible AND id_ruc = @id_ruc
        `);

        if (existingQuery.recordset.length === 0) {
            return res.status(404).json({ message: "No se encontró el registro para actualizar." });
        }

        // 2. Actualizar el precio del cliente en la sucursal
        await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .input('id_combustible', sql.Int, id_combustible)
            .input('id_ruc', sql.VarChar(20), id_ruc)
            .input('precio', sql.Decimal(10, 2), precio)
            .query(`
          UPDATE dbo.precio_sucursal_cliente 
          SET precio = @precio 
          WHERE id_sucursal = @id_sucursal AND id_combustible = @id_combustible AND id_ruc = @id_ruc
        `);

        return res.status(200).json({ message: "Precio actualizado correctamente." });

    } catch (error) {
        console.error('Error al actualizar el precio del cliente en la sucursal:', error);
        res.status(500).json({ message: "Error interno al actualizar el precio del cliente." });
    }
};

const getCombustibles = async (req, res) => {
    try {
        const pool = await getConnection(); // Obtiene la conexión a la BD

        // Consulta SQL para obtener todos los combustibles
        const result = await pool.request().query(`
            SELECT id_combustible, descripcion, cod_sistema 
            FROM dbo.combustible
            ORDER BY id_combustible
        `);

        return res.json(result.recordset); // Devuelve los registros en JSON

    } catch (error) {
        console.error("❌ Error al obtener los combustibles:", error);
        res.status(500).json({ message: "Error interno al obtener los combustibles." });
    }
};

const getClientes = async (req, res) => {
    try {
        const pool = await getConnection();
        const { search = "", page = 1, pageSize = 10 } = req.query;
        const offset = (page - 1) * pageSize;

        let whereClause = "";
        if (search) {
            whereClause = `WHERE ruc LIKE @searchRUC OR descripcion_cliente LIKE @searchCliente`;
        }

        const sqlQuery = `
            SELECT ruc, descripcion_cliente 
            FROM dbo.cliente 
            ${whereClause} 
            ORDER BY ruc DESC
            OFFSET @offset ROWS 
            FETCH NEXT @pageSize ROWS ONLY;
        `;

        const result = await pool.request()
            .input("searchRUC", sql.VarChar, `%${search}%`)
            .input("searchCliente", sql.VarChar, `%${search}%`)
            .input("offset", sql.Int, offset)
            .input("pageSize", sql.Int, parseInt(pageSize))
            .query(sqlQuery);

        // Contar el total de registros
        const countQuery = `
            SELECT COUNT(*) AS total FROM dbo.cliente
            ${whereClause};
        `;

        const countResult = await pool.request()
            .input("searchRUC", sql.VarChar, `%${search}%`)
            .input("searchCliente", sql.VarChar, `%${search}%`)
            .query(countQuery);

        const totalRecords = countResult.recordset[0].total;
        const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

        return res.json({
            data: result.recordset,
            pagination: {
                totalRecords,
                totalPages,
                currentPage: parseInt(page),
                pageSize: parseInt(pageSize),
            }
        });

    } catch (error) {
        console.error("❌ Error al obtener los clientes:", error);
        res.status(500).json({ message: "Error interno al obtener los clientes." });
    }
};


module.exports = {
    getPreciosCombustibleSucursal, createPrecioCombustible, updatePrecioCombustible,
    getPreciosClienteSucursal, createPrecioClienteSucursal, updatePrecioClienteSucursal,
    getCombustibles, getClientes
};
