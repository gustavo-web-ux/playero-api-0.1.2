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
            INNER JOIN pico_surtidor ps ON ps.id_pico = pc.pico
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
            ps.descripcion as pico,
            pc.ci_encargado,
            pc.nombre_encargado,
            pc.id_mongo,
            s.descripcion AS sucursal,
            s.id_sucursal,
            bo.descripcion AS nombreBodega
        FROM calibracion_pico_cabecera pc
            INNER JOIN pico_surtidor ps ON ps.id_pico = pc.pico
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



module.exports = { getCalibraciones, getCalibracionById }