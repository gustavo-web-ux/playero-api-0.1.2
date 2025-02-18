const { log } = require('console');
const fs = require('fs').promises;
const { getConnection, querys, sql } = require('../database/init');
const path = require('path');

// Filtrar archivos relevantes en la carpeta
const filterRelevantFiles = (files, imageTypes, medicionData) => {
    return files.filter((file) => {
        const fileIdMatch = file.match(/_(.+)\.jpg$/);
        if (!fileIdMatch) return false;

        const fileId = fileIdMatch[1];
        return imageTypes.some((type) =>
            medicionData[type] &&
            ((Array.isArray(medicionData[type]) && medicionData[type].includes(fileId)) ||
                (typeof medicionData[type] === 'string' && medicionData[type].includes(fileId)) ||
                (typeof medicionData[type] === 'number' && medicionData[type] === parseInt(fileId)))
        );
    });
};

const processFilesInParallel = async (files, folderPath, imageTypes, medicionData) => {
    const imageDecode = {};

    await Promise.all(
        files.map(async (file) => {
            try {
                const filePath = path.join(folderPath, file);
                const base64Data = await encodeFileToBase64(filePath);

                // Extraer el número de la imagen desde el nombre del archivo
                const fileIdMatch = file.match(/_(\w+-\w+-\w+-\w+-\w+)\.jpg$/);
                if (!fileIdMatch) return;
                const rowNumber = files.indexOf(file); // Se usa el índice como RowNumber

                // 📌 Asociar imagen correctamente según `RowNumber`
                imageTypes.forEach((type) => {
                    if (!imageDecode[type]) {
                        imageDecode[type] = [];
                    }

                    imageDecode[type][rowNumber] = base64Data; // Se almacena en la posición correcta
                });

                //console.log(`📌 Imagen agregada para RowNumber ${rowNumber}: ${base64Data.substring(0, 30)}...`); // Mostrar parte del base64
            } catch (error) {
                console.error(`❌ Error procesando archivo ${file}:`, error.message);
            }
        })
    );

    return imageDecode;
};

const readAndConvertImages = async (folderPath, imageTypes, resultData, rowIndex = null) => {
    try {
        await fs.access(folderPath);
        const files = await fs.readdir(folderPath);

        if (!resultData || resultData.length === 0) {
            console.warn('⚠️ No hay datos en resultData, devolviendo imágenes vacías.');
            return { foto_tanque: [], foto_taxilitro: [] };
        }

        // Si se especifica un índice, pero es inválido, también devolverá vacío
        if (rowIndex !== null && (rowIndex < 0 || rowIndex >= resultData.length)) {
            console.warn(`⚠️ Índice fuera de rango: ${rowIndex}, devolviendo imágenes vacías.`);
            return { foto_tanque: [], foto_taxilitro: [] };
        }

        const medicionData = rowIndex !== null ? resultData[rowIndex] : resultData[0];

        const relevantFiles = filterRelevantFiles(files, imageTypes, medicionData);
        if (relevantFiles.length === 0) {
            console.warn(`⚠️ No se encontraron archivos relevantes en la carpeta.`);
            return { foto_tanque: [], foto_taxilitro: [] };
        }

        const decodedImages = await processFilesInParallel(relevantFiles, folderPath, imageTypes, medicionData);

        imageTypes.forEach((type) => {
            if (!decodedImages[type]) {
                decodedImages[type] = [];
            }
        });

        return {
            foto_tanque: decodedImages.foto_tanque || [],
            foto_taxilitro: decodedImages.foto_taxilitro || []
        };
    } catch (error) {
        console.error(`❌ Error en readAndConvertImages: ${error.message}`);
        return { foto_tanque: [], foto_taxilitro: [] }; // ⚠️ Ahora devuelve vacío en caso de error
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

const getBodegasBySucursal = async (req, res) => {
    try {
        const { id_sucursal } = req.params;
        const pool = await getConnection();

        if (!id_sucursal) {
            return res.status(400).json({ error: "El parámetro id_sucursal es requerido." });
        }

        // 📌 Consulta SQL
        const query = `SELECT * FROM bodega WHERE id_sucursal = @id_sucursal;`;
        const result = await pool
            .request()
            .input("id_sucursal", sql.Int, id_sucursal)
            .query(query);

        // Si no se encuentran bodegas, devolver un 404
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "No se encontraron bodegas para esta sucursal." });
        }

        // 📌 Responder con las bodegas encontradas
        res.json(result.recordset);
    } catch (error) {
        console.error("❌ Error en getBodegasBySucursal:", error);
        res.status(500).json({ error: "Error interno del servidor." });
    }
};

