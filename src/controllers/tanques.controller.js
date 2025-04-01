const { getConnection, sql } = require('../database/init');

const createTanques = async (req, res) => {
    try {
        const pool = await getConnection();
        const { tanques } = req.body; // Recibir un array de tanques

        // ✅ Validar que `tanques` sea un array y no esté vacío
        if (!tanques || !Array.isArray(tanques) || tanques.length === 0) {
            return res.status(400).json({ message: "Debe enviar al menos un tanque." });
        }

        // ✅ Validar que todos los tanques pertenezcan a la misma bodega
        const idBodegaUnica = tanques[0].id_bodega;
        const bodegasDiferentes = tanques.some(tanque => tanque.id_bodega !== idBodegaUnica);

        if (bodegasDiferentes) {
            return res.status(400).json({
                message: "Todos los tanques deben pertenecer a la misma bodega en una sola solicitud.",
            });
        }

        // ✅ Validar si el `id_bodega` existe en la tabla `bodega`
        const checkBodega = await pool.request()
            .input('id_bodega', sql.Int, idBodegaUnica)
            .query('SELECT * FROM dbo.bodega WHERE id_bod = @id_bodega');

        if (checkBodega.recordset.length === 0) {
            return res.status(400).json({
                message: `El id_bodega ${idBodegaUnica} no existe en la tabla bodega.`,
            });
        }

        const insertedTanques = [];

        for (const tanque of tanques) {
            const { id_bodega, descripcion_tanque, capacidad_litros } = tanque;

            // ✅ Validar campos obligatorios
            if (!id_bodega || isNaN(id_bodega) || !descripcion_tanque || isNaN(capacidad_litros)) {
                return res.status(400).json({
                    message: "Los campos id_bodega, descripcion_tanque y capacidad_litros son obligatorios y deben ser válidos.",
                });
            }

            // ✅ Insertar el tanque en la base de datos y obtener el ID generado
            const insertQuery = await pool.request()
                .input('id_bodega', sql.Int, id_bodega)
                .input('descripcion_tanque', sql.VarChar, descripcion_tanque)
                .input('capacidad_litros', sql.Float, capacidad_litros)
                .query(`
                    INSERT INTO dbo.tanque (id_bodega, descripcion_tanque, capacidad_litros)
                    OUTPUT INSERTED.id_tanque
                    VALUES (@id_bodega, @descripcion_tanque, @capacidad_litros)
                `);

            if (insertQuery.recordset.length > 0) {
                insertedTanques.push({
                    id_tanque: insertQuery.recordset[0].id_tanque, // ✅ ID generado
                    id_bodega,
                    descripcion_tanque,
                    capacidad_litros,
                });
            }
        }

        return res.status(201).json({
            message: "Tanques creados exitosamente.",
            data: insertedTanques, // ✅ Retornar todos los tanques insertados
        });

    } catch (error) {
        console.error("Error al crear los tanques:", error);
        res.status(500).json({ message: "Error interno al crear los tanques." });
    }
};

const getTanques = async (req, res) => {
    try {
        const pool = await getConnection();
        const { id_sucursal, id_bodega, id_tanque } = req.query; // Filtros opcionales

        let query = `
        SELECT t.id_tanque, t.descripcion_tanque, t.capacidad_litros, 
               b.id_bod, b.descripcion AS descripcion_bodega,
               s.id_sucursal, s.descripcion AS descripcion_sucursal
        FROM dbo.tanque t
        INNER JOIN dbo.bodega b ON t.id_bodega = b.id_bod
        INNER JOIN dbo.sucursal s ON b.id_sucursal = s.id_sucursal
      `;

        let request = pool.request();
        let conditions = [];

        // Aplicar filtros según lo que se envíe en la solicitud
        if (id_sucursal) {
            conditions.push("s.id_sucursal = @id_sucursal");
            request.input("id_sucursal", sql.Int, id_sucursal);
        }

        if (id_bodega) {
            conditions.push("t.id_bodega = @id_bodega");
            request.input("id_bodega", sql.Int, id_bodega);
        }

        if (id_tanque) {
            conditions.push("t.id_tanque = @id_tanque");
            request.input("id_tanque", sql.Int, id_tanque);
        }

        // Construir la consulta con los filtros
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        // Ejecutar la consulta
        const result = await request.query(query);

        // Si no se encontraron resultados, devolver un 404
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "No se encontraron tanques con los filtros aplicados." });
        }

        return res.status(200).json({ data: result.recordset });

    } catch (error) {
        console.error("Error al obtener los tanques:", error);
        res.status(500).json({ message: "Error interno al obtener los tanques." });
    }
};

const updateTanque = async (req, res) => {
    try {
        const pool = await getConnection();
        const { id_sucursal, id_bodega, id_tanque } = req.params; // Obtener IDs de la URL
        const { descripcion_tanque, capacidad_litros } = req.body; // Datos a actualizar

        // Verificar que los parámetros obligatorios fueron proporcionados
        if (!id_sucursal || !id_bodega || !id_tanque) {
            return res.status(400).json({ message: "Los IDs de sucursal, bodega y tanque son obligatorios." });
        }

        // Verificar si el tanque existe y pertenece a la bodega y sucursal correctos
        const checkTanque = await pool.request()
            .input("id_sucursal", sql.Int, id_sucursal)
            .input("id_bodega", sql.Int, id_bodega)
            .input("id_tanque", sql.Int, id_tanque)
            .query(`
          SELECT t.id_tanque, t.descripcion_tanque, t.capacidad_litros, 
                 b.id_bod, b.id_sucursal
          FROM dbo.tanque t
          INNER JOIN dbo.bodega b ON t.id_bodega = b.id_bod
          WHERE t.id_tanque = @id_tanque AND t.id_bodega = @id_bodega AND b.id_sucursal = @id_sucursal
        `);

        if (checkTanque.recordset.length === 0) {
            return res.status(404).json({ message: `No se encontró el tanque con ID ${id_tanque} en la bodega ${id_bodega} y sucursal ${id_sucursal}.` });
        }

        // Mantener valores anteriores si no se envían en la solicitud
        const newDescripcionTanque = (descripcion_tanque !== undefined && descripcion_tanque !== "") ? descripcion_tanque : checkTanque.recordset[0].descripcion_tanque;
        const newCapacidadLitros = (capacidad_litros !== undefined && capacidad_litros !== "") ? capacidad_litros : checkTanque.recordset[0].capacidad_litros;

        // Ejecutar la actualización
        const updateQuery = await pool.request()
            .input("id_tanque", sql.Int, id_tanque)
            .input("descripcion_tanque", sql.VarChar, newDescripcionTanque)
            .input("capacidad_litros", sql.Float, newCapacidadLitros)
            .query(`
          UPDATE dbo.tanque
          SET descripcion_tanque = @descripcion_tanque,
              capacidad_litros = @capacidad_litros
          WHERE id_tanque = @id_tanque
        `);

        // Verificar si se actualizó el tanque
        if (updateQuery.rowsAffected[0] > 0) {
            return res.status(200).json({ message: "Tanque actualizado exitosamente." });
        } else {
            return res.status(400).json({ message: "No se realizaron cambios en el tanque." });
        }

    } catch (error) {
        console.error("Error al actualizar el tanque:", error);
        res.status(500).json({ message: "Error interno al actualizar el tanque." });
    }
};


module.exports = { createTanques, getTanques, updateTanque };