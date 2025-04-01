const { getConnection, sql } = require('../database/init');

const createBodegas = async (req, res) => {
    try {
        const pool = await getConnection();
        const { bodegas } = req.body;

        if (!bodegas || !Array.isArray(bodegas) || bodegas.length === 0) {
            return res.status(400).json({ message: "Debe enviar al menos una bodega." });
        }

        const insertedBodegas = [];

        for (const bodega of bodegas) {
            const {
                descripcion,
                id_sucursal,
                codigo_bodega,
                otro_centro = null,
                centro = null
            } = bodega;

            // Validación básica
            if (!descripcion || !id_sucursal || isNaN(id_sucursal)) {
                return res.status(400).json({
                    message: "Los campos descripcion e id_sucursal son obligatorios y deben ser válidos.",
                });
            }

            // ✅ Regla de negocio: si otro_centro es 1, centro es obligatorio
            if (otro_centro === 1 && (centro === null || isNaN(centro))) {
                return res.status(400).json({
                    message: "Cuando otro_centro es 1, el campo centro es obligatorio y debe ser un número válido.",
                });
            }

            // ✅ Si otro_centro no es 1, centro debe ser null
            const centroToInsert = otro_centro === 1 ? centro : null;

            // Validar si id_sucursal existe
            const checkSucursal = await pool.request()
                .input('id_sucursal', sql.Int, id_sucursal)
                .query('SELECT * FROM dbo.sucursal WHERE id_sucursal = @id_sucursal');

            if (checkSucursal.recordset.length === 0) {
                return res.status(400).json({
                    message: `El id_sucursal ${id_sucursal} no existe en la tabla sucursal.`,
                });
            }

            // ✅ Insertar
            const insertQuery = await pool.request()
                .input('descripcion', sql.VarChar, descripcion)
                .input('id_sucursal', sql.Int, id_sucursal)
                .input('codigo_bodega', sql.VarChar, codigo_bodega || null)
                .input('otro_centro', sql.Int, otro_centro)
                .input('centro', sql.Int, centroToInsert)
                .query(`
                    INSERT INTO dbo.bodega (descripcion, id_sucursal, codigo_bodega, otro_centro, centro)
                    OUTPUT INSERTED.id_bod
                    VALUES (@descripcion, @id_sucursal, @codigo_bodega, @otro_centro, @centro)
                `);

            if (insertQuery.recordset.length > 0) {
                insertedBodegas.push({
                    id: insertQuery.recordset[0].id_bod,
                    descripcion,
                    id_sucursal,
                    codigo_bodega,
                    otro_centro,
                    centro: centroToInsert,
                });
            }
        }

        return res.status(201).json({
            message: "Bodegas creadas exitosamente.",
            data: insertedBodegas,
        });

    } catch (error) {
        console.error("Error al crear las bodegas:", error);
        res.status(500).json({ message: "Error interno al crear las bodegas." });
    }
};

const getBodegas = async (req, res) => {
    try {
        const pool = await getConnection();
        const { id_sucursal, id_bod } = req.query; // Obtener filtros opcionales

        let query = "SELECT * FROM dbo.bodega";
        let request = pool.request();
        let conditions = [];

        // Agregar condiciones según los filtros enviados
        if (id_sucursal) {
            conditions.push("id_sucursal = @id_sucursal");
            request.input("id_sucursal", sql.Int, id_sucursal);
        }

        if (id_bod) {
            conditions.push("id_bod = @id_bod");
            request.input("id_bod", sql.Int, id_bod);
        }

        // Construir consulta con filtros
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        // Ejecutar consulta
        const result = await request.query(query);

        // Verificar si se encontraron bodegas
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "No se encontraron bodegas con los filtros aplicados." });
        }

        return res.status(200).json({ data: result.recordset });

    } catch (error) {
        console.error("Error al obtener las bodegas:", error);
        res.status(500).json({ message: "Error interno al obtener las bodegas." });
    }
};

