const ExcelJS = require('exceljs');
const { getConnection, sql } = require('../database/init');
const downloadExcel = async (req, res) => {
  try {
    const { fecha, bodega, sucursal } = req.body;

    // Conectar a la base de datos
    const pool = await getConnection();

    // Ejecutar la consulta SQL utilizando parámetros
    const data = await pool.request()
      .input('fecha', sql.VarChar, fecha)
      .input('bodega', sql.Int, bodega)
      .input('sucursal', sql.Int, sucursal)
      .query(`
        SELECT tk.id_ticket AS ID, su.txt_consorcio_unysoft AS Consorcio, su.txt_empresa_unysoft AS Empresa, su.codigo_sucursal AS 'Unidad de Negocio', 
          bo.codigo_bodega AS Bodega, FORMAT(CONVERT(DATE, CONVERT(VARCHAR(8), tk.fecha), 112), 'dd/MM/yyyy') AS 'Fecha Salida', 'BODI' AS 'Tipo de Documento', 
          tk.id_ticket AS 'Numero Dcto.', su.autorizador_unysoft AS 'Autorizado por', tk.id_operador AS Retirado, '' AS Transporte, 
          '' AS Chofer, tk.hora AS 'Hora Salida', tk.ruc_cliente AS Cliente, tk.observaciones_ticket AS Observacion, '' AS 'Dirigido a', 
          id_equipo AS Patente, co.cod_sistema AS Recurso, tk.litros AS Cantidad, cv.unidad_negocio_centro AS 'Unidad de Negocio 2',
          cv.indice_pep AS 'Item Ppto', tk.id_equipo AS 'Id Equipo', cv.centro_costo AS 'Centro de Costo', '' AS 'Equipo Tercero', 
          tk.precio AS 'Precio Digitado', tk.horometro AS Horometro, tk.kilometro AS Kilometro, su.txt_consorcio_unysoft AS ConsorcioAF, 
          su.txt_empresa_unysoft AS EmpresaAF
        FROM ticket_surtidor tk 
        JOIN sucursal su ON tk.id_suc = su.id_sucursal 
        JOIN bodega bo ON tk.id_bod= bo.id_bod 
        JOIN config_vehiculo cv ON tk.id_suc= cv.id_sucursal AND tk.id_equipo= cv.id_vehiculo AND cv.de_tercero = 0
        JOIN combustible co ON tk.id_com= co.id_combustible 
        WHERE tk.id_bod = @bodega AND tk.fecha = @fecha

        UNION ALL

        SELECT tk.id_ticket AS ID, su.txt_consorcio_unysoft AS Consorcio, su.txt_empresa_unysoft AS Empresa, su.codigo_sucursal AS 'Unidad de Negocio', 
          bo.codigo_bodega AS Bodega, FORMAT(CONVERT(DATE, CONVERT(VARCHAR(8), tk.fecha), 112), 'dd/MM/yyyy') AS 'Fecha Salida', 'BODI' AS 'Tipo de Documento', 
          tk.id_ticket AS 'Numero Dcto.', su.autorizador_unysoft AS 'Autorizado por', tk.id_operador AS Retirado, '' AS Transporte, 
          '' AS Chofer, tk.hora AS 'Hora Salida', tk.ruc_cliente AS Cliente, tk.observaciones_ticket AS Observacion, '' AS 'Dirigido a', 
          id_equipo AS Patente, co.cod_sistema AS Recurso, tk.litros AS Cantidad, cv.unidad_negocio_centro AS 'Unidad de Negocio 2',
          cv.indice_pep AS 'Item Ppto', '' AS 'Id Equipo', cv.centro_costo AS 'Centro de Costo', '' AS 'Equipo Tercero', tk.precio AS 'Precio Digitado', 
          tk.horometro AS Horometro, tk.kilometro AS Kilometro, su.txt_consorcio_unysoft AS ConsorcioAF, su.txt_empresa_unysoft AS EmpresaAF
        FROM ticket_surtidor tk 
        JOIN sucursal su ON tk.id_suc = su.id_sucursal 
        JOIN bodega bo ON tk.id_bod= bo.id_bod 
        JOIN config_vehiculo cv ON tk.id_suc= cv.id_sucursal AND tk.id_equipo= cv.id_vehiculo AND cv.de_tercero = 1
        JOIN combustible co ON tk.id_com= co.id_combustible 
        WHERE tk.id_bod = @bodega AND tk.fecha = @fecha
      `);

    const recordset = data.recordset;

    // Crear un nuevo libro de Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Datos de Tickets');

    // Añadir columnas con encabezados
    worksheet.columns = [
      { header: 'ID', key: 'ID', width: 15 },
      { header: 'Consorcio', key: 'Consorcio', width: 15 },
      { header: 'Empresa', key: 'Empresa', width: 15 },
      { header: 'Unidad de Negocio', key: 'Unidad de Negocio', width: 15 },
      { header: 'Bodega', key: 'Bodega', width: 15 },
      { header: 'Fecha Salida', key: 'Fecha Salida', width: 15 },
      { header: 'Tipo de Documento', key: 'Tipo de Documento', width: 15 },
      { header: 'Numero Dcto.', key: 'Numero Dcto.', width: 15 },
      { header: 'Autorizado por', key: 'Autorizado por', width: 15 },
      { header: 'Retirado', key: 'Retirado', width: 15 },
      { header: 'Transporte', key: 'Transporte', width: 15 },
      { header: 'Chofer', key: 'Chofer', width: 15 },
      { header: 'Hora Salida', key: 'Hora Salida', width: 15 },
      { header: 'Cliente', key: 'Cliente', width: 15 },
      { header: 'Observacion', key: 'Observacion', width: 15 },
      { header: 'Dirigido a', key: 'Dirigido a', width: 15 },
      { header: 'Patente', key: 'Patente', width: 15 },
      { header: 'Recurso', key: 'Recurso', width: 15 },
      { header: 'Cantidad', key: 'Cantidad', width: 15 },
      { header: 'Unidad de Negocio', key: 'Unidad de Negocio 2', width: 15 },
      { header: 'Item Ppto', key: 'Item Ppto', width: 15 },
      { header: 'Id Equipo', key: 'Id Equipo', width: 15 },
      { header: 'Centro de Costo', key: 'Centro de Costo', width: 15 },
      { header: 'Equipo Tercero', key: 'Equipo Tercero', width: 15 },
      { header: 'Precio Digitado', key: 'Precio Digitado', width: 15 },
      { header: 'Horometro', key: 'Horometro', width: 15 },
      { header: 'Kilometro', key: 'Kilometro', width: 15 },
      { header: 'ConsorcioAF', key: 'ConsorcioAF', width: 15 },
      { header: 'EmpresaAF', key: 'EmpresaAF', width: 15 }
    ];

    // Se añade los datos a las filas
    recordset.forEach((row) => {
        // Imprimir el valor de la columna "Unidad de Negocio" en la consola
      //console.log('Unidad de Negocio:', row['Unidad de Negocio']); // Asegúrate de que este nombre coincida con el de tu consulta SQL
      worksheet.addRow(row);
    });


    worksheet.getRow(1).font = { bold: true }; // nombre de las columnas en negrita para resaltar

    // Configurar el archivo para ser enviado
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Resultads-${fecha}.xlsx`);

    await workbook.xlsx.write(res);

    res.status(200).end();
  } catch (error) {
    console.error('Error al generar el Excel:', error);
    res.status(500).send('Error al generar el Excel');
  }
};

module.exports = {
  downloadExcel,
};
