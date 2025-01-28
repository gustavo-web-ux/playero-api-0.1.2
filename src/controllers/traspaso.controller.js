const { log } = require('console');
const fs = require('fs').promises;
const { getConnection, querys, sql } = require('../database/init');
const path = require('path');

const getTraspasos = async (req, res) => {
  try {
    const pool = await getConnection();

    // Obtener parámetros de consulta
    let { page = 1, limit = 10, filter = '', fechaInicio, fechaFin } = req.query;

    const { id_sucursal } = req.params;
    const sucursalId = parseInt(id_sucursal, 10); // Convertir a número

    // Asegúrate de que los valores sean enteros
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);

    // Validar parámetros
    if (page < 1 || limit < 1 || !sucursalId) {
      return res.status(400).json({ error: 'Parámetros inválidos: page, limit y id_sucursal son obligatorios.' });
    }

    const offset = (page - 1) * limit;

    // Construir filtro dinámico
    let filterCondition = '';
    if (filter.trim() !== '') {
      filterCondition = `
          AND (
              CAST(t.id_traspaso AS VARCHAR) LIKE '%${filter}%' OR
              b1.descripcion LIKE '%${filter}%' OR
              b2.descripcion LIKE '%${filter}%' OR
              CAST(t.litros_pico AS VARCHAR) LIKE '%${filter}%' OR
              (SUBSTRING(CAST(t.fecha AS varchar(8)), 7, 2) + '-' + 
              SUBSTRING(CAST(t.fecha AS varchar(8)), 5, 2) + '-' + 
              SUBSTRING(CAST(t.fecha AS varchar(8)), 1, 4)) LIKE '%${filter}%'
          )
          `;
    }

    // Construir filtro para fechas
    if (fechaInicio && fechaFin) {
      filterCondition += `
          AND t.fecha BETWEEN @fechaInicio AND @fechaFin
      `;
    }

    // Consulta para obtener el total de registros
    const totalQuery = `
      SELECT COUNT(*) AS total 
      FROM traspaso t
      INNER JOIN bodega b1 ON t.bod_origen = b1.id_bod
      INNER JOIN bodega b2 ON t.bod_destino = b2.id_bod
      WHERE b1.id_sucursal = @id_sucursal
      ${filterCondition};
      `;

    const totalResult = await pool
      .request()
      .input('id_sucursal', sql.Int, sucursalId)
      .input('fechaInicio', sql.Int, parseInt(fechaInicio, 10) || 0) // Evitar valores inválidos
      .input('fechaFin', sql.Int, parseInt(fechaFin, 10) || 99999999) // Evitar valores inválidos
      .query(totalQuery);

    const totalRecords = totalResult.recordset[0].total;

    // Consulta para obtener los registros paginados y con el filtro
    const paginatedQuery = `
      SELECT 
          t.id_traspaso,
           (SUBSTRING(CAST(t.fecha AS varchar(8)), 7, 2) + '-' + 
            SUBSTRING(CAST(t.fecha AS varchar(8)), 5, 2) + '-' + 
            SUBSTRING(CAST(t.fecha AS varchar(8)), 1, 4)) AS fecha2,
          t.fecha,
          t.hora,
          t.litros_pico,
          b1.descripcion AS Origen,
          b2.descripcion AS Destino
      FROM traspaso t
      INNER JOIN bodega b1 ON t.bod_origen = b1.id_bod
      INNER JOIN bodega b2 ON t.bod_destino = b2.id_bod
      WHERE b1.id_sucursal = @id_sucursal
      ${filterCondition}
      ORDER BY t.id_traspaso DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
      `;

    const result = await pool
      .request()
      .input('id_sucursal', sql.Int, sucursalId)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit)
      .input('fechaInicio', sql.Int, parseInt(fechaInicio, 10) || 0) // Evitar valores inválidos
      .input('fechaFin', sql.Int, parseInt(fechaFin, 10) || 99999999) // Evitar valores inválidos
      .query(paginatedQuery);

    // Respuesta al cliente
    res.status(200).json({
      data: result.recordset,
      total: totalRecords,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching traspasos with join:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


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
const processFilesInParallel = async (files, folderPath, imageTypes, traspasoData) => {
  const imageDecode = {};

  await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(folderPath, file);
      const base64Data = await encodeFileToBase64(filePath);

      const fileIdMatch = file.match(/_(.+)\.jpg$/);
      const fileId = fileIdMatch[1];

      const matchedProperty = imageTypes.find((type) =>
        traspasoData[type] &&
        ((Array.isArray(traspasoData[type]) && traspasoData[type].includes(fileId)) ||
          (typeof traspasoData[type] === 'string' && traspasoData[type].includes(fileId)) ||
          (typeof traspasoData[type] === 'number' && traspasoData[type] === parseInt(fileId)))
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

    const traspasoData = resultData[0];

    // Filtrar archivos relevantes
    const relevantFiles = filterRelevantFiles(files, imageTypes, traspasoData);

    // Procesar archivos relevantes en paralelo
    const decodedImages = await processFilesInParallel(
      relevantFiles,
      folderPath,
      imageTypes,
      traspasoData
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

const getTraspasoById = async (req, res) => {
  const pool = await getConnection();

  try {
    const id_traspaso = req.params.id_traspaso;

    // Obtener el ticket por ID desde la base de datos
    const result = await pool
      .request()
      .input('id_traspaso', sql.BigInt, id_traspaso)
      .query(querys.getTraspasoById);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    // Definir tipos de imágenes y la carpeta donde se encuentran
    const folderPath = '/home/administrador/APIS/shared';
    const imageTypes = ['foto_obs_final', 'foto_obs_inicial', 'foto_obs_traspaso', 'firma_receptor'];

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

module.exports = { getTraspasos, getTraspasoById };