const updateBodega = async (req, res) => {
    try {
        const pool = await getConnection();
        const { id_bod } = req.params; // Obtener ID de la bodega desde la URL
        const { descripcion, id_sucursal, codigo_bodega } = req.body; // Datos enviados en el request

        // Verificar que los parámetros obligatorios fueron proporcionados
        if (!id_bod || !id_sucursal) {
            return res.status(400).json({ message: "El ID de la bodega y el ID de la sucursal son obligatorios." });
        }

        // Verificar si la bodega existe y pertenece a la sucursal indicada
        const checkBodega = await pool.request()
            .input("id_bod", sql.Int, id_bod)
            .input("id_sucursal", sql.Int, id_sucursal)
            .query("SELECT * FROM dbo.bodega WHERE id_bod = @id_bod AND id_sucursal = @id_sucursal");

        if (checkBodega.recordset.length === 0) {
            return res.status(404).json({ message: `No se encontró la bodega con ID ${id_bod} en la sucursal ${id_sucursal}.` });
        }

        // Mantener valores anteriores si no se envían en la solicitud
        const newDescripcion = (descripcion !== undefined && descripcion !== "") ? descripcion : checkBodega.recordset[0].descripcion;
        const newCodigoBodega = (codigo_bodega !== undefined && codigo_bodega !== "") ? codigo_bodega : null;

        // Ejecutar la actualización
        const updateQuery = await pool.request()
            .input("id_bod", sql.Int, id_bod)
            .input("descripcion", sql.VarChar, newDescripcion)
            .input("codigo_bodega", sql.VarChar, newCodigoBodega)
            .query(`
          UPDATE dbo.bodega
          SET descripcion = @descripcion,
              codigo_bodega = @codigo_bodega
          WHERE id_bod = @id_bod
        `);

        // Verificar si se actualizó la bodega
        if (updateQuery.rowsAffected[0] > 0) {
            return res.status(200).json({ message: "Bodega actualizada exitosamente." });
        } else {
            return res.status(400).json({ message: "No se realizaron cambios en la bodega." });
        }

    } catch (error) {
        console.error("Error al actualizar la bodega:", error);
        res.status(500).json({ message: "Error interno al actualizar la bodega." });
    }
};

const getBodegasBySucursal = async (req, res) => {
    try {
        const pool = await getConnection();
        const { id_sucursal } = req.params; // ID de la sucursal desde la URL

        // Verificar que el id_sucursal es un número válido
        if (!id_sucursal || isNaN(id_sucursal)) {
            return res.status(400).json({ message: "El id_sucursal debe ser un número válido." });
        }

        // Consultar si la sucursal existe antes de buscar sus bodegas
        const checkSucursal = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .query('SELECT * FROM sucursal WHERE id_sucursal = @id_sucursal');

        if (checkSucursal.recordset.length === 0) {
            return res.status(404).json({ message: `No existe una sucursal con el ID ${id_sucursal}.` });
        }

        // Consulta SQL para obtener las bodegas de la sucursal
        const result = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .query(`
          SELECT 
            b.id_bod,
            b.descripcion AS bodega,
            b.codigo_bodega,
            s.id_sucursal,
            s.descripcion AS nombreSucursal
          FROM bodega b
          INNER JOIN sucursal s ON s.id_sucursal = b.id_sucursal
          WHERE s.id_sucursal = @id_sucursal
        `);

        // Si no hay bodegas en esa sucursal, devolver un mensaje vacío
        if (result.recordset.length === 0) {
            return res.status(200).json({ message: `No hay bodegas registradas en la sucursal con ID ${id_sucursal}.`, data: [] });
        }

        // Responder con los datos obtenidos
        res.status(200).json({ data: result.recordset });

    } catch (error) {
        console.error("Error al obtener bodegas por sucursal:", error);
        res.status(500).json({ message: "Error interno del servidor al obtener las bodegas." });
    }
};

const getPicosByBodega = async (req, res) => {
    try {
        const pool = await getConnection();
        const { id_sucursal } = req.params; // ID de la sucursal desde la URL

        // Verificar que el id_sucursal es un número válido
        if (!id_sucursal || isNaN(id_sucursal)) {
            return res.status(400).json({ message: "El id_sucursal debe ser un número válido." });
        }

        // Validar si la sucursal existe
        const checkSucursal = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .query('SELECT 1 FROM sucursal WHERE id_sucursal = @id_sucursal');

        if (checkSucursal.recordset.length === 0) {
            return res.status(404).json({ message: `No existe una sucursal con el ID ${id_sucursal}.` });
        }

        // Consulta SQL para obtener la cantidad de picos por bodega
        const result = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .query(`
                SELECT 
                    b.id_bod, 
                    COUNT(ps.id_pico) AS cantidad_picos -- Contar la cantidad de picos por bodega
                FROM bodega b
                LEFT JOIN pico_surtidor ps ON ps.id_bod = b.id_bod -- LEFT JOIN para incluir bodegas sin picos
                WHERE b.id_sucursal = @id_sucursal
                GROUP BY b.id_bod
            `);

        // Si no hay bodegas o picos en esa sucursal, devolver un mensaje vacío
        if (result.recordset.length === 0) {
            return res.status(200).json({ message: `No hay picos registrados en las bodegas de la sucursal con ID ${id_sucursal}.`, data: [] });
        }

        // Responder con la cantidad de picos por bodega
        res.status(200).json({ data: result.recordset });

    } catch (error) {
        console.error("Error al obtener cantidad de picos por bodega:", error);
        res.status(500).json({ message: "Error interno del servidor al obtener la cantidad de picos por bodega." });
    }
};

