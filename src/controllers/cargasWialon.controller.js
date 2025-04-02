const { getConnection, sql } = require('../database/init');
const fs = require('fs').promises;
const path = require('path');

// Filtrar archivos relevantes en la carpeta
const filterRelevantFiles = (files, imageTypes, ticketData) => {
    return files.filter((file) => {
        const fileIdMatch = file.match(/_(.+)\.jpg$/);
        if (!fileIdMatch) return false;

        const fileId = fileIdMatch[1];
        return imageTypes.some((type) =>
            ticketData[type] &&
            ((Array.isArray(ticketData[type]) && ticketData[type].includes(fileId)) ||
                (typeof ticketData[type] === 'string' && ticketData[type].includes(fileId)) ||
                (typeof ticketData[type] === 'number' && ticketData[type] === parseInt(fileId)))
        );
    });
};

// Procesar archivos relevantes en paralelo
const processFilesInParallel = async (files, folderPath, imageTypes, ticketData) => {
    const imageDecode = {};

    await Promise.all(
        files.map(async (file) => {
            const filePath = path.join(folderPath, file);
            const base64Data = await encodeFileToBase64(filePath);

            const fileIdMatch = file.match(/_(.+)\.jpg$/);
            const fileId = fileIdMatch[1];

            const matchedProperty = imageTypes.find((type) =>
                ticketData[type] &&
                ((Array.isArray(ticketData[type]) && ticketData[type].includes(fileId)) ||
                    (typeof ticketData[type] === 'string' && ticketData[type].includes(fileId)) ||
                    (typeof ticketData[type] === 'number' && ticketData[type] === parseInt(fileId)))
            );

            if (matchedProperty) {
                imageDecode[matchedProperty] = imageDecode[matchedProperty] || [];
                imageDecode[matchedProperty].push(base64Data);
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

        const ticketData = resultData[0];

        // Filtrar archivos relevantes
        const relevantFiles = filterRelevantFiles(files, imageTypes, ticketData);

        // Procesar archivos relevantes en paralelo
        const decodedImages = await processFilesInParallel(
            relevantFiles,
            folderPath,
            imageTypes,
            ticketData
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

const getReporteWialonPlayero = async (req, res) => {
    try {
        const pool = await getConnection();
        const {
            id_equipo,
            fecha_inicio,
            fecha_fin,
            descripcion_ubicacion,
            page = 1,
            limit = 10,
            sortBy,
            sortDirection = 'asc',
        } = req.query;

        const offset = (Number(page) - 1) * Number(limit);

        const request = pool.request();
        let whereClause = "1=1";

        const allowedSortFields = [
            'id_ticket', 'id_equipo', 'Ubicación',
            'fecha_ticket_real', 'fecha_hora_wialon',
            'litros_playero', 'litros_sensor', 'diferencia_litros',
            'porcentaje_valor', 'combus_inicial', 'combus_final'
        ];

        let orderClause = `
            ORDER BY 
                CASE 
                WHEN COALESCE(CONCAT(CONVERT(DATE, CAST(ts.fecha AS VARCHAR(8)), 112), ' ', ts.hora), null) = '' 
                    THEN cw.fecha_hora
                WHEN COALESCE(cw.fecha_hora, null) IS NULL 
                    THEN CONVERT(datetime, (CONCAT(CONVERT(DATE, CAST(ts.fecha AS VARCHAR(8)), 112), ' ', ts.hora)), 121)
                ELSE NULL
                END DESC
        `;

        if (sortBy && allowedSortFields.includes(sortBy)) {
            const direction = sortDirection.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
            orderClause = `ORDER BY ${sortBy} ${direction}`;
        }

        if (id_equipo) {
            whereClause += " AND (ts.id_equipo LIKE '%' + @id_equipo + '%' OR cw.id_equipo LIKE '%' + @id_equipo + '%')";
            request.input("id_equipo", sql.VarChar, id_equipo);
        }

        if (descripcion_ubicacion) {
            whereClause += " AND su.descripcion LIKE '%' + @descripcion_ubicacion + '%'";
            request.input("descripcion_ubicacion", sql.VarChar, descripcion_ubicacion);
        }

        if (fecha_inicio && fecha_fin) {
            whereClause += `
                AND (
                    (CONVERT(DATE, cw.fecha_hora) BETWEEN @fecha_inicio AND @fecha_fin) OR
                    (CONVERT(DATE, CAST(ts.fecha AS VARCHAR(8)), 112) BETWEEN @fecha_inicio AND @fecha_fin)
                )`;
            request.input("fecha_inicio", sql.VarChar, fecha_inicio);
            request.input("fecha_fin", sql.VarChar, fecha_fin);
        }

        // Consulta principal con paginación
        const dataQuery = `
            SELECT *
            FROM (
                SELECT 
                    ROW_NUMBER() OVER (${orderClause}) AS RowNum,
                    CASE 
                        WHEN ts.id_ticket IS NULL THEN 'Sin registro en Playero'
                        ELSE CAST(ts.id_ticket AS VARCHAR)
                    END AS id_ticket,
                    COALESCE(ts.id_equipo, cw.id_equipo) as id_equipo,
                    
                    COALESCE(su.descripcion,'No registrado en el playero') as Ubicación,
                    COALESCE(CONCAT(CONVERT(DATE, CAST(ts.fecha AS VARCHAR(8)), 112), ' ', ts.hora), null) AS fecha_ticket,
                    COALESCE(cw.fecha_hora, null) AS fecha_hora_wialon,
                    COALESCE(ts.litros, 0) as litros_playero,
                    COALESCE(cw.litros_sensor, 0) as litros_sensor,
                    COALESCE(ROUND((cw.litros_sensor - ts.litros), 2), 0) AS diferencia_litros,
                    COALESCE(CONCAT(ROUND(((cw.litros_sensor - ts.litros) / ts.litros) * 100, 2), '%'), '') AS porcentaje,
                    COALESCE(ROUND(((cw.litros_sensor - ts.litros) / ts.litros) * 100, 2), 0) AS porcentaje_valor,
                    CAST(CONVERT(DATETIME, CONCAT(CONVERT(DATE, CAST(ts.fecha AS VARCHAR(8)), 112), ' ', ts.hora), 121) AS DATETIME) AS fecha_ticket_real,
                    COALESCE(cw.nivel_combus_inicial, 0) as combus_inicial,
                    COALESCE(cw.nivel_combus_final, 0) as combus_final
                FROM ticket_surtidor ts
                JOIN sucursal su ON su.id_sucursal = ts.id_suc
                FULL JOIN cargas_wialon_tmp cw ON ts.id_equipo = cw.id_equipo
                    AND CONVERT(DATE, CAST(ts.fecha AS VARCHAR(8)), 112) = CAST(cw.fecha_hora AS DATE)
                    --AND ABS(DATEDIFF(HOUR,
                        --CAST(CONVERT(DATE, CAST(ts.fecha AS VARCHAR(8)), 112) AS DATETIME) 
                        --+ CAST(ts.hora AS DATETIME), 
                        --cw.fecha_hora)) <= 2
                WHERE ${whereClause}
            ) AS paginated
            WHERE RowNum > ${offset} AND RowNum <= ${offset + Number(limit)}
        `;

        const countQuery = `
            SELECT COUNT(*) AS total
            FROM ticket_surtidor ts
            JOIN sucursal su ON su.id_sucursal = ts.id_suc
            FULL JOIN cargas_wialon_tmp cw ON ts.id_equipo = cw.id_equipo
                AND CONVERT(DATE, CAST(ts.fecha AS VARCHAR(8)), 112) = CAST(cw.fecha_hora AS DATE)
                --AND ABS(DATEDIFF(HOUR,
                    --CAST(CONVERT(DATE, CAST(ts.fecha AS VARCHAR(8)), 112) AS DATETIME)
                    --+ CAST(ts.hora AS DATETIME),
                    --cw.fecha_hora)) <= 2
            WHERE ${whereClause}
        `;

        const [dataResult, countResult] = await Promise.all([
            request.query(dataQuery),
            request.query(countQuery)
        ]);

        return res.status(200).json({
            data: dataResult.recordset,
            total: countResult.recordset[0].total,
            page: Number(page),
            limit: Number(limit)
        });

    } catch (error) {
        console.error("❌ Error en getReporteWialonPlayero:", error);
        res.status(500).json({ message: "Error interno al obtener el reporte." });
    }
};

const getPlayeroWialonDetalle = async (req, res) => {
    try {
        const pool = await getConnection();
        const { id_ticket } = req.params; // <-- cambio aqu

        if (!id_ticket) {
            return res.status(400).json({ message: "El parámetro id_ticket es obligatorio." });
        }

        const request = pool.request();
        request.input("id_ticket", sql.VarChar, id_ticket);

        const query = `
            SELECT ts.id_ticket, ts.fecha, ts.hora, ts.id_suc, su.descripcion as sucursal, ts.id_bod, bo.descripcion as deposito,
            (SUBSTRING(CAST(ts.fecha AS varchar(8)), 7, 2) + '-' + 
            SUBSTRING(CAST(ts.fecha AS varchar(8)), 5, 2) + '-' + 
            SUBSTRING(CAST(ts.fecha AS varchar(8)), 1, 4)) AS fecha2,
            pi.descripcion as pico, ts.id_playero, pl.nombre_apellido as playero, ts.ruc_cliente, cli.descripcion_cliente, ts.precio,
            ts.id_operador as id_operador_chofer, op.nombre_apellido as operador_chofer, ts.id_equipo, ve.descripcion_vehiculo as equipo_vehiculo,
            ts.kilometro, FORMAT(ts.horometro, 'N2', 'es-ES') AS horometro, pi.id_combustible, com.descripcion as combustible, ts.litros, ts.observaciones_ticket, ts.ubicacion_carga,
            ts.firma_conductor, ts.foto_observaciones, ts.foto_chapa, ts.foto_taxilitro,ts.inicio_taxilitro,ts.final_taxilitro, ts.foto_taxilitro_fin,ts.foto_horometro, ts.foto_kilometro,
            cw.id_equipo as id_vehiculo, cw.fecha_hora, cw.litros_sensor, cw.localizacion, cw.nivel_combus_final, cw.nivel_combus_inicial, 
            COALESCE(ROUND((cw.litros_sensor - ts.litros), 2), 0) AS diferencia_litros,
            COALESCE(CONCAT(ROUND(((cw.litros_sensor - ts.litros) / ts.litros) * 100, 2), '%'), '') AS porcentaje
            FROM ticket_surtidor ts
                join sys_playero.dbo.persona op on ts.id_operador = op.cedula
                join sys_playero.dbo.persona pl on ts.id_playero = pl.cedula
                join sys_playero.dbo.sucursal su on ts.id_suc= su.id_sucursal
                join sys_playero.dbo.bodega bo on ts.id_bod= bo.id_bod
                join sys_playero.dbo.cliente cli on ts.ruc_cliente= cli.ruc
                join sys_playero.dbo.vehiculo ve on ts.id_equipo= ve.id_vehiculo
                join sys_playero.dbo.pico_surtidor pi on ts.id_pico = pi.id_pico
                join sys_playero.dbo.combustible com on ts.id_com= com.id_combustible
                left JOIN cargas_wialon_tmp cw ON ts.id_equipo = cw.id_equipo
                AND CONVERT(DATE, CAST(ts.fecha AS VARCHAR(8)), 112) = CAST(cw.fecha_hora AS DATE)
                    -- AND ABS(DATEDIFF(HOUR,
                    --     CAST(CONVERT(DATE, CAST(ts.fecha AS VARCHAR(8)), 112) AS DATETIME)
                    --     + CAST(ts.hora AS DATETIME), 
                    --     cw.fecha_hora)) <= 2
            WHERE ts.id_ticket = @id_ticket
              --AND cw.litros_sensor IS NOT NULL
        `;

        const result = await request.query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "No existe cruce de datos entre el Playero y Wialon para el ticket consultado" });
        }

        // Definir tipos de imágenes y la carpeta donde se encuentran
        const folderPath = '/home/administrador/APIS/shared';
        const imageTypes = ['foto_chapa', 'foto_taxilitro', 'foto_horometro', 'foto_observaciones', 'firma_conductor', 'foto_kilometro', 'foto_taxilitro_fin'];

        // Procesar imágenes
        const images = await readAndConvertImages(folderPath, imageTypes, result.recordset);

        // Asociar imágenes procesadas al resultado
        imageTypes.forEach((type) => {
            result.recordset[0][type] = images[type] || [];
        });

        return res.status(200).json({ data: result.recordset[0] });

    } catch (error) {
        console.error("❌ Error en getTicketDetalle:", error);
        res.status(500).json({ message: "Error interno al obtener el detalle del ticket." });
    }
};


module.exports = { getReporteWialonPlayero, getPlayeroWialonDetalle };