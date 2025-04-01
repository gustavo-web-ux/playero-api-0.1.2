const { getConnection, sql } = require('../database/init');

const getReporteWialonPlayero = async (req, res) => {
    try {
        const pool = await getConnection();
        const {
            id_equipo,
            fecha_inicio,
            fecha_fin,
            page = 1,
            limit = 10,
            sortBy,
            sortDirection = 'asc',
        } = req.query;

        const offset = (Number(page) - 1) * Number(limit);

        const request = pool.request();
        let whereClause = "1=1";

        // const allowedSortFields = [
        //     'id_ticket', 'id_equipo', 'Ubicación', 'fecha', 'fecha_hora',
        //     'litros', 'litros_sensor', 'diferencia_litros', 'porcentaje',
        //     'combus_inicial', 'combus_final'
        // ];

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

// const getPlayeroWialonDetalle = async (req, res) => {
//     try {
//         const pool = await getConnection();
//         const { id_ticket } = req.params; // <-- cambio aqu

//         if (!id_ticket) {
//             return res.status(400).json({ message: "El parámetro id_ticket es obligatorio." });
//         }

//         const request = pool.request();
//         request.input("id_ticket", sql.VarChar, id_ticket);

//         const query = `
//             SELECT ts.*,
//             cw.id_equipo as id_vehiculo, cw.fecha_hora, cw.litros_sensor, cw.localizacion, cw.nivel_combus_final, cw.nivel_combus_inicial
//             FROM ticket_surtidor ts
//             INNER JOIN cargas_wialon_tmp cw ON ts.id_equipo = cw.id_equipo
//                 AND CONVERT(DATE, CAST(ts.fecha AS VARCHAR(8)), 112) = CAST(cw.fecha_hora AS DATE)
//                 AND ABS(DATEDIFF(HOUR,
//                     CAST(CONVERT(DATE, CAST(ts.fecha AS VARCHAR(8)), 112) AS DATETIME)
//                     + CAST(ts.hora AS DATETIME), 
//                     cw.fecha_hora)) <= 2
//             WHERE ts.id_ticket = @id_ticket
//               AND cw.litros_sensor IS NOT NULL
//         `;

//         const result = await request.query(query);

//         if (result.recordset.length === 0) {
//             return res.status(404).json({ message: "No existe cruce de datos entre el Playero y Wialon para el ticket consultado" });
//         }

//         return res.status(200).json({ data: result.recordset[0] });

//     } catch (error) {
//         console.error("❌ Error en getTicketDetalle:", error);
//         res.status(500).json({ message: "Error interno al obtener el detalle del ticket." });
//     }
// };


module.exports = { getReporteWialonPlayero };