const getTanquesByBodega = async (req, res) => {
    try {
        const pool = await getConnection();
        const { id_sucursal } = req.params; // ID de la sucursal desde la URL

        // Verificar que el id_sucursal es un número válido
        if (!id_sucursal || isNaN(id_sucursal)) {
            return res.status(400).json({ message: "El id_sucursal debe ser un número válido." });
        }

        // Validar si la sucursal existe
        const checkSucursal = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .query('SELECT 1 FROM sucursal WHERE id_sucursal = @id_sucursal');

        if (checkSucursal.recordset.length === 0) {
            return res.status(404).json({ message: `No existe una sucursal con el ID ${id_sucursal}.` });
        }

        // Consulta SQL para obtener la cantidad de picos por bodega
        const result = await pool.request()
            .input('id_sucursal', sql.Int, id_sucursal)
            .query(`
                SELECT
                    b.id_bod,
                    COUNT(t.id_tanque) AS cantidad_tanques
                -- Contar la cantidad de picos por bodega
                FROM bodega b
                    LEFT JOIN tanque t ON t.id_bodega = b.id_bod
                -- LEFT JOIN para incluir bodegas sin picos
                WHERE b.id_sucursal = @id_sucursal
                GROUP BY b.id_bod
            `);

        // Si no hay bodegas o picos en esa sucursal, devolver un mensaje vacío
        if (result.recordset.length === 0) {
            return res.status(200).json({ message: `No hay tanques registrados en las bodegas de la sucursal con ID ${id_sucursal}.`, data: [] });
        }

        // Responder con la cantidad de picos por bodega
        res.status(200).json({ data: result.recordset });

    } catch (error) {
        console.error("Error al obtener cantidad de picos por bodega:", error);
        res.status(500).json({ message: "Error interno del servidor al obtener la cantidad de picos por bodega." });
    }
};

const getListPicosByBodega = async (req, res) => {
    try {
        const pool = await getConnection();
        const { id_bodega } = req.params; // ID de la bodega desde la URL

        // Verificar que el id_bodega es un número válido
        if (!id_bodega || isNaN(id_bodega)) {
            return res.status(400).json({ message: "El id_bodega debe ser un número válido." });
        }

        // Consulta SQL para obtener los datos completos de los picos
        const result = await pool.request()
            .input('id_bodega', sql.Int, id_bodega)
            .query(`
                SELECT 
                    ps.id_pico, 
                    bo.id_bod, 
                    bo.codigo_bodega, 
                    bo.descripcion as nombreBodega,
                    ps.descripcion as pico, 
                    bo.id_sucursal,
                    ps.id_combustible
                FROM dbo.bodega bo
                INNER JOIN pico_surtidor ps ON ps.id_bod = bo.id_bod
                WHERE bo.id_bod = @id_bodega
            `);

        // Segunda consulta: obtener el total de registros
        const totalCountResult = await pool.request()
            .input('id_bodega', sql.Int, id_bodega)
            .query(`
                SELECT COUNT(*) AS total_registros
                FROM dbo.bodega bo
                INNER JOIN pico_surtidor ps ON ps.id_bod = bo.id_bod
                WHERE bo.id_bod = @id_bodega
            `);

        // Si no hay registros, devolver un mensaje vacío
        if (result.recordset.length === 0) {
            return res.status(200).json({ message: `No hay picos registrados para la bodega con ID ${id_bodega}.`, data: [], total_registros: 0 });
        }

        // Agrupar los resultados para evitar duplicados
        const uniqueData = result.recordset.reduce((acc, current) => {
            // Buscar si ya existe un objeto con el mismo id_pico
            const existing = acc.find(item => item.id_pico === current.id_pico);

            if (!existing) {
                // Si no existe, agregar el nuevo pico
                acc.push({
                    id_pico: current.id_pico,
                    id_bod: current.id_bod,
                    id_combustible: current.id_combustible,
                    nombreBodega: current.nombreBodega,
                    pico: [current.pico], // Agrupar las descripciones en un array
                    id_sucursal: current.id_sucursal,
                    codigo_bodega: current.codigo_bodega,
                });
            } else {
                // Si existe, agregar las descripciones y evitar duplicados
                if (!existing.pico.includes(current.pico)) {
                    existing.pico.push(current.pico);
                }
            }

            return acc;
        }, []);

        // Responder con los datos completos de los picos y el total de registros
        res.status(200).json({
            data: uniqueData,
            total_registros: totalCountResult.recordset[0].total_registros
        });

    } catch (error) {
        console.error("Error al obtener los datos de picos por bodega:", error);
        res.status(500).json({ message: "Error interno del servidor al obtener los datos de picos por bodega." });
    }
};