const getMedicionesBySucursalFecha = async (req, res) => {
    try {
        const { id_suc, fecha, id_bod } = req.params;
        const pool = await getConnection();

        if (!id_suc || !fecha || !id_bod) {
            return res.status(400).json({ error: "Los parámetros id_suc, fecha y id_bod son requeridos." });
        }

        const folderPath = "/home/administrador/APIS/shared";
        const imageTypes = ["foto_taxilitro", "foto_tanque"];

        const queryBodegas = `
            SELECT id_bod, descripcion FROM bodega WHERE id_sucursal = @id_suc AND id_bod = @id_bod;
        `;
        const resultBodegas = await pool
            .request()
            .input("id_suc", sql.Int, id_suc)
            .input("id_bod", sql.Int, id_bod)
            .query(queryBodegas);

        if (resultBodegas.recordset.length === 0) {
            return res.status(404).json({ error: "No se encontraron bodegas para esta sucursal." });
        }

        const { descripcion } = resultBodegas.recordset[0];

        let respuesta = { medicion_inicial: {}, medicion_final: {} };

        const queryInicial = `
            SELECT mi.*, 
                (SUBSTRING(CAST(mi.fecha AS varchar(8)), 7, 2) + '-' + 
                SUBSTRING(CAST(mi.fecha AS varchar(8)), 5, 2) + '-' + 
                SUBSTRING(CAST(mi.fecha AS varchar(8)), 1, 4)) AS Fecha1, 
                s.descripcion as sucursal, b.descripcion as bodega  
            FROM med_inicio_cierre mi 
            INNER JOIN bodega b ON mi.id_bod = b.id_bod
            INNER JOIN sucursal s ON mi.id_suc = s.id_sucursal
            WHERE mi.id_bod = @id_bod AND mi.fecha = @fecha AND mi.tipo = 1;
        `;

        const resultInicial = await pool
            .request()
            .input("id_suc", sql.Int, id_suc)
            .input("id_bod", sql.Int, id_bod)
            .input("fecha", sql.VarChar, fecha)
            .query(queryInicial);

        if (resultInicial.recordset.length > 0) {
            const medicionInicial = resultInicial.recordset[0];
            const id_med_inicial = medicionInicial.id_med;

            const queryTanquesInicial = `
                SELECT mt.*, ta.descripcion_tanque 
                FROM med_reg_tanque mt
                INNER JOIN tanque ta ON mt.id_tanque = ta.id_tanque
                WHERE mt.id_med = @id_med;
            `;

            const resultTanquesInicial = await pool
                .request()
                .input("id_med", sql.Int, id_med_inicial)
                .query(queryTanquesInicial);

            const queryPicosInicial = `
                SELECT mp.*, pc.descripcion as pico, 
                ROW_NUMBER() OVER (ORDER BY mp.id_pico) - 1 AS rowNumber
                FROM med_reg_pico mp
                INNER JOIN pico_surtidor pc ON mp.id_pico = pc.id_pico
                WHERE mp.id_med = @id_med;
            `;
            
            const resultPicosInicial = await pool
                .request()
                .input("id_med", sql.Int, id_med_inicial)
                .query(queryPicosInicial);

            const resultMedicionInicial = {
                picos: resultPicosInicial.recordset,
                tanques: resultTanquesInicial.recordset
            };

            // ✅ Obtener imágenes de tanques
            const decodedImagesTanques = await readAndConvertImages(folderPath, imageTypes, resultMedicionInicial.tanques);

            // ✅ Obtener imágenes de picos dinámicamente
            const decodedImagesPicos = await Promise.all(
                resultMedicionInicial.picos.map(async (pico, index) => {
                    return await readAndConvertImages(folderPath, imageTypes, resultMedicionInicial.picos, index);
                })
            );

            //console.log(decodedImagesPicos);
            
            respuesta.medicion_inicial[`bodega_${id_bod}`] = {
                descripcion,
                datos: {
                    id_med: medicionInicial.id_med,
                    sucursal: medicionInicial.sucursal,
                    bodega: medicionInicial.bodega,
                    fecha: medicionInicial.fecha,
                    fecha1: medicionInicial.Fecha1,
                    hora: medicionInicial.hora,
                    litros: medicionInicial.litros,
                    fotos_observacion: medicionInicial.fotos_observacion,
                    observacion: medicionInicial.observacion
                },
                tanques: resultTanquesInicial.recordset.reduce((acc, t) => {
                    acc[t.descripcion_tanque] = {
                        regla: t.regla,
                        temperatura: t.temperatura,
                        litros: t.litros,
                        foto_tanque: decodedImagesTanques.foto_tanque || []
                    };
                    return acc;
                }, {}),
                picos: resultMedicionInicial.picos.reduce((acc, p, index) => {
                    acc[p.pico] = {
                        taxilitro: p.taxilitro,
                        foto_taxilitro: decodedImagesPicos[index].foto_taxilitro || []
                    };
                    return acc;
                }, {})
            };
            
        }

        const queryFinal = `
            SELECT TOP 1 mi.*, (SUBSTRING(CAST(mi.fecha AS varchar(8)), 7, 2) + '-' + 
            SUBSTRING(CAST(mi.fecha AS varchar(8)), 5, 2) + '-' + 
            SUBSTRING(CAST(mi.fecha AS varchar(8)), 1, 4)) AS Fecha1, s.descripcion as sucursal, b.descripcion as bodega  
            FROM med_inicio_cierre mi 
            INNER JOIN bodega b ON mi.id_bod = b.id_bod
            INNER JOIN sucursal s ON mi.id_suc = s.id_sucursal
            WHERE mi.id_bod = @id_bod AND mi.fecha = @fecha AND mi.tipo = 2
            ORDER BY mi.hora DESC;
        `;

        const resultFinal = await pool
            .request()
            .input("id_suc", sql.Int, id_suc)
            .input("id_bod", sql.Int, id_bod)
            .input("fecha", sql.VarChar, fecha)
            .query(queryFinal);

        if (resultFinal.recordset.length > 0) {
            const medicionFinal = resultFinal.recordset[0];
            const id_med_final = medicionFinal.id_med;

            // Obtener tanques y picos
            const queryTanquesFinal = `
                    SELECT mt.*, ta.descripcion_tanque 
                    FROM med_reg_tanque mt
                    INNER JOIN tanque ta ON mt.id_tanque = ta.id_tanque
                    WHERE mt.id_med = @id_med;
                `;

            const resultTanquesFinal = await pool
                .request()
                .input("id_med", sql.Int, id_med_final)
                .query(queryTanquesFinal);

            const queryPicosFinal = `
                    SELECT mp.*, pc.descripcion as pico, 
                    ROW_NUMBER() OVER (ORDER BY mp.id_pico) - 1 AS rowNumber
                    FROM med_reg_pico mp
                    INNER JOIN pico_surtidor pc ON mp.id_pico = pc.id_pico
                    WHERE mp.id_med = @id_med;
                `;

            const resultPicosFinal = await pool
                .request()
                .input("id_med", sql.Int, id_med_final)
                .query(queryPicosFinal);

            // console.log("🔍 Datos de Picos Final:", resultPicosFinal.recordset);
            // console.log("🔍 Datos de Tanques Final:", resultTanquesFinal.recordset);

            const resultMedicionFinal = {
                picos: resultPicosFinal.recordset.length > 0 ? resultPicosFinal.recordset : [],
                tanques: resultTanquesFinal.recordset.length > 0 ? resultTanquesFinal.recordset : []
            };

            // ✅ Obtener imágenes de tanques
            const decodedImagesTanques = await readAndConvertImages(folderPath, imageTypes, resultMedicionFinal.tanques);

            // ✅ Obtener imágenes de picos dinámicamente si existen
            const decodedImagesPicos = resultMedicionFinal.picos.length > 0
                ? await Promise.all(
                    resultMedicionFinal.picos.map(async (pico, index) => {
                        return await readAndConvertImages(folderPath, imageTypes, resultMedicionFinal.picos, index);
                    })
                )
                : [];

            respuesta.medicion_final[`bodega_${id_bod}`] = {
                descripcion,
                datos: {
                    id_med: medicionFinal.id_med,
                    sucursal: medicionFinal.sucursal,
                    bodega: medicionFinal.bodega,
                    fecha: medicionFinal.fecha,
                    fecha1: medicionFinal.Fecha1,
                    hora: medicionFinal.hora,
                    litros: medicionFinal.litros,
                    observacion: medicionFinal.observacion,
                    fotos_observacion: medicionFinal.fotos_observacion
                },
                tanques: resultTanquesFinal.recordset.length > 0
                    ? resultTanquesFinal.recordset.reduce((acc, t) => {
                        acc[t.descripcion_tanque] = {
                            regla: t.regla,
                            temperatura: t.temperatura,
                            litros: t.litros,
                            foto_tanque: decodedImagesTanques.foto_tanque || []
                        };
                        return acc;
                    }, {})
                    : {},  // 🔹 Si no hay tanques, devuelve objeto vacío
                picos: resultPicosFinal.recordset.length > 0
                    ? resultPicosFinal.recordset.reduce((acc, p, index) => {
                        acc[p.pico] = {
                            taxilitro: p.taxilitro,
                            foto_taxilitro: decodedImagesPicos[index]?.foto_taxilitro || []
                        };
                        return acc;
                    }, {})
                    : {}  // 🔹 Si no hay picos, devuelve objeto vacío
            };
        }

        // 📌 Verificar si no hay registros en medición inicial ni final
        if (Object.keys(respuesta.medicion_inicial).length === 0 && Object.keys(respuesta.medicion_final).length === 0) {
            return res.status(404).json({ error: "No hay mediciones registradas para esta fecha y bodega." });
        }

        // Verificar si solo hay medición inicial, pero no final
        if (Object.keys(respuesta.medicion_inicial).length > 0 && Object.keys(respuesta.medicion_final).length === 0) {
            return res.status(200).json({
                ...respuesta,
                message: "Medición final no registrada."
            });
        }

        // Verificar si solo hay medición final, pero no inicial
        if (Object.keys(respuesta.medicion_inicial).length === 0 && Object.keys(respuesta.medicion_final).length > 0) {
            return res.status(200).json({
                ...respuesta,
                message: "Medición inicial no registrada."
            });
        }

        res.status(200).json(respuesta);
    } catch (error) {
        console.error("❌ Error en getMedicionesBySucursalFecha:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
};

module.exports = { getMedicionesBySucursalFecha, getBodegasBySucursal };