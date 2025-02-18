const { getConnection, querys, sql } = require('../database/init');
const { dataOfficeTrack } = require('../utils/apiOfficeTrack/transformData.util');

const queryTickets = async (req, res) => {
  try {
    const pool = await getConnection();
    const idSuc = req.params.id_suc;

    // Obtener los parámetros page, limit, filter, from y to de la consulta (query params)
    let { page = 1, limit = 10, filter = '', from, to } = req.query;

    // Asegúrate de que page y limit sean enteros válidos
    page = parseInt(page);
    limit = parseInt(limit);

    // Validar que los parámetros sean positivos
    if (page < 1 || limit < 1) {
      return res.status(400).json({ error: 'El parámetro page y limit deben ser mayores a 0.' });
    }

    // Validar y convertir las fechas `from` y `to` al formato numérico
    let dateFrom = null;
    let dateTo = null;

    // Si `from` es un número válido, lo asignamos
    if (from && !isNaN(from)) {
      dateFrom = parseInt(from, 10);  // `from` es un número entero con formato YYYYMMDD
    } else if (from) {
      return res.status(400).json({ error: 'La fecha de inicio debe ser un número válido en formato YYYYMMDD.' });
    }

    // Si `to` es un número válido, lo asignamos
    if (to && !isNaN(to)) {
      dateTo = parseInt(to, 10);  // `to` es un número entero con formato YYYYMMDD
    } else if (to) {
      return res.status(400).json({ error: 'La fecha de fin debe ser un número válido en formato YYYYMMDD.' });
    }

    // Si se proporcionan ambas fechas y la fecha de inicio es posterior a la de fin, devolvemos un error
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return res.status(400).json({ error: 'La fecha de inicio no puede ser posterior a la fecha de fin.' });
    }

    // Calcular el OFFSET para la paginación
    const offset = (page - 1) * limit;

    // Construir la condición de filtro
    let filterCondition = '';
    if (filter.trim() !== '') {
      filterCondition = `
        AND (
            com.descripcion LIKE '%${filter}%' OR
            suc.descripcion LIKE '%${filter}%' OR
            pic.descripcion LIKE '%${filter}%' OR
            bod.descripcion LIKE '%${filter}%' OR
            ti.id_ticket LIKE '%${filter}%' OR
            ti.id_equipo LIKE '%${filter}%' OR
            ti.ruc_cliente LIKE '%${filter}%' OR
            (SUBSTRING(CAST(ti.fecha AS varchar(8)), 7, 2) + '-' + 
            SUBSTRING(CAST(ti.fecha AS varchar(8)), 5, 2) + '-' + 
            SUBSTRING(CAST(ti.fecha AS varchar(8)), 1, 4)) LIKE '%${filter}%' OR
            CAST(ti.litros AS varchar) LIKE '%${filter}%'
        )
      `;
    }

    // Agregar la condición de fecha
    let dateCondition = '';
    if (dateFrom && dateTo) {
      dateCondition = `
    AND ti.fecha >= @dateFrom AND ti.fecha <= @dateTo
  `;
    } else if (dateFrom) {
      dateCondition = `
    AND ti.fecha = @dateFrom
  `;
    } else if (dateTo) {
      dateCondition = `
    AND ti.fecha = @dateTo
  `;
    }

    // Obtener el total de registros que coinciden con el filtro
    const totalQuery = `
      SELECT COUNT(*) AS total 
      FROM ticket_surtidor ti
      JOIN combustible com ON ti.id_com = com.id_combustible
      JOIN sucursal suc ON ti.id_suc = suc.id_sucursal
      JOIN pico_surtidor pic ON ti.id_pico = pic.id_pico
      JOIN bodega bod ON ti.id_bod = bod.id_bod
      WHERE ti.id_suc = @id_suc
      ${filterCondition} ${dateCondition}
    `;
    const totalResult = await pool
      .request()
      .input('id_suc', sql.BigInt, idSuc)
      .input('dateFrom', sql.Int, dateFrom)  // Cambié `sql.Date` por `sql.Int`
      .input('dateTo', sql.Int, dateTo)  // Cambié `sql.Date` por `sql.Int`
      .query(totalQuery);

    const totalRecords = totalResult.recordset[0].total;

    // Obtener los registros filtrados y paginados
    const ticketsQuery = querys.getTicketsPage.replace('{{filterCondition}}', filterCondition).replace('{{dateCondition}}', dateCondition);    // Aquí se coloca la condición de fechas

    const result = await pool
      .request()
      .input('id_suc', sql.BigInt, idSuc)
      .input('dateFrom', sql.Int, dateFrom)  // Cambié `sql.Date` por `sql.Int`
      .input('dateTo', sql.Int, dateTo)  // Cambié `sql.Date` por `sql.Int`
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit)
      .query(ticketsQuery);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada' });
    }

    // Devuelve los tickets y el total de registros
    res.status(200).json({ data: result.recordset, total: totalRecords });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


