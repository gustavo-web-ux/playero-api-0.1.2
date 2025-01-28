const fs = require('fs').promises;
const path = require('path');
const { getConnection, sql, querys } = require('../database/init');

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

const getTicketById = async (req, res) => {
  const pool = await getConnection();

  try {
    const id_ticket = req.params.id_ticket;

    // Obtener el ticket por ID desde la base de datos
    const result = await pool
      .request()
      .input('id_ticket', sql.BigInt, id_ticket)
      .query(querys.getTicketsId);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
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

    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getTicketById,
};
