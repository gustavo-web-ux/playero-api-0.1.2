const { log } = require('console');
const fs = require('fs').promises;
const { getConnection, querys, sql } = require('../database/init');
const path = require('path');

const getReposSurtidor = async (req, res) => {
    try {
        const pool = await getConnection();

        // Obtener parámetros de consulta
        let { page = 1, limit = 10, filter = '', fechaInicio, fechaFin } = req.query;
        const { id_suc } = req.params;

        // Convertir valores a números enteros
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);
        const sucursalId = parseInt(id_suc, 10);
        //const bodegaId = parseInt(id_bod, 10);

        // Validar parámetros
        if (!sucursalId || page < 1 || limit < 1) {
            return res.status(400).json({ error: 'Parámetros inválidos: id_suc, id_bod, page y limit son obligatorios y deben ser mayores a 0.' });
        }

        const offset = (page - 1) * limit;

        // Construir condición de filtrado
        let filterCondition = '';

        if (filter.trim() !== '') {
            filterCondition += `
          AND (
              CAST(r.id_repos AS VARCHAR) LIKE '%${filter}%' OR
              CAST(r.nro_oc AS VARCHAR) LIKE '%${filter}%' OR
              CAST(r.nro_remision AS VARCHAR) LIKE '%${filter}%' OR
              CAST(r.litros_total_repos AS VARCHAR) LIKE '%${filter}%' OR
              s.descripcion LIKE '%${filter}%' OR
              b.descripcion LIKE '%${filter}%' OR
              (SUBSTRING(CAST(r.fecha AS varchar(8)), 7, 2) + '-' + 
              SUBSTRING(CAST(r.fecha AS varchar(8)), 5, 2) + '-' + 
              SUBSTRING(CAST(r.fecha AS varchar(8)), 1, 4)) LIKE '%${filter}%'
          )
        `;
        }

        // Filtrado por fechas
        if (fechaInicio && fechaFin) {
            filterCondition += ` AND r.fecha BETWEEN @fechaInicio AND @fechaFin `;
        } else if (fechaInicio) {
            filterCondition += ` AND r.fecha = @fechaInicio `;
        }

        // Query para contar total de registros
        const totalQuery = `
            SELECT 
                COUNT(*) AS total, 
                SUM(CAST(r.litros_total_repos AS INT)) AS total_litros
            FROM repos_surtidor r
                INNER JOIN bodega b ON r.id_bod = b.id_bod
                INNER JOIN sucursal s ON r.id_suc = s.id_sucursal
                INNER JOIN persona p ON r.playero = p.cedula
            WHERE r.id_suc = @id_suc 
                --AND r.id_bod = @id_bod
            ${filterCondition};
        `;

        const totalResult = await pool
            .request()
            .input('id_suc', sql.Int, sucursalId)
            //.input('id_bod', sql.Int, bodegaId)
            .input('fechaInicio', sql.VarChar, fechaInicio || null)
            .input('fechaFin', sql.VarChar, fechaFin || null)
            .query(totalQuery);

        const totalRecords = totalResult.recordset[0].total;

        // Query para obtener los datos paginados
        const paginatedQuery = `
        SELECT
            r.id_repos,
            s.descripcion AS sucursal,
            b.descripcion AS bodega,
            r.fecha,
            (SUBSTRING(CAST(r.fecha AS varchar(8)), 7, 2) + '-' + 
            SUBSTRING(CAST(r.fecha AS varchar(8)), 5, 2) + '-' + 
            SUBSTRING(CAST(r.fecha AS varchar(8)), 1, 4)) AS fecha2,
            r.hora,
            r.nro_oc,
            r.nro_remision,
            r.litros_remision,
            r.playero,
            p.nombre_apellido AS playero_nombre, 
            r.foto_rev_docs,
            r.litros_total_repos
        FROM repos_surtidor r
            INNER JOIN bodega b ON r.id_bod = b.id_bod
            INNER JOIN sucursal s ON r.id_suc = s.id_sucursal
            INNER JOIN persona p ON r.playero = p.cedula
        WHERE r.id_suc = @id_suc
            --AND r.id_bod = @id_bod
            ${filterCondition}
                ORDER BY r.id_repos DESC
                OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY;
      `;

        const result = await pool
            .request()
            .input('id_suc', sql.Int, sucursalId)
            //.input('id_bod', sql.Int, bodegaId)
            .input('offset', sql.Int, offset)
            .input('limit', sql.Int, limit)
            .input('fechaInicio', sql.VarChar, fechaInicio || null)
            .input('fechaFin', sql.VarChar, fechaFin || null)
            .query(paginatedQuery);

        // Respuesta al cliente
        res.status(200).json({
            data: result.recordset,
            total: totalRecords,
            page,
            limit,
        });
    } catch (error) {
        console.error("Error al obtener repos_surtidor:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

// Filtrar archivos relevantes en la carpeta
const filterRelevantFiles = (files, imageTypes, abastecimientoData) => {
    return files.filter((file) => {
        const fileIdMatch = file.match(/_(.+)\.jpg$/);
        if (!fileIdMatch) return false;

        const fileId = fileIdMatch[1];
        return imageTypes.some((type) =>
            abastecimientoData[type] &&
            ((Array.isArray(abastecimientoData[type]) && abastecimientoData[type].includes(fileId)) ||
                (typeof abastecimientoData[type] === 'string' && abastecimientoData[type].includes(fileId)) ||
                (typeof abastecimientoData[type] === 'number' && abastecimientoData[type] === parseInt(fileId)))
        );
    });
};

// Procesar archivos relevantes en paralelo
const processFilesInParallel = async (files, folderPath, imageTypes, abastecimientoData) => {
    const imageDecode = {};

    await Promise.all(
        files.map(async (file) => {
            const filePath = path.join(folderPath, file);
            const base64Data = await encodeFileToBase64(filePath);

            const fileIdMatch = file.match(/_(.+)\.jpg$/);
            const fileId = fileIdMatch[1];

            const matchedProperty = imageTypes.find((type) =>
                abastecimientoData[type] &&
                ((Array.isArray(abastecimientoData[type]) && abastecimientoData[type].includes(fileId)) ||
                    (typeof abastecimientoData[type] === 'string' && abastecimientoData[type].includes(fileId)) ||
                    (typeof abastecimientoData[type] === 'number' && abastecimientoData[type] === parseInt(fileId)))
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
            throw new Error("Error: No hay datos en resultData");
        }

        const abastecimientoData = resultData[0];

        // Filtrar archivos relevantes
        const relevantFiles = filterRelevantFiles(files, imageTypes, abastecimientoData);

        // Procesar archivos relevantes en paralelo
        const decodedImages = await processFilesInParallel(relevantFiles, folderPath, imageTypes, abastecimientoData);

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

const getAbastecimientoById = async (req, res) => {
    const pool = await getConnection();

    try {
        const id_repos = req.params.id_repos;

        // Obtener el ticket por ID desde la base de datos
        const result = await pool
            .request()
            .input('id_repos', sql.BigInt, id_repos)
            .query(querys.getAbastecimientoById);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }

        // Definir tipos de imágenes y la carpeta donde se encuentran
        const folderPath = '/home/administrador/APIS/shared';
        const imageTypes = ['foto_rev_docs', 'foto_taxilitro', 'foto_obs_repos'];

        // Procesar imágenes
        const images = await readAndConvertImages(folderPath, imageTypes, result.recordset);

        // Asociar imágenes procesadas al resultado
        imageTypes.forEach((type) => {
            result.recordset[0][type] = images[type] || [];
        });

        res.json(result.recordset);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

module.exports = { getReposSurtidor, getAbastecimientoById };