// const queryTickets = async (req, res) => {
//   try {
//     const pool = await getConnection();
//     const idSuc = req.params.id_suc; // Use req.params.id_suc
//     // Obtener los parámetros page y limit de la consulta (query params)
//     // let { page = 1, limit = 10 } = req.query;

//     // // Asegúrate de que page y limit sean enteros válidos
//     // page = parseInt(page);
//     // limit = parseInt(limit);

//     // // Validar que los parámetros sean positivos
//     // if (page < 1 || limit < 1) {
//     //   return res.status(400).json({ error: 'El parámetro page y limit deben ser mayores a 0.' });
//     // }

//     // Calcular el OFFSET para la paginación
//     //const offset = (page - 1) * limit;

//     // Obtener el ticket por ID desde la base de datos
//     const result = await pool
//       .request()
//       .input('id_suc', sql.BigInt, idSuc)
//       // .input('offset', sql.Int, offset)
//       // .input('limit', sql.Int, limit)
//       .query(querys.getTickets);

//     if (result.recordset.length === 0) {
//       return res.status(404).json({ error: 'Sucursal no encontrada' });
//     }

//     res.status(200).json(result.recordset);
//   } catch (error) {
//     console.error('Error fetching data:', error);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// };

const getSurcursal = async ({ res }) => {
  try {
    const data = await (await getConnection()).request().query(querys.getSucursal);
    res.status(200).json(data.recordset);
  } catch (error) {
    res.status(400).json({ msg: error.message });
  }
};

const getAllVehicles = async (req, res) => {
  try {
    const { page = 1, limit = 10, filter = '' } = req.query;

    // Calcular el desplazamiento (offset)
    const offset = (page - 1) * limit;

    const data = await (await getConnection())
      .request()
      .input('filter', sql.VarChar, filter || null)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, parseInt(limit, 10))
      .query(querys.getAllVehiclesPage);

    res.status(200).json(data.recordset);
  } catch (error) {
    res.status(400).json({ msg: error.message });
  }
};



// const getNullVehiclesConfig = async (req, res) => {
//   try {
//     const pool = await getConnection();
//     const idSuc = req.params.id_suc; // Use req.params.id_suc

//     // Obtener el vechiculo por ID desde la base de datos
//     const result = await pool
//       .request()
//       .input('id_sucursal', sql.BigInt, idSuc)
//       .query(querys.getNullConfigVehicle);

//     if (result.recordset.length === 0) {
//       return res.status(404).json({ error: 'Sucursal no encontrada' });
//     }

//     res.status(200).json(result.recordset);
//   } catch (error) {
//     console.error('Error fetching data:', error);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// };

