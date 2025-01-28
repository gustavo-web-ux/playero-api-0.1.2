const { getConnection, sql } = require('../database/init');


const getParams = async (req, res) => {
    try {
        const pool = await getConnection();
        const { fecha, idSuc } = req.body;
        const allResults = [];

        const { recordset: bodResult } = await pool.request()
            .input('idSuc', sql.Int, idSuc)
            .query(`
            SELECT id_bod
            FROM bodega
            WHERE id_sucursal= @idSuc
        `);

        // Validar si la consulta no devuelve resultados
        if (bodResult.length === 0) {
            // Si no se encontraron bodegas, devuelve un error 404 o el mensaje que desees
            return res.status(404).json({ error: 'No se encontraron bodegas asociadas a esta sucursal.' });
        }

        // Iteramos sobre los id_bod obtenidos de la consulta anterior
        for (let i = 0; i < bodResult.length; i++) {
            const idBod = bodResult[i].id_bod; // Obtenemos el id_bod actual

            // Realizamos todas las consultas para el idBod actual
            const { recordset: id_cierre_ant } = await pool.request()
                .input('fecha', sql.Int, fecha)
                .input('idBod', sql.Int, idBod)
                .query(`
                    SELECT TOP 1 id_med 
                    FROM med_inicio_cierre 
                    WHERE fecha = (SELECT MAX(fecha) FROM med_inicio_cierre WHERE tipo = 2 AND fecha < @fecha) 
                    AND tipo = 2 AND id_bod = @idBod
                    ORDER BY id_med DESC
                `);

            const { recordset: id_inicio_act } = await pool.request()
                .input('fecha', sql.Int, fecha)
                .input('idBod', sql.Int, idBod)
                .query(`
                    SELECT id_med 
                    FROM med_inicio_cierre 
                    WHERE fecha = @fecha AND tipo = 1 AND id_bod = @idBod
                `);
            const id_inicio = id_inicio_act.length > 0 ? id_inicio_act[0].id_med : 0;

            const { recordset: id_cierre_act } = await pool.request()
                .input('fecha', sql.Int, fecha)
                .input('idBod', sql.Int, idBod)
                .query(`
                    SELECT MAX(id_med) as id_med 
                    FROM med_inicio_cierre 
                    WHERE fecha = @fecha AND tipo = 2 AND id_bod = @idBod
                `);
            const id_fin = id_cierre_act.length > 0 ? id_cierre_act[0].id_med : 0;

            const id_finant = id_cierre_ant.length > 0 ? id_cierre_ant[0].id_med : id_inicio;

            const [
                capacidadResult,
                sucursalResult,
                cierreAnterior,
                cierreActualResult,
                taxCalibResult,
                //difTaxResult,
                movTaxilitroResult,
                traspasoIngresoResult,
                traspasoSalidaResult,
                cargasResult,
                abastecimientoResult
            ] = await Promise.all([
                pool.request().input('idbod', sql.Int, idBod).query(`
                    SELECT SUM(capacidad_litros) AS capacidad_bodega 
                    FROM bodega b 
                    JOIN tanque t ON t.id_bodega = b.id_bod 
                    WHERE id_bod = @idbod
                `),
                pool.request().input('idbod', sql.Int, idBod).input('fecha', sql.Int, fecha).query(`
                    SELECT s.descripcion AS Sucursal, b.descripcion AS Bodega, @fecha AS Fecha 
                    FROM sucursal s 
                    JOIN bodega b ON s.id_sucursal = b.id_sucursal 
                    WHERE b.id_bod = @idbod
                `),
                pool.request().input('id_finant', sql.Int, id_finant).query(`
                    SELECT m.id_med, m.fecha, m.hora, FORMAT(litros, '0.00') AS litros, SUM(p.taxilitro) as taxilitro
                    FROM med_inicio_cierre m join med_reg_pico p on m.id_med = p.id_med
                    WHERE m.id_med = @id_finant GROUP BY m.id_med, m.fecha, m.hora, m.litros 
                `),
                pool.request().input('id_inicio', sql.Int, id_inicio).input('id_fin', sql.Int, id_fin).query(`                    
                    Select *, (y.taxilitro_fin - x.taxilitro_ini) as mov_taxilitro from (SELECT m.id_med as med_ini, m.fecha, m.hora as hora_ini, FORMAT(litros, '0.00') AS litros_ini, SUM(p.taxilitro) as taxilitro_ini
                    FROM med_inicio_cierre m join med_reg_pico p on m.id_med = p.id_med
                    WHERE m.id_med = @id_inicio
                    GROUP BY m.id_med, m.fecha, m.hora, m.litros) x 
                    join (SELECT m.id_med as med_fin, m.hora as hora_fin, FORMAT(litros, '0.00') AS litros_fin, SUM(p.taxilitro) as taxilitro_fin
                    FROM med_inicio_cierre m join med_reg_pico p on m.id_med = p.id_med
                    WHERE m.id_med = @id_fin
                    GROUP BY m.id_med, m.hora, m.litros) y on 1=1
                `),
                pool.request().input('idbod', sql.Int, idBod).input('fecha', sql.Int, fecha).query(`
                    SELECT SUM(cd.taxilitro_final - cd.taxilitro_inicial) AS tax_calib 
                    FROM calibracion_pico_cabecera cc 
                    JOIN calibracion_pico_detalle cd ON cc.id = cd.cabecera_id 
                    WHERE cc.bodega = @idbod AND cc.fecha_hora = @fecha
                `),
                // pool.request().input('id_fin', sql.Int, id_fin).input('id_inicio', sql.Int, id_inicio).query(`
                //     SELECT (a.tax_ant - b.tax_act) AS dif_taxant_taxact 
                //     FROM (
                //         SELECT SUM(mp.taxilitro) AS tax_ant 
                //         FROM med_inicio_cierre me1 
                //         JOIN med_reg_pico mp ON me1.id_med = @id_fin AND mp.id_med = @id_fin
                //     ) a 
                //     JOIN (
                //         SELECT SUM(mp.taxilitro) AS tax_act 
                //         FROM med_inicio_cierre me1 
                //         JOIN med_reg_pico mp ON me1.id_med = @id_inicio AND mp.id_med = @id_inicio
                //     ) b ON 1=1
                // `),
                pool.request().input('fecha', sql.Int, fecha).input('idbod', sql.Int, idBod).query(`
                    SELECT SUM(m2.tax_final - m1.tax_inicial) AS mov_taxilitro 
                    FROM (
                        SELECT mp.taxilitro AS tax_inicial, mp.id_pico 
                        FROM med_inicio_cierre me 
                        JOIN med_reg_pico mp ON me.id_med = mp.id_med 
                        WHERE me.fecha = @fecha AND tipo = 1 AND me.id_bod = @idbod 
                    ) m1 
                    JOIN (
                        SELECT mp.taxilitro AS tax_final, mp.id_pico AS id_picof 
                        FROM med_inicio_cierre me 
                        JOIN med_reg_pico mp ON me.id_med = mp.id_med 
                        WHERE me.fecha = @fecha AND tipo = 2 AND me.id_bod = @idbod
                    ) m2 ON m1.id_pico = m2.id_picof
                `),
                pool.request().input('idbod', sql.Int, idBod).input('fecha', sql.Int, fecha).query(`
                    SELECT (litros_tanque_final - litros_tanque_inicial) AS litros_segun_tanque 
                    FROM traspaso 
                    WHERE bod_destino = @idbod AND fecha = @fecha
                `),
                pool.request().input('idbod', sql.Int, idBod).input('fecha', sql.Int, fecha).query(`
                    SELECT SUM(taxilitro_final - taxilitro_inicial) AS litros_segun_taxilitro 
                    FROM sys_playero.dbo.traspaso 
                    WHERE bod_origen = @idbod AND fecha = @fecha
                `),
                pool.request().input('idbod', sql.Int, idBod).input('fecha', sql.Int, fecha).query(`
                    SELECT SUM(litros) AS litros_despachados 
                    FROM ticket_surtidor 
                    WHERE id_bod = @idbod AND fecha = @fecha
                `),
                pool.request().input('idbod', sql.Int, idBod).input('fecha', sql.Int, fecha).query(`
                    SELECT re.id_repos, re.hora, (taxilitro_final - taxilitro_inicial) as zeta, re.litros_total_repos as litros 
                    FROM repos_surtidor re WHERE id_bod = @idbod and fecha = @fecha
                `)
            ]);

            //const litrosUltimoCierre = parseFloat(cierreAnterior.recordset[0]?.litros || 0);
            const tax_act = parseFloat(cierreActualResult.recordset[0]?.taxilitro_ini > 0 ? cierreActualResult.recordset[0]?.taxilitro_ini : 0);
            const tax_ant = parseFloat(cierreAnterior.recordset[0]?.taxilitro > 0 ? cierreAnterior.recordset[0]?.taxilitro : 0);
            const dif_tax_ant_act = tax_act - tax_ant;
            const litrosMedicionInicial = parseFloat(cierreActualResult.recordset[0]?.litros_ini.length > 0 ? cierreActualResult.recordset[0]?.litros_ini : 0);
            const abastecimiento = parseFloat(abastecimientoResult.recordset[0]?.litros || 0);
            const salidasTiket = parseFloat(cargasResult.recordset[0]?.litros_despachados > 0 ? cargasResult.recordset[0]?.litros_despachados : 0);
            const traspasoIngreso = parseFloat(traspasoIngresoResult.recordset.length > 0 ? traspasoIngresoResult.recordset[0].litros_segun_tanque : 0);
            const traspasoSalida = parseFloat(traspasoSalidaResult.recordset.length > 0 ? traspasoSalidaResult.recordset[0].litros_segun_taxilitro : 0);
            const totalRestanteCalculado = litrosMedicionInicial + abastecimiento + traspasoIngreso - salidasTiket - traspasoSalida;
            const totalLitrosTanqueCierre = parseFloat(cierreActualResult.recordset[0]?.litros_fin > 0 ? cierreActualResult.recordset[0]?.litros_fin : 0);
            //const salidasTicketTanque = parseFloat(cierreActualResult.recordset[0]?.litros_fin - cierreActualResult.recordset[0]?.litros_ini || 0);
            const taxCalib = parseFloat(taxCalibResult?.recordset[0]?.tax_calib || 0);
            const mov_taxilitro = parseFloat(cierreActualResult.recordset[0]?.mov_taxilitro || 0);
            

            const diferencia_zeta = parseFloat(abastecimientoResult.recordset[0]?.zeta || 0);
            const mov_calculado = salidasTiket + taxCalib + traspasoSalida + diferencia_zeta;
            const diferenciaSegunTanque = parseFloat(totalLitrosTanqueCierre - totalRestanteCalculado);

            // Aquí calculamos las métricas y almacenamos los resultados para el idBod actual
            const result = {
                idBod,
                capacidadBodega: capacidadResult.recordset,
                sucursal: sucursalResult.recordset,
                cierreAnterior: cierreAnterior.recordset,
                cierreActual: cierreActualResult.recordset,
                //salidasTicketTanque: salidasTicketTanque,
                salidasTiket: salidasTiket,
                taxCalibracion: taxCalibResult.recordset,
                diferenciaTax: mov_taxilitro,
                movimientoTaxilitro: movTaxilitroResult.recordset,
                traspasoIngreso: traspasoIngreso,
                traspasoSalida: traspasoSalida,
                cargas: cargasResult.recordset,
                abastecimiento: abastecimiento,
                cierre_segun_tanque: {
                    total_restante_calculado: totalRestanteCalculado,
                    total_litros_tanque_cierre: totalLitrosTanqueCierre,
                    diferenciaSegunTanque: diferenciaSegunTanque
                },
                cierre_segun_taxilitro: {
                    diferencia: dif_tax_ant_act,
                    movimientos: movTaxilitroResult.recordset,
                    litros_salidas: salidasTiket + traspasoSalida,
                    calibraciones: taxCalibResult.recordset > 0 ? taxCalibResult.recordset : 0,
                    diferencia_zeta: diferencia_zeta,
                    total_movimiento_calculado: mov_calculado,
                    diferencia_segun_taxilitro: mov_taxilitro - mov_calculado,
                }
            };

            // Guardamos el resultado para este idBod
            allResults.push(result);
        }

        // Una vez terminado el ciclo, respondemos con todos los resultados
        res.status(200).json(allResults);

    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};


module.exports = {
    getParams,
};
