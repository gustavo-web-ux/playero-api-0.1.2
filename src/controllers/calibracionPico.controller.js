const { log } = require('console');
const fs = require('fs').promises;
const { getConnection, querys, sql } = require('../database/init');
const path = require('path');

const getCalibraciones = async (req, res) => {
    try {
        const pool = await getConnection();

        // Obtener parámetros de consulta
        let { page = 1, limit = 10, filter = "", fechaInicio, fechaFin } = req.query;
        const { id_sucursal } = req.params;

        const sucursalId = parseInt(id_sucursal, 10);

        // Asegurar que los valores sean enteros
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        // Validar parámetros
        if (page < 1 || limit < 1 || isNaN(sucursalId)) {
            return res.status(400).json({ error: "Parámetros inválidos: page, limit e id_sucursal son obligatorios." });
        }

        const offset = (page - 1) * limit;

        // Construcción de filtro dinámico
        let filterCondition = "";
        if (filter.trim() !== "") {
            filterCondition = `
            AND (
                CAST(pc.id AS VARCHAR) LIKE '%${filter}%' OR
                pc.formCode LIKE '%${filter}%' OR
                CAST(pc.fecha_hora AS VARCHAR) LIKE '%${filter}%' OR
                pc.hora LIKE '%${filter}%' OR
                CONVERT(VARCHAR(5), pc.hora, 108) + ' horas' LIKE '%${filter}%' OR
                CAST(pc.ci_encargado AS VARCHAR) LIKE '%${filter}%' OR
                pc.nombre_encargado LIKE '%${filter}%' OR
                CAST(pc.tipo_operacion AS VARCHAR) LIKE '%${filter}%' OR
                CAST(ISNULL(pc.tipo_operacion, 'Sin especificar') AS VARCHAR) LIKE '%${filter}%' OR
                (SUBSTRING(CAST(pc.fecha_hora AS varchar(8)), 7, 2) + '-' + 
                SUBSTRING(CAST(pc.fecha_hora AS varchar(8)), 5, 2) + '-' + 
                SUBSTRING(CAST(pc.fecha_hora AS varchar(8)), 1, 4)) LIKE '%${filter}%'
            )`;
        }

        // Filtrado por fecha
        if (fechaInicio && fechaFin) {
            filterCondition += ` AND pc.fecha_hora BETWEEN @fechaInicio AND @fechaFin `;
        } else if (fechaInicio) {
            filterCondition += ` AND pc.fecha_hora = @fechaInicio `;
        }

        // Consulta para obtener el total de registros
        const totalQuery = `
        SELECT COUNT(*) AS total 
        FROM calibracion_pico_cabecera pc
            LEFT JOIN pico_surtidor ps ON ps.id_pico = pc.pico
            INNER JOIN bodega bo ON pc.bodega = bo.id_bod
            INNER JOIN sucursal s ON s.id_sucursal = bo.id_sucursal
        WHERE s.id_sucursal = @id_sucursal
        ${filterCondition};
      `;

        const totalResult = await pool
            .request()
            .input("id_sucursal", sql.Int, sucursalId)
            .input("fechaInicio", sql.VarChar, fechaInicio || null)
            .input("fechaFin", sql.VarChar, fechaFin || null)
            .query(totalQuery);

        const totalRecords = totalResult.recordset[0].total;

        // 🛑 Si no hay registros, devolver un mensaje
        if (totalRecords === 0) {
            return res.status(200).json({
                message: `No se encontraron registros de calibraciones para la sucursal ${sucursalId}.`,
                data: [],
                total: 0,
                page,
                limit
            });
        }

        // Consulta para obtener los registros paginados con filtro
        const paginatedQuery = `
        SELECT
            pc.id,
            pc.formCode,
            (SUBSTRING(CAST(pc.fecha_hora AS varchar(8)), 7, 2) + '-' + 
                            SUBSTRING(CAST(pc.fecha_hora AS varchar(8)), 5, 2) + '-' + 
                            SUBSTRING(CAST(pc.fecha_hora AS varchar(8)), 1, 4)) AS fecha2,
            pc.fecha_hora,
            pc.hora,
            
            CONVERT(VARCHAR(5), pc.hora, 108) AS hora2,
            pc.bodega,
            ISNULL(pc.tipo_operacion, 'Sin especificar') AS tipo_operacion,
            pc.obs_gral,
            ISNULL(ps.descripcion, 'Sin especificar') as pico,
            pc.ci_encargado,
            pc.nombre_encargado,
            pc.id_mongo,
            s.descripcion AS sucursal,
            s.id_sucursal,
            bo.descripcion AS nombreBodega
        FROM calibracion_pico_cabecera pc
            LEFT JOIN pico_surtidor ps ON ps.id_pico = pc.pico
            INNER JOIN bodega bo ON pc.bodega = bo.id_bod
            INNER JOIN sucursal s ON s.id_sucursal = bo.id_sucursal
        WHERE s.id_sucursal = @id_sucursal

        ${filterCondition}
        ORDER BY pc.fecha_hora DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
      `;

        const result = await pool
            .request()
            .input("id_sucursal", sql.Int, sucursalId)
            .input("offset", sql.Int, offset)
            .input("limit", sql.Int, limit)
            .input("fechaInicio", sql.VarChar, fechaInicio || null)
            .input("fechaFin", sql.VarChar, fechaFin || null)
            .query(paginatedQuery);

        // Respuesta al cliente
        res.status(200).json({
            data: result.recordset,
            total: totalRecords,
            page,
            limit,
        });
    } catch (error) {
        console.error("❌ Error en getCalibraciones:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

// Filtrar archivos relevantes en la carpeta
const filterRelevantFiles = (files, imageTypes, calibracionData) => {
    return files.filter((file) => {
        const fileIdMatch = file.match(/_(.+)\.jpg$/);
        if (!fileIdMatch) return false;

        const fileId = fileIdMatch[1];
        return imageTypes.some((type) =>
            calibracionData[type] &&
            ((Array.isArray(calibracionData[type]) && calibracionData[type].includes(fileId)) ||
                (typeof calibracionData[type] === 'string' && calibracionData[type].includes(fileId)) ||
                (typeof calibracionData[type] === 'number' && calibracionData[type] === parseInt(fileId)))
        );
    });
};

// Procesar archivos relevantes en paralelo
const processFilesInParallel = async (files, folderPath, imageTypes, calibracionData) => {
    const imageDecode = {};

    await Promise.all(
        files.map(async (file) => {
            const filePath = path.join(folderPath, file);
            const base64Data = await encodeFileToBase64(filePath);

            const fileIdMatch = file.match(/_(.+)\.jpg$/);
            const fileId = fileIdMatch[1];

            const matchedProperty = imageTypes.find((type) =>
                calibracionData[type] &&
                ((Array.isArray(calibracionData[type]) && calibracionData[type].includes(fileId)) ||
                    (typeof calibracionData[type] === 'string' && calibracionData[type].includes(fileId)) ||
                    (typeof calibracionData[type] === 'number' && calibracionData[type] === parseInt(fileId)))
            );

            if (matchedProperty) {
                imageDecode[matchedProperty] = imageDecode[matchedProperty] || [];

                // Evitar duplicados
                if (!imageDecode[matchedProperty].includes(base64Data)) {
                    imageDecode[matchedProperty].push(base64Data);
                }
            }
        })
    );

    return imageDecode;
};

// Función para leer y convertir imágenes a base64
const readAndConvertImages = async (folderPath, imageTypes, resultData) => {
    try {
        // Verificar que la carpeta existe
        await fs.access(folderPath);

        // Obtener la lista de archivos en la carpeta
        const files = await fs.readdir(folderPath);

        if (!resultData || resultData.length === 0) {
            throw new Error('Error: No hay datos en resultData');
        }

        const calibracionData = resultData[0];

        // Filtrar archivos relevantes
        const relevantFiles = filterRelevantFiles(files, imageTypes, calibracionData);

        // Procesar archivos relevantes en paralelo
        const decodedImages = await processFilesInParallel(
            relevantFiles,
            folderPath,
            imageTypes,
            calibracionData
        );

        // Agregar entradas para tipos de imagen faltantes con arrays vacíos
        imageTypes.forEach((type) => {
            if (!decodedImages[type]) {
                decodedImages[type] = [];
            }
        });

        return decodedImages;
    } catch (error) {
        console.error(`Error en readAndConvertImages: ${error.message}`);
        throw error;
    }
};

// Función para codificar un archivo a base64
const encodeFileToBase64 = async (filePath) => {
    try {
        return await fs.readFile(filePath, { encoding: 'base64' });
    } catch (error) {
        console.error(`Error codificando el archivo a base64: ${filePath}`, error.message);
        throw error;
    }
};

const getCalibracionById = async (req, res) => {
    const pool = await getConnection();

    try {
        const cabecera_id = req.params.id; // ID de la calibración

        // Obtener datos de calibración por ID
        const result = await pool
            .request()
            .input("cabecera_id", sql.Int, cabecera_id)
            .query(`
                SELECT
                    cd.*,
                    (SUBSTRING(CAST(cc.fecha_hora AS varchar(8)), 7, 2) + '-' + 
                    SUBSTRING(CAST(cc.fecha_hora AS varchar(8)), 5, 2) + '-' + 
                    SUBSTRING(CAST(cc.fecha_hora AS varchar(8)), 1, 4)) AS fecha2,
                    cc.obs_gral, cc.ci_encargado, cc.nombre_encargado, cc.taxilitro_inicial, cc.taxilitro_final, cc.tipo_operacion, bo.descripcion as nombreBodega,
                    cc.foto_inicial_taxilitro, cc.foto_final_taxilitro, cc.foto_precinto_colocado, cc.foto_precinto_retirado,
                    cc.nro_precinto_retirado, cc.nro_precinto_colocado, cc.firma_calibrador,
                    CONVERT(VARCHAR(5), cc.hora, 108) AS hora2
                from calibracion_pico_detalle cd
                    inner join calibracion_pico_cabecera cc on cc.id = cd.cabecera_id
                    inner join bodega bo on bo.id_bod = cc.bodega
                WHERE cd.cabecera_id = @cabecera_id;
            `);

        // 🛑 Si no encuentra registros
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: `No se encontró calibración con ID ${cabecera_id}` });
        }

        // Definir tipos de imágenes y la carpeta donde se encuentran
        const folderPath = "/home/administrador/APIS/shared"; // 📌 Ruta donde se guardan las imágenes
        const imageTypes = ["foto_inicial_taxilitro", "foto_final_taxilitro", "foto_precinto_retirado",
            "foto_precinto_colocado", "foto_taxilitro_carga", "foto_med_balde", "firma_calibrador", "foto_final_taxilitro",
            "foto_precinto_retirado", "foto_precinto_colocado"];

        // Leer y convertir imágenes a base64 para todos los registros
        for (let record of result.recordset) {
            const images = await readAndConvertImages(folderPath, imageTypes, [record]);

            // Asociar imágenes a cada objeto individualmente
            imageTypes.forEach((type) => {
                record[type] = images[type] || [];
            });
        }

        res.json(result.recordset);
    } catch (error) {
        console.error("❌ Error en getCalibracionById:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

const createPicos = async (req, res) => {
    try {
        const pool = await getConnection();
        const { picos } = req.body; // Recibir un array de picos

        // ✅ Validar que `picos` sea un array y no esté vacío
        if (!picos || !Array.isArray(picos) || picos.length === 0) {
            return res.status(400).json({ message: "Debe enviar al menos un pico." });
        }

        // ✅ Validar que todos los picos pertenezcan a la misma bodega
        const idBodegaUnica = picos[0].id_bod; // Tomamos el id_bod del primer pico
        const bodegasDiferentes = picos.some(pico => pico.id_bod !== idBodegaUnica);

        if (bodegasDiferentes) {
            return res.status(400).json({
                message: "Todos los picos deben pertenecer a la misma bodega en una sola solicitud.",
            });
        }

        // ✅ Validar si el `id_bod` existe en la tabla `bodega`
        const checkBodega = await pool.request()
            .input('id_bod', sql.Int, idBodegaUnica)
            .query('SELECT * FROM dbo.bodega WHERE id_bod = @id_bod');

        if (checkBodega.recordset.length === 0) {
            return res.status(400).json({
                message: `El id_bod ${idBodegaUnica} no existe en la tabla bodega.`,
            });
        }

        const insertedPicos = [];

        for (const pico of picos) {
            const { id_bod, id_combustible, descripcion } = pico;

            // ✅ Validar campos obligatorios
            if (!id_bod || isNaN(id_bod) || !id_combustible || isNaN(id_combustible) || !descripcion) {
                return res.status(400).json({
                    message: "Los campos id_bod, id_combustible y descripcion son obligatorios y deben ser válidos.",
                });
            }

            // ✅ Insertar el pico en la base de datos y obtener el ID generado
            const insertQuery = await pool.request()
                .input('id_bod', sql.Int, id_bod)
                .input('id_combustible', sql.Int, id_combustible)
                .input('descripcion', sql.VarChar, descripcion)
                .query(`
                    INSERT INTO dbo.pico_surtidor (id_bod, id_combustible, descripcion)
                    OUTPUT INSERTED.id_pico
                    VALUES (@id_bod, @id_combustible, @descripcion)
                `);

            if (insertQuery.recordset.length > 0) {
                insertedPicos.push({
                    id_pico: insertQuery.recordset[0].id_pico, // ✅ ID generado
                    id_bod,
                    id_combustible,
                    descripcion,
                });
            }
        }

        return res.status(201).json({
            message: "Picos creados exitosamente.",
            data: insertedPicos, // ✅ Retornar todos los picos insertados
        });

    } catch (error) {
        console.error("Error al crear los picos:", error);
        res.status(500).json({ message: "Error interno al crear los picos." });
    }
};

const getPicos = async (req, res) => {
    try {
        const pool = await getConnection();
        const { id_sucursal, id_bod, id_pico } = req.query; // Filtros opcionales

        let query = `
        SELECT p.id_pico, p.id_bod, p.id_combustible, p.descripcion, 
               b.id_sucursal, b.descripcion AS descripcion_bodega,
               s.descripcion AS descripcion_sucursal
        FROM dbo.pico_surtidor p
        INNER JOIN dbo.bodega b ON p.id_bod = b.id_bod
        INNER JOIN dbo.sucursal s ON b.id_sucursal = s.id_sucursal
      `;

        let request = pool.request();
        let conditions = [];

        // Agregar filtros según lo que se envíe en la solicitud
        if (id_sucursal) {
            conditions.push("b.id_sucursal = @id_sucursal");
            request.input("id_sucursal", sql.Int, id_sucursal);
        }

        if (id_bod) {
            conditions.push("p.id_bod = @id_bod");
            request.input("id_bod", sql.Int, id_bod);
        }

        if (id_pico) {
            conditions.push("p.id_pico = @id_pico");
            request.input("id_pico", sql.Int, id_pico);
        }

        // Construir la consulta con los filtros
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        // Ejecutar la consulta
        const result = await request.query(query);

        // Si no se encontraron resultados, devolver un 404
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "No se encontraron picos con los filtros aplicados." });
        }

        return res.status(200).json({ data: result.recordset });

    } catch (error) {
        console.error("Error al obtener los picos:", error);
        res.status(500).json({ message: "Error interno al obtener los picos." });
    }
};