const getNullVehiclesConfig = async (req, res) => {
  try {
    const pool = await getConnection();
    const idSuc = req.params.id_suc; // Use req.params.id_suc

    // Obtener los parámetros de la consulta (query params)
    let { page = 1, limit = 10, filtro = '' } = req.query;

    // Asegúrate de que page y limit sean enteros válidos
    page = parseInt(page);
    limit = parseInt(limit);
    filtro = filtro.trim() === '' ? '%' : `%${filtro}%`;

    // Validar que los parámetros sean positivos
    if (page < 1 || limit < 1) {
      return res.status(400).json({ error: 'El parámetro page y limit deben ser mayores a 0.' });
    }

    // Calcular el OFFSET para la paginación
    const offset = (page - 1) * limit;

    // Obtener el total de registros para la sucursal con filtro
    const totalResult = await pool
      .request()
      .input('id_sucursal', sql.BigInt, idSuc)
      .input('filtro', sql.VarChar, filtro) // Aplicamos el filtro general
      .query(`
        SELECT COUNT(*) AS total
        FROM config_vehiculo c
        INNER JOIN dbo.vehiculo v ON c.id_vehiculo = v.id_vehiculo
        INNER JOIN dbo.cliente cl ON v.ruc = cl.ruc
        WHERE id_sucursal = @id_sucursal
        AND COALESCE(c.centro_costo, '') = '' 
        AND COALESCE(c.indice_pep, '') = '' 
        AND COALESCE(c.unidad_negocio_centro, '') = ''
        AND (
          v.id_vehiculo LIKE @filtro OR
          v.descripcion_vehiculo LIKE @filtro OR
          cl.ruc LIKE @filtro OR
          cl.descripcion_cliente LIKE @filtro
        )
      `);

    const totalRecords = totalResult.recordset[0].total;

    // Obtener los vehículos con la paginación y filtro general
    const result = await pool
      .request()
      .input('id_sucursal', sql.BigInt, idSuc)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit)
      .input('filtro', sql.VarChar, filtro) // Aplicamos el filtro general
      .query(querys.getNullConfigVehiclePage);  // Utiliza la consulta que ya tienes definida

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'No se encontraron registros' });
    }

    res.status(200).json({
      data: result.recordset,
      total: totalRecords,  // Devuelves el total de registros
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


// const getAllVehiclesId = async (req, res) => {
//   try {
//     const pool = await getConnection();
//     const idSuc = req.params.id_suc; // Use req.params.id_suc

//     // Obtener el vechiculo por ID desde la base de datos
//     const result = await pool
//       .request()
//       .input('id_sucursal', sql.BigInt, idSuc)
//       .query(querys.getConfigVehicle);

//     if (result.recordset.length === 0) {
//       return res.status(404).json({ error: 'Sucursal no encontrada' });
//     }

//     res.status(200).json(result.recordset);
//   } catch (error) {
//     console.error('Error fetching data:', error);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// };

const getAllVehiclesId = async (req, res) => {
  try {
    const pool = await getConnection();
    const idSuc = req.params.id_suc;

    let { page = 1, limit = 10, filter = '' } = req.query;

    // Validar y sanitizar los parámetros
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    filter = filter.trim() === '' ? '%' : `%${filter}%`;

    if (page < 1 || limit < 1) {
      return res.status(400).json({ error: 'Los parámetros page y limit deben ser mayores a 0.' });
    }

    const offset = (page - 1) * limit;

    // Consulta para obtener el total de registros con el filtro aplicado
    // Consulta para obtener el total de registros con el filtro aplicado
    const totalQuery = await pool
      .request()
      .input('id_sucursal', sql.BigInt, idSuc)
      .input('filter', sql.VarChar, filter) // Aplicar filtro general
      .query(`
     SELECT COUNT(*) AS total
     FROM config_vehiculo c
     INNER JOIN dbo.vehiculo v ON c.id_vehiculo = v.id_vehiculo
     INNER JOIN dbo.cliente cl ON v.ruc = cl.ruc
     WHERE c.id_sucursal = @id_sucursal
       AND (
          (c.centro_costo IS NOT NULL AND c.centro_costo != '')
          OR (c.indice_pep IS NOT NULL AND c.indice_pep != '')
          OR (c.unidad_negocio_centro IS NOT NULL AND c.unidad_negocio_centro != '')
        )
       AND (
         c.id_vehiculo LIKE @filter OR
         v.descripcion_vehiculo LIKE @filter OR
         c.centro_costo LIKE @filter OR
         c.unidad_negocio_centro LIKE @filter OR
         c.indice_pep LIKE @filter OR
         cl.descripcion_cliente LIKE @filter OR
         cl.ruc LIKE @filter
       )
   `);

    const totalRecords = totalQuery.recordset[0]?.total || 0; // Total de registros filtrados

    // Consulta para obtener los datos con paginación y filtro
    const dataQuery = await pool
      .request()
      .input('id_sucursal', sql.BigInt, idSuc)
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, limit)
      .input('filter', sql.VarChar, filter) // Aplicar filtro general
      .query(querys.getConfigVehiclePage);

    const data = dataQuery.recordset;

    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'No se encontraron registros para la sucursal.' });
    }

    const totalPages = Math.ceil(totalRecords / limit);


    // Respuesta con datos y metainformación
    return res.status(200).json({
      data,
      totalRecords,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error('Error al obtener los vehículos:', error);
    res.status(500).json({ message: 'Error interno al obtener los vehículos.' });
  }
};



const editVehicles = async (req, res) => {
  try {
    const pool = await getConnection();
    const idVehiculo = req.params.id_vehiculo; // Recoger id_vehiculo desde params
    const idSucursal = req.params.id_sucursal; // Nuevo: recoger id_sucursal desde params

    // Validar que idVehiculo y idSucursal existan
    if (!idVehiculo || !idSucursal) {
      return res.status(400).json({ error: 'id_vehiculo y id_sucursal son requeridos' });
    }

    // Obtener el vehículo por ID y sucursal desde la base de datos
    const result = await pool
      .request()
      .input('id_vehiculo', sql.VarChar, idVehiculo)
      .input('id_sucursal', sql.Int, idSucursal) // Nuevo parámetro id_sucursal
      .query(querys.editVehicles);

    // Verificar si se encontraron resultados
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    // Responder con los datos encontrados
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


const addConfigVehicle = async (req, res) => {
  try {
    const pool = await getConnection();
    const idVehiculo = req.params.id_vehiculo; // Obtener el ID del vehículo de los parámetros de la solicitud
    const idSucursal = req.params.id_sucursal; // Obtener el ID de la sucursal de los parámetros de la solicitud
    const { unidad_negocio_centro, centro_costo, indice_pep, de_tercero, otro_ruc, ruc_imputacion } = req.body; // Obtener los nuevos datos del vehículo del cuerpo de la solicitud

    console.log(idVehiculo, idSucursal); // Verificación de los parámetros

    // Actualizar los datos del vehículo en la base de datos, considerando id_vehiculo y id_sucursal
    const result = await pool
      .request()
      .input('id_vehiculo', sql.VarChar, idVehiculo)
      .input('id_sucursal', sql.Int, Number(idSucursal)) // Añadir id_sucursal
      .input('unidad_negocio_centro', sql.VarChar, unidad_negocio_centro)
      .input('centro_costo', sql.VarChar, centro_costo)
      .input('indice_pep', sql.VarChar, indice_pep)
      .input('de_tercero', sql.Int, Number(de_tercero) || 0)
      .input('otro_ruc', sql.Int, Number(otro_ruc) || 0)
      .input('ruc_imputacion', sql.VarChar, ruc_imputacion || '0')
      .query(`
        UPDATE dbo.config_vehiculo 
        SET 
          unidad_negocio_centro = @unidad_negocio_centro, 
          centro_costo = @centro_costo, 
          indice_pep = @indice_pep, 
          de_tercero = @de_tercero, 
          otro_ruc = @otro_ruc, 
          ruc_imputacion = @ruc_imputacion
        WHERE 
          id_vehiculo = @id_vehiculo
          AND id_sucursal = @id_sucursal
      `);

    // Verificar si la actualización fue exitosa
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado o sucursal incorrecta' });
    }

    // Respuesta de éxito
    res.status(200).json({ message: 'Vehículo actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando datos del vehículo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


const createVehicle = async (req, res) => {
  try {
    const pool = await getConnection();
    const { id_vehiculo, descripcion_vehiculo, ruc } = req.body;
    const poi = 'EQ PARTE DIARIO';
    const name = id_vehiculo + '-' + descripcion_vehiculo;
    const customernumber = id_vehiculo;

    // Verificar si el vehículo ya existe
    const existingVehicle = await pool
      .request()
      .input('id_vehiculo', sql.VarChar, id_vehiculo)
      .query('SELECT * FROM dbo.vehiculo WHERE id_vehiculo = @id_vehiculo');

    if (existingVehicle.recordset.length > 0) {
      return res.status(400).json({ error: 'El vehículo ya existe' });
    }

    // Insertar el nuevo vehículo
    const result = await pool
      .request()
      .input('id_vehiculo', sql.VarChar, id_vehiculo)
      .input('descripcion_vehiculo', sql.VarChar, descripcion_vehiculo)
      .input('ruc', sql.VarChar, ruc)
      .query('INSERT INTO dbo.vehiculo (id_vehiculo, descripcion_vehiculo, ruc) VALUES (@id_vehiculo, @descripcion_vehiculo, @ruc)');

    if (result.rowsAffected[0] === 0) {
      return res.status(500).json({ error: 'Error al agregar el vehículo' });
    }

    // Llamar a la función dataOfficeTrack
    const mockReq = {
      params: { poi, name, customernumber },
    };
    await dataOfficeTrack(mockReq, res);

  } catch (error) {
    console.error('Error agregando vehículo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};




const addConfigVehicleNew = async (req, res) => {
  try {
    const pool = await getConnection();
    const id_sucursal = req.params.id_sucursal;
    const { id_vehiculo, unidad_negocio_centro, centro_costo, indice_pep, de_tercero, otro_ruc, ruc_imputacion } = req.body;
    console.log(req.body)
    // Obtener los nuevos datos del vehículo del cuerpo de la solicitud
    // Actualizar los datos del vehículo en la base de datos
    const result = await pool
      .request()
      .input('id_vehiculo', sql.VarChar, id_vehiculo)
      .input('id_sucursal', sql.Int, Number(id_sucursal))
      .input('unidad_negocio_centro', sql.VarChar, unidad_negocio_centro)
      .input('centro_costo', sql.VarChar, centro_costo)
      .input('indice_pep', sql.VarChar, indice_pep)
      .input('de_tercero', sql.Int, Number(de_tercero) || 0)
      .input('otro_ruc', sql.Int, Number(otro_ruc) || 0)
      .input('ruc_imputacion', sql.VarChar, ruc_imputacion || '0')
      .query('INSERT INTO dbo.config_vehiculo (id_vehiculo, id_sucursal,unidad_negocio_centro, centro_costo,indice_pep,de_tercero, otro_ruc, ruc_imputacion) VALUES (@id_vehiculo,@id_sucursal, @unidad_negocio_centro, @centro_costo,@indice_pep,@de_tercero,@otro_ruc,@ruc_imputacion)');


    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado' });
    }

    // Enviar una respuesta de éxito
    res.status(200).json({ message: 'Vehículo actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando datos del vehículo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteVehicle = async (req, res) => {
  try {
    const pool = await getConnection();
    const { id_vehiculo, id_sucursal } = req.params;

    // Validar que los parámetros existen
    if (!id_vehiculo || !id_sucursal) {
      return res.status(400).json({ error: 'Parámetros id_vehiculo y id_sucursal son requeridos.' });
    }

    // Realizar la eliminación en la base de datos
    const result = await pool
      .request()
      .input('id_vehiculo', sql.VarChar, id_vehiculo)
      .input('id_sucursal', sql.Int, id_sucursal)
      .query(`
        DELETE FROM dbo.config_vehiculo 
        WHERE id_vehiculo = @id_vehiculo AND id_sucursal = @id_sucursal
      `);

    // Verificar si se eliminó correctamente
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Vehículo no encontrado o no pertenece a la sucursal especificada.' });
    }

    // Enviar una respuesta de éxito
    res.status(200).json({ message: 'Vehículo eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando vehículo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


const getAllClients = async ({ res }) => {
  try {
    const data = await (await getConnection()).request().query(querys.getAllClients);
    res.status(200).json(data.recordset);
  } catch (error) {
    res.status(400).json({ msg: error.message });
  }
};

const addNewclient = async (req, res) => {
  try {
    const pool = await getConnection();
    const { ruc, descripcion_cliente } = req.body;

    // Verificar si el RUC ya existe en la base de datos
    const existingClient = await pool
      .request()
      .input('ruc', sql.VarChar, ruc)
      .query('SELECT * FROM dbo.cliente WHERE ruc = @ruc');

    if (existingClient.recordset.length > 0) {
      // Si el RUC ya existe, devolver un mensaje indicando que el cliente ya está registrado
      return res.status(400).json({ error: 'El RUC ya está registrado en la base de datos.' });
    }

    // Insertar el nuevo cliente en la base de datos
    const result = await pool
      .request()
      .input('ruc', sql.VarChar, ruc)
      .input('descripcion_cliente', sql.VarChar, descripcion_cliente)
      .query('INSERT INTO dbo.cliente (ruc, descripcion_cliente) VALUES (@ruc, @descripcion_cliente)');

    if (result.rowsAffected[0] === 0) {
      return res.status(500).json({ error: 'No se pudo agregar el cliente.' });
    }

    // Enviar una respuesta de éxito si el cliente se insertó correctamente
    res.status(201).json({ message: 'Cliente agregado exitosamente.' });
  } catch (error) {
    console.error('Error agregando cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};


// const getAllPerson = async ({ res }) => {
//   try {
//     const data = await (await getConnection()).request().query(querys.getAllPerson);
//     res.status(200).json(data.recordset);
//   } catch (error) {
//     res.status(400).json({ msg: error.message });
//   }
// };

const getAllPerson = async ({ res, query }) => {
  try {
    const { page, pageSize, filter } = query; // Obtén los parámetros de la consulta
    const offset = (page - 1) * pageSize; // Calcula el desplazamiento (offset)

    // Construir la consulta SQL con filtro global (si se proporciona)
    let filterQuery = '';
    if (filter) {
      filterQuery = `WHERE cedula LIKE '%${filter}%' OR nombre_apellido LIKE '%${filter}%'`; // Filtra por cédula o nombre
    }

    // Consulta para obtener los registros filtrados y paginados
    const data = await (await getConnection())
      .request()
      .query(`
        SELECT * FROM dbo.persona
        ${filterQuery}
        ORDER BY cedula
        OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
      `);

    // Consulta para obtener el total de registros filtrados
    const totalCountResult = await (await getConnection())
      .request()
      .query(`
        SELECT COUNT(*) AS total FROM dbo.persona
        ${filterQuery}
      `);

    const totalRecords = totalCountResult.recordset[0].total; // Total de registros

    res.status(200).json({
      data: data.recordset,
      page: Number(page),
      pageSize: Number(pageSize),
      totalRecords, // Incluye el total de registros
    });
  } catch (error) {
    res.status(400).json({ msg: error.message });
  }
};


// const createPerson = async (req, res) => {
//   try {
//     const pool = await getConnection();
//     const { cedula, nombre_apellido  } = req.body;
//     const result = await pool
//       .request()
//       .input('cedula', sql.VarChar, cedula)
//       .input('nombre_apellido', sql.VarChar, nombre_apellido)
//       .query('INSERT INTO dbo.persona (cedula, nombre_apellido) VALUES (@cedula, @nombre_apellido)');
//     if (result.rowsAffected[0] === 0) {
//       return res.status(500).json({ error: 'Error al agregar la persona' });
//     }
//     res.status(200).json({ message: 'Persona agregado exitosamente' });
//   } catch (error) {
//     console.error('Error agregando persona:', error);
//     res.status(500).json({ error: 'Error interno del servidor' });
//   }

// }
const createPerson = async (req, res) => {
  try {
    const pool = await getConnection();
    const { cedula, nombre_apellido } = req.body;
    const poi = 'PERSONAS 1';
    const name = nombre_apellido;
    const customernumber = cedula;

    // Verificar si el vehículo ya existe
    const existingVehicle = await pool
      .request()
      .input('cedula', sql.Int, Number(cedula))
      .query('SELECT * FROM dbo.persona WHERE cedula = @cedula');

    if (existingVehicle.recordset.length > 0) {
      return res.status(400).json({ error: 'La persona ya existe' });
    }

    // Insertar el nuevo vehículo
    const result = await pool
      .request()
      .input('cedula', sql.Int, Number(cedula))
      .input('nombre_apellido', sql.VarChar, nombre_apellido)
      .query('INSERT INTO dbo.persona (cedula, nombre_apellido) VALUES (@cedula, @nombre_apellido)');

    if (result.rowsAffected[0] === 0) {
      return res.status(500).json({ error: 'Error al agregar la persona' });
    }

    // Llamar a la función dataOfficeTrack
    const mockReq = {
      params: { poi, name, customernumber },
    };
    await dataOfficeTrack(mockReq, res);

  } catch (error) {
    console.error('Error agregando vehículo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getPersonById = async (req, res) => {
  try {
    const pool = await getConnection();
    const { cedula } = req.params;

    // Consultar la persona por cédula
    const result = await pool
      .request()
      .input('cedula', sql.Int, Number(cedula))
      .query('SELECT cedula, nombre_apellido FROM dbo.persona WHERE cedula = @cedula');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Persona no encontrada' });
    }

    res.status(200).json(result.recordset[0]);
  } catch (error) {
    console.error('Error obteniendo datos de la persona:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updatePerson = async (req, res) => {
  try {
    const pool = await getConnection();
    const cedula = String(req.params.cedula).trim(); // Cédula original desde la URL
    let { nueva_cedula, nombre_apellido } = req.body;

    // Limpiar y validar los datos
    nueva_cedula = String(nueva_cedula).trim();
    nombre_apellido = nombre_apellido.trim();

    if (!cedula || !nueva_cedula || !nombre_apellido) {
      return res.status(400).json({ error: 'Cédula y nombre_apellido son obligatorios.' });
    }

    if (isNaN(cedula) || isNaN(nueva_cedula)) {
      return res.status(400).json({ error: 'Cédula y nueva_cedula deben ser números.' });
    }

    // Verificar si la persona original existe
    const existingPerson = await pool
      .request()
      .input('cedula', sql.Int, Number(cedula))
      .query('SELECT * FROM dbo.persona WHERE cedula = @cedula');

    if (existingPerson.recordset.length === 0) {
      return res.status(404).json({ error: 'La persona no existe.' });
    }

    // Verificar si la nueva cédula ya está en uso, excluyendo la persona actual
    if (Number(cedula) !== Number(nueva_cedula)) {
      const duplicateCedula = await pool
        .request()
        .input('cedula', sql.Int, Number(nueva_cedula))
        .query('SELECT * FROM dbo.persona WHERE cedula = @cedula');

      if (duplicateCedula.recordset.length > 0) {
        return res.status(400).json({ error: 'La cédula ya está en uso.' });
      }
    }

    // Verificar si el nombre_apellido ya está en uso, excluyendo la persona actual
    const duplicateNombre = await pool
      .request()
      .input('nombre_apellido', sql.VarChar, nombre_apellido)
      .input('cedula', sql.Int, Number(cedula))
      .query(`
        SELECT * FROM dbo.persona 
        WHERE nombre_apellido = @nombre_apellido AND cedula != @cedula
      `);

    if (duplicateNombre.recordset.length > 0) {
      return res.status(400).json({ error: 'El nombre ya está en uso.' });
    }

    // Actualizar los datos de la persona
    const result = await pool
      .request()
      .input('cedula', sql.Int, Number(cedula)) // Cédula original
      .input('nueva_cedula', sql.Int, Number(nueva_cedula)) // Nueva cédula
      .input('nombre_apellido', sql.VarChar, nombre_apellido) // Nombre actualizado
      .query(`
        UPDATE dbo.persona 
        SET cedula = @nueva_cedula, nombre_apellido = @nombre_apellido
        WHERE cedula = @cedula
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(500).json({ error: 'Error al actualizar la persona.' });
    }

    res.status(200).json({ message: 'Persona actualizada correctamente.' });

  } catch (error) {
    console.error('Error actualizando persona:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};



const deletePerson = async (req, res) => {
  try {
    const pool = await getConnection();
    const cedula = req.query.cedula;
    console.log(cedula)

    if (!cedula) {
      return res.status(400).json({ error: 'Cédula no proporcionada' });
    }

    const result = await pool
      .request()
      .input('cedula', sql.Int, Number(cedula))
      .query('DELETE FROM dbo.persona WHERE cedula = @cedula');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Persona no encontrada' });
    }

    res.status(200).json({ message: 'Persona eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando persona:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getAllSucursals = async ({ res }) => {
  try {
    const data = await (await getConnection()).request().query(querys.getAllSucursals);
    res.status(200).json(data.recordset);
  } catch (error) {
    res.status(400).json({ msg: error.message });
  }
};

const createSucursal = async (req, res) => {
  try {
    const pool = await getConnection();
    const { descripcion, codigo_sucursal } = req.body; // Obtener los datos del vehículo del cuerpo de la solicitud

    // Realizar el INSERT en la base de datos
    const result = await pool
      .request()
      .input('descripcion', sql.VarChar, descripcion)
      .input('codigo_sucursal', sql.VarChar, codigo_sucursal)
      .query('INSERT INTO dbo.sucursal (descripcion, codigo_sucursal) VALUES (@descripcion, @codigo_sucursal)');

    // Verificar si se realizó el INSERT correctamente
    if (result.rowsAffected[0] === 0) {
      return res.status(500).json({ error: 'Error al agregar la sucursal' });
    }

    // Enviar una respuesta de éxito
    res.status(200).json({ message: 'Sucursal agregado exitosamente' });
  } catch (error) {
    console.error('Error agregando sucursal:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const deleteSucursal = async (req, res) => {
  try {
    const pool = await getConnection();
    const id_sucursal = req.params.id_sucursal;

    // Realizar la eliminación en la base de datos
    const result = await pool
      .request()
      .input('id_sucursal', sql.VarChar, id_sucursal)
      .query('DELETE FROM dbo.sucursal WHERE id_sucursal = @id_sucursal');

    // Verificar si se eliminó correctamente
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrado' });
    }

    // Enviar una respuesta de éxito
    res.status(200).json({ message: 'Sucursal eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando la sucursal:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const updateSucursal = async (req, res) => {
  try {
    const pool = await getConnection();
    const id_sucursal = req.params.id_sucursal;

    // Obtener el vechiculo por ID desde la base de datos
    const result = await pool
      .request()
      .input('id_sucursal', sql.VarChar, id_sucursal)
      .input('descripcion', sql.VarChar, req.body.descripcion)
      .input('codigo_sucursal', sql.VarChar, req.body.codigo_sucursal)
      .query('UPDATE dbo.sucursal SET descripcion = @descripcion, codigo_sucursal = @codigo_sucursal WHERE id_sucursal = @id_sucursal');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada' });
    }

    res.status(200).json({ message: 'Sucursal actualizada correctamente' });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getSucursalId = async (req, res) => {
  try {
    const pool = await getConnection();
    const idSuc = req.params.id_sucursal; // Use req.params.id_suc
    // Obtener el ticket por ID desde la base de datos
    const result = await pool
      .request()
      .input('id_suc', sql.BigInt, idSuc)
      .query('SELECT * FROM dbo.sucursal WHERE id_sucursal = @id_suc');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada' });
    }

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
const getAllPriceClient = async (req, res) => {
  try {
    const pool = await getConnection();
    const { id_sucursal } = req.params;

    const data = await pool
      .request()
      .input('id_sucursal', sql.VarChar, id_sucursal)
      .query(querys.getAllPriceClient);

    res.status(200).json(data.recordset);
  } catch (error) {
    res.status(400).json({ msg: error.message });
  }
};

const getArticle = async (req, res) => {
  try {
    const data = await (await getConnection()).request().query(querys.getArticle);
    res.status(200).json(data.recordset);
  } catch (error) {
    res.status(400).json({ msg: error.message });
  }
}

// const getBodReport = async (req, res) => {
//   try {
//     const { id_sucursal } = req.params;

//     const data = await (await getConnection()).request()
//       .input('id_sucursal', sql.Int, Number(id_sucursal))
//       .query(querys.getBodReport, id_sucursal);
//     res.status(200).json(data.recordset);
//   } catch (error) {
//     res.status(400).json({ msg: error.message });
//   }
// }

const getBodReport = async (req, res) => {
  try {
    const { id_sucursal } = req.params;

    const connection = await getConnection();
    const data = await connection.request()
      .input('id_sucursal', sql.Int, Number(id_sucursal))
      .query(querys.getBodReport);

    res.status(200).json(data.recordset);
  } catch (error) {
    res.status(400).json({ msg: error.message });
  }
};

const createBod = async (req, res) => {
  try {
    const pool = await getConnection();
    const { id_sucursal, descripcion, codigo_bodega } = req.body; // Obtener los datos del vehículo del cuerpo de la solicitud
    console.log(req.body)
    // Realizar el INSERT en la base de datos
    const result = await pool
      .request()
      .input('descripcion', sql.VarChar, descripcion)
      .input('id_sucursal', sql.Int, id_sucursal)
      .input('codigo_bodega', sql.VarChar, codigo_bodega)
      .query('INSERT INTO dbo.bodega (id_sucursal, descripcion, codigo_bodega) VALUES (@id_sucursal, @descripcion, @codigo_bodega)');

    // Verificar si se realizó el INSERT correctamente
    if (result.rowsAffected[0] === 0) {
      return res.status(500).json({ error: 'Error al agregar la bodega' });
    }

    // Enviar una respuesta de éxito
    res.status(200).json({ message: 'Bodega agregado exitosamente' });
  } catch (error) {
    console.error('Error agregando bodega:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}
module.exports = {
  queryTickets,
  getSurcursal, getAllVehicles,
  getAllVehiclesId, editVehicles,
  addConfigVehicle, createVehicle,
  addConfigVehicleNew, getAllClients,
  deleteVehicle, addNewclient,
  getNullVehiclesConfig, createSucursal,
  getAllSucursals, deleteSucursal,
  updateSucursal, getSucursalId, getAllPriceClient,
  getArticle, getBodReport, createBod, getAllPerson, createPerson, deletePerson,
  getPersonById, updatePerson
}