const getListTanquesByBodega = async (req, res) => {
    try {
        const pool = await getConnection();
        const { id_bodega } = req.params; // ID de la bodega desde la URL

        // Verificar que el id_bodega es un número válido
        if (!id_bodega || isNaN(id_bodega)) {
            return res.status(400).json({ message: "El id_bodega debe ser un número válido." });
        }

        // Consulta SQL para obtener los datos completos de los tanques
        const result = await pool.request()
            .input('id_bodega', sql.Int, id_bodega)
            .query(`
                SELECT 
                    bo.id_bod, 
                    bo.descripcion AS descripcion_bodega,
                    bo.id_sucursal, 
                    bo.codigo_bodega, 
                    ta.id_tanque, 
                    ta.descripcion_tanque, 
                    ta.capacidad_litros
                FROM dbo.bodega bo
                INNER JOIN tanque ta ON ta.id_bodega = bo.id_bod
                WHERE bo.id_bod = @id_bodega
            `);

        // Segunda consulta: obtener el total de registros de tanques
        const totalCountResult = await pool.request()
            .input('id_bodega', sql.Int, id_bodega)
            .query(`
                SELECT COUNT(*) AS total_registros
                FROM dbo.bodega bo
                INNER JOIN tanque ta ON ta.id_bodega = bo.id_bod
                WHERE bo.id_bod = @id_bodega
            `);

        // Si no hay registros, devolver un mensaje vacío
        if (result.recordset.length === 0) {
            return res.status(200).json({ message: `No hay tanques registrados para la bodega con ID ${id_bodega}.`, data: [], total_registros: 0 });
        }

        // Agrupar los resultados para evitar duplicados en los tanques
        const uniqueData = result.recordset.reduce((acc, current) => {
            // Buscar si ya existe un objeto con el mismo id_bodega
            const existing = acc.find(item => item.id_bod === current.id_bod);

            if (!existing) {
                // Si no existe, agregar la bodega con sus tanques
                acc.push({
                    id_bod: current.id_bod,
                    descripcion_bodega: current.descripcion_bodega,
                    id_sucursal: current.id_sucursal,
                    codigo_bodega: current.codigo_bodega,
                    tanques: [
                        {
                            id_tanque: current.id_tanque,
                            descripcion_tanque: current.descripcion_tanque,
                            capacidad_litros: current.capacidad_litros
                        }
                    ]
                });
            } else {
                // Si existe, agregar el tanque a la lista de tanques de esa bodega
                existing.tanques.push({
                    id_tanque: current.id_tanque,
                    descripcion_tanque: current.descripcion_tanque,
                    capacidad_litros: current.capacidad_litros
                });
            }

            return acc;
        }, []);

        // Responder con los datos completos de los tanques y el total de registros
        res.status(200).json({
            data: uniqueData,
            total_registros: totalCountResult.recordset[0].total_registros
        });

    } catch (error) {
        console.error("Error al obtener los tanques de la bodega:", error);
        res.status(500).json({ message: "Error interno del servidor al obtener los tanques de la bodega." });
    }
};


module.exports = {
    createBodegas, getBodegasBySucursal, getPicosByBodega, getTanquesByBodega, getBodegas, updateBodega,
    getListPicosByBodega, getListTanquesByBodega
};