const updatePico = async (req, res) => {
    try {
        const pool = await getConnection();
        const { id_sucursal, id_bod, id_pico } = req.params; // Obtener IDs de la URL
        const { descripcion, id_combustible } = req.body; // Datos a actualizar

        // Verificar que los parámetros obligatorios fueron proporcionados
        if (!id_sucursal || !id_bod || !id_pico) {
            return res.status(400).json({ message: "Los IDs de sucursal, bodega y pico son obligatorios." });
        }

        // Verificar si el pico existe y pertenece a la bodega y sucursal correctos
        const checkPico = await pool.request()
            .input("id_sucursal", sql.Int, id_sucursal)
            .input("id_bod", sql.Int, id_bod)
            .input("id_pico", sql.Int, id_pico)
            .query(`
          SELECT p.id_pico, p.id_bod, p.id_combustible, p.descripcion, 
                 b.id_sucursal
          FROM dbo.pico_surtidor p
          INNER JOIN dbo.bodega b ON p.id_bod = b.id_bod
          WHERE p.id_pico = @id_pico AND p.id_bod = @id_bod AND b.id_sucursal = @id_sucursal
        `);

        if (checkPico.recordset.length === 0) {
            return res.status(404).json({ message: `No se encontró el pico con ID ${id_pico} en la bodega ${id_bod} y sucursal ${id_sucursal}.` });
        }

        // Mantener valores anteriores si no se envían en la solicitud
        const newDescripcion = (descripcion !== undefined && descripcion !== "") ? descripcion : checkPico.recordset[0].descripcion;
        const newIdCombustible = (id_combustible !== undefined && id_combustible !== "") ? id_combustible : checkPico.recordset[0].id_combustible;

        // Ejecutar la actualización
        const updateQuery = await pool.request()
            .input("id_pico", sql.Int, id_pico)
            .input("descripcion", sql.VarChar, newDescripcion)
            .input("id_combustible", sql.Int, newIdCombustible)
            .query(`
          UPDATE dbo.pico_surtidor
          SET descripcion = @descripcion,
              id_combustible = @id_combustible
          WHERE id_pico = @id_pico
        `);

        // Verificar si se actualizó el pico
        if (updateQuery.rowsAffected[0] > 0) {
            return res.status(200).json({ message: "Pico actualizado exitosamente." });
        } else {
            return res.status(400).json({ message: "No se realizaron cambios en el pico." });
        }

    } catch (error) {
        console.error("Error al actualizar el pico:", error);
        res.status(500).json({ message: "Error interno al actualizar el pico." });
    }
};


module.exports = { getCalibraciones, getCalibracionById, createPicos, getPicos, updatePico }