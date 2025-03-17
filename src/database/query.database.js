module.exports.querys = {
  getKpi: 'SELECT TOP 3 * FROM dv_tbl_reg_kpi',
  insertKpi:
    `INSERT INTO dv_tbl_reg_kpi (nom_evaluado, nom_evaluador,consorcio, id_colaborador, fecha_evaluacion, pf, iva, if_, ig, a,año, cumplimiento, _id, id_evaluador, mes_eval, cod_form) 
      VALUES (@nom_evaluado, @nom_evaluador, @consorcio, @id_colaborador, @fecha_evaluacion, @pf, @iva, @if_, @ig, @a, @año,@cumplimiento, @_id, @id_evaluador, @mes_eval, @cod_form)`,
  checkKpiExist: 'SELECT COUNT(*) AS count FROM dv_tbl_reg_kpi WHERE _id = @_id',

  getListPlayero: 'SELECT TOP 3 * FROM dbo.ticket_surtidor',

  insertPLayeroDb: ` INSERT INTO dbo.ticket_surtidor (
    id_mongo, id_ticket, id_suc,id_com, id_bod, id_pico, fecha, hora,
    foto_taxilitro, foto_taxilitro_fin,id_operador, id_equipo, id_playero, horometro,
    foto_horometro, kilometro, foto_kilometro, firma_conductor, ubicacion_carga,
    observaciones_ticket, foto_observaciones, foto_chapa, litros, precio, ruc_cliente, inicio_taxilitro, final_taxilitro, sync
  ) VALUES (
    @id_mongo, @id_ticket, @id_suc,@id_com,@id_bod, @id_pico, @fecha, @hora,
    @foto_taxilitro,@foto_taxilitro_fin ,@id_operador, @id_equipo, @id_playero, @horometro,
    @foto_horometro, @kilometro, @foto_kilometro, @firma_conductor, @ubicacion_carga,
    @observaciones_ticket, @foto_observaciones, @foto_chapa, @litros, @precio,@ruc_cliente, @inicio_taxilitro, @final_taxilitro, @sync
  )`,

  insertBod: `SELECT b.id_sucursal, b.id_bod, p.id_combustible
  FROM pico_surtidor p
  INNER JOIN bodega b ON p.id_bod = b.id_bod where p.id_pico= @id_pico

  `,
  insertPico: `SELECT b.id_sucursal, b.id_bod, p.id_combustible
  FROM pico_surtidor p
  INNER JOIN bodega b ON p.id_bod = b.id_bod where p.id_bod= @id_bod

  `,
  checkPlayeroExist: 'SELECT COUNT(*) AS count FROM dbo.ticket_surtidor WHERE id_mongo = @id_mongo',
  checkInicioFinExist: 'SELECT COUNT(*) AS count FROM med_inicio_cierre WHERE id_mongo = @id_mongo',

  checkVehicle: 'SELECT COUNT(*) AS count FROM dbo.vehiculo WHERE id_vehiculo = @id_vehiculo',
  checkPerson: 'SELECT COUNT(*) AS count FROM dbo.persona WHERE cedula = @cedula',

  getTickets: `SELECT ti.*, com.descripcion, suc.descripcion AS Sucursal, (ti.litros * ti.precio) AS Total, 
  (SUBSTRING(CAST(ti.fecha AS varchar(8)), 7,2)+'-'+ SUBSTRING(CAST(ti.fecha AS varchar(8)), 5,2) + '-' + SUBSTRING(CAST(ti.fecha AS varchar(8)), 1,4)) AS Fecha1, 
  pic.descripcion AS Pico
  FROM dbo.ticket_surtidor  ti
      JOIN combustible com on ti.id_com = com.id_combustible
      JOIN sucursal suc on ti.id_suc = suc.id_sucursal
      JOIN pico_surtidor pic on ti.id_pico = pic.id_pico
  where id_suc = @id_suc
  order by fecha desc 
   `,
  getTicketsPage: `
    SELECT ti.*, 
      com.descripcion, 
      suc.descripcion as Sucursal, 
      bod.descripcion as bodega,
      (ti.litros * ti.precio) as Total, 
      (SUBSTRING(CAST(ti.fecha as varchar(8)), 7, 2) + '-' + 
      SUBSTRING(CAST(ti.fecha as varchar(8)), 5, 2) + '-' + 
      SUBSTRING(CAST(ti.fecha as varchar(8)), 1, 4)) as Fecha1, 
      pic.descripcion as Pico,
      CASE 
        WHEN ti.sync = 1 THEN 'si' 
        ELSE 'no' 
      END as SyncStatus
    FROM dbo.ticket_surtidor ti
    JOIN combustible com ON ti.id_com = com.id_combustible
    JOIN sucursal suc ON ti.id_suc = suc.id_sucursal
    JOIN pico_surtidor pic ON ti.id_pico = pic.id_pico
    JOIN bodega bod ON ti.id_bod = bod.id_bod
    WHERE ti.id_suc = @id_suc
    {{filterCondition}} 
    {{dateCondition}} 
    ORDER BY ti.fecha DESC, ti.hora DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  `,


  getSucursal: 'SELECT * FROM sucursal',
  getTicketsId: `Select ts.id_ticket, ts.fecha, ts.hora, ts.id_suc, su.descripcion as sucursal, ts.id_bod, bo.descripcion as deposito,
  (SUBSTRING(CAST(ts.fecha AS varchar(8)), 7, 2) + '-' + 
  SUBSTRING(CAST(ts.fecha AS varchar(8)), 5, 2) + '-' + 
  SUBSTRING(CAST(ts.fecha AS varchar(8)), 1, 4)) AS fecha2,
  pi.descripcion as pico, ts.id_playero, pl.nombre_apellido as playero, ts.ruc_cliente, cli.descripcion_cliente, ts.precio,
  ts.id_operador as id_operador_chofer, op.nombre_apellido as operador_chofer, ts.id_equipo, ve.descripcion_vehiculo as equipo_vehiculo,
  ts.kilometro, FORMAT(ts.horometro, 'N2', 'es-ES') AS horometro, pi.id_combustible, com.descripcion as combustible, ts.litros, ts.observaciones_ticket, ts.ubicacion_carga,
  ts.firma_conductor, ts.foto_observaciones, ts.foto_chapa, ts.foto_taxilitro,ts.inicio_taxilitro,ts.final_taxilitro, ts.foto_taxilitro_fin,ts.foto_horometro, ts.foto_kilometro
  from sys_playero.dbo.ticket_surtidor ts 
  join sys_playero.dbo.persona op on ts.id_operador = op.cedula
  join sys_playero.dbo.persona pl on ts.id_playero = pl.cedula
  join sys_playero.dbo.sucursal su on ts.id_suc= su.id_sucursal
  join sys_playero.dbo.bodega bo on ts.id_bod= bo.id_bod
  join sys_playero.dbo.cliente cli on ts.ruc_cliente= cli.ruc
  join sys_playero.dbo.vehiculo ve on ts.id_equipo= ve.id_vehiculo
  join sys_playero.dbo.pico_surtidor pi on ts.id_pico = pi.id_pico
  join sys_playero.dbo.combustible com on ts.id_com= com.id_combustible
  where id_ticket=@id_ticket`,
  insertCountTicket: 'SELECT MAX(id_ticket) from ticket_surtidor where id_bod=@id_bod',

  getTraspasoById: `SELECT
      t.id_traspaso,
      b1.id_sucursal,
      s.descripcion as sucursal,
      t.id_encargado_receptor,
      per.nombre_apellido as nombreReceptor,
      t.id_playero,
      pla.nombre_apellido as nombrePlayero,
      (SUBSTRING(CAST(t.fecha AS varchar(8)), 7, 2) + '-' + 
      SUBSTRING(CAST(t.fecha AS varchar(8)), 5, 2) + '-' + 
      SUBSTRING(CAST(t.fecha AS varchar(8)), 1, 4)) AS fecha2,
      t.fecha,
      t.hora,
      t.litros_pico AS "Litros_Traspaso",
      t.litros_tanque_final - t.litros_tanque_inicial AS litros_tanque,
      b1.descripcion AS Origen,
      b2.descripcion AS Destino,
      t.litros_tanque_inicial,
      t.litros_tanque_final,
      p.descripcion,
      t.taxilitro_inicial,
      t.taxilitro_final,
      t.foto_taxilitro,
      t.firma_receptor,
      t.foto_obs_final,
      t.foto_obs_inicial,
      t.foto_obs_traspaso
    FROM traspaso t
      INNER JOIN bodega b1 ON t.bod_origen = b1.id_bod
      INNER JOIN bodega b2 ON t.bod_destino = b2.id_bod
      INNER JOIN sucursal s ON b1.id_sucursal = s.id_sucursal
      INNER JOIN pico_surtidor p ON t.id_pico = p.id_pico
      INNER JOIN persona per ON t.id_encargado_receptor = per.cedula
      INNER JOIN persona pla ON t.id_playero = pla.cedula
    WHERE id_traspaso = @id_traspaso;`,

  getAbastecimientoById: `
    SELECT
      r.id_repos,
      r.id_suc,
      s.descripcion AS sucursal,
      r.id_bod,
      b.descripcion AS bodega,
      r.fecha,
      (SUBSTRING(CAST(r.fecha AS varchar(8)), 7, 2) + '-' + 
      SUBSTRING(CAST(r.fecha AS varchar(8)), 5, 2) + '-' + 
      SUBSTRING(CAST(r.fecha AS varchar(8)), 1, 4)) AS fecha2,
      r.hora,
      r.nro_oc,
      r.nro_remision,
      r.litros_remision,
      p.cedula,
      p.nombre_apellido AS playero_nombre,
      r.foto_rev_docs,
      r.zeta_no_llega,
      r.id_pico_para_zeta,
      r.foto_taxilitro,
      r.taxilitro_inicial,
      r.taxilitro_final,
      r.litros_zeta,
      r.obs_repos,
      r.foto_obs_repos,
      r.litros_total_repos,
      r.id_mongo
    FROM repos_surtidor r
      INNER JOIN bodega b ON r.id_bod = b.id_bod
      INNER JOIN sucursal s ON r.id_suc = s.id_sucursal
      INNER JOIN persona p ON r.playero = p.cedula
    WHERE r.id_repos = @id_repos;
  `,

  getConfigVehicle: `SELECT c.id_vehiculo, v.descripcion_vehiculo, c.id_sucursal, c.unidad_negocio_centro, c.centro_costo, c.indice_pep, cl.descripcion_cliente, cl.ruc 
  FROM config_vehiculo c 
  INNER JOIN dbo.vehiculo v ON c.id_vehiculo = v.id_vehiculo 
  INNER JOIN dbo.cliente cl ON v.ruc = cl.ruc 
  WHERE id_sucursal = @id_sucursal 
  AND (
      (c.centro_costo IS NOT NULL AND c.centro_costo != '') 
      OR (c.indice_pep IS NOT NULL AND c.indice_pep != '') 
      OR (c.unidad_negocio_centro IS NOT NULL AND c.unidad_negocio_centro != '')
  )
  `,

  getConfigVehiclePage: `
        SELECT 
          c.id_vehiculo,
          v.descripcion_vehiculo,
          c.id_sucursal,
          c.unidad_negocio_centro,
          c.centro_costo,
          c.indice_pep,
          cl.descripcion_cliente,
          cl.ruc
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
        ORDER BY c.id_vehiculo
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY;
  `,


  getNullConfigVehicle: `SELECT c.id_vehiculo, v.descripcion_vehiculo, c.id_sucursal, c.unidad_negocio_centro, c.centro_costo, c.indice_pep, cl.descripcion_cliente, cl.ruc 
  FROM config_vehiculo c 
  INNER JOIN dbo.vehiculo v ON c.id_vehiculo = v.id_vehiculo 
  INNER JOIN dbo.cliente cl ON v.ruc = cl.ruc 
  WHERE id_sucursal = @id_sucursal
  AND COALESCE(c.centro_costo, '') = '' 
  AND COALESCE(c.indice_pep, '') = '' 
  AND COALESCE(c.unidad_negocio_centro, '') = ''
  `,

  getNullConfigVehiclePage: `SELECT c.id_vehiculo, v.descripcion_vehiculo, c.id_sucursal, 
       c.unidad_negocio_centro, c.centro_costo, c.indice_pep, 
       cl.descripcion_cliente, cl.ruc 
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
      ORDER BY c.id_vehiculo
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY

  `,

  editVehicle1ys: 'SELECT * FROM dbo.config_vehiculo where id_vehiculo = @id_vehiculo',
  editVehicles: `SELECT c.id_vehiculo, v.descripcion_vehiculo, c.id_sucursal, c.unidad_negocio_centro, c.centro_costo, c.indice_pep, cl.descripcion_cliente, cl.ruc, c.de_tercero,c.otro_ruc, c.ruc_imputacion
  from dbo.config_vehiculo c 
  inner join dbo.vehiculo v on c.id_vehiculo = v.id_vehiculo 
  inner join dbo.cliente cl on v.ruc = cl.ruc
  WHERE v.id_vehiculo = @id_vehiculo and c.id_sucursal = @id_sucursal`,
  getAllVehicles: 'SELECT a.id_vehiculo,a.descripcion_vehiculo, a.ruc , a.id_encargado, b.descripcion_cliente FROM sys_playero.dbo.vehiculo as a inner join dbo.cliente as b on b.ruc = a.ruc',
  getAllVehiclesPage: `SELECT 
    a.id_vehiculo,
    a.descripcion_vehiculo,
    a.ruc,
    a.id_encargado,
    b.descripcion_cliente
    FROM 
        sys_playero.dbo.vehiculo AS a
    INNER JOIN 
        dbo.cliente AS b ON b.ruc = a.ruc
    WHERE 
        (@filter IS NULL OR a.id_vehiculo LIKE '%' + @filter + '%')
    ORDER BY 
        a.id_vehiculo
    OFFSET 
        @offset ROWS FETCH NEXT @limit ROWS ONLY; 
  `,

  getAllClients: 'SELECT * FROM dbo.cliente',
  getAllSucursals: 'SELECT * FROM dbo.sucursal',
  getAllPriceClient: 'SELECT * FROM dbo.precio_sucursal_cliente WHERE id_sucursal = @id_sucursal',

  insertInicioFin: 'INSERT INTO dbo.med_inicio_cierre (id_suc, id_bod, fecha,hora, playero, tipo, litros, observacion, fotos_observacion, id_mongo) VALUES (@id_suc, @id_bod, @fecha, @hora,@playero, @tipo, @litros, @observacion, @fotos_observacion, @id_mongo)',
  consultIdMed: 'SELECT id_med FROM dbo.med_inicio_cierre WHERE id_mongo = @id_mongo',
  insertPicoInicioFin: 'INSERT INTO dbo.med_reg_pico (id_med, id_pico, taxilitro, foto_taxilitro) VALUES (@id_med, @id_pico, @taxilitro, @foto_taxilitro)',
  insertTanqueInicioFin: 'INSERT INTO dbo.med_reg_tanque (id_med, id_tanque, regla, litros, temperatura, foto_tanque) VALUES (@id_med, @id_tanque, @regla, @litros, @temperatura, @foto_tanque)',
  getArticle: 'SELECT * FROM dbo.combustible',
  getBodReport: 'SELECT * FROM dbo.bodega WHERE id_sucursal = @id_sucursal',

  getSucursalAbastecimiento: `SELECT * FROM bodega WHERE id_bod = @id_bod`,
  checkAbastecimientoExist: 'SELECT COUNT(*) AS count FROM repos_surtidor WHERE id_mongo = @id_mongo',
  insertAbastecimientoData: 'INSERT INTO repos_surtidor (id_suc, id_bod, fecha, hora, playero, nro_oc, nro_remision,litros_remision,foto_rev_docs, zeta_no_llega, id_pico_para_zeta, foto_taxilitro, taxilitro_inicial, taxilitro_final, litros_zeta, obs_repos, foto_obs_repos, litros_total_repos, id_mongo) VALUES (@id_suc, @id_bod, @fecha, @hora, @playero,@nro_oc,@nro_remision,@litros_remision, @foto_rev_docs, @zeta_no_llega, @id_pico_para_zeta, @foto_taxilitro, @taxilitro_inicial, @taxilitro_final, @litros_zeta, @obs_repos, @foto_obs_repos, @litros_total_repos, @id_mongo)',
  checkCalibracionPicoExist: 'SELECT COUNT(*) AS count FROM calibracion_pico_cabecera WHERE id_mongo = @id_mongo',
  insertAbastecimientoTanque: 'INSERT INTO repos_med_reg_tanque (id_repos,id_tanque,tipo,regla,temperatura,litros,foto_tanque) VALUES (@id_repos,@id_tanque,@tipo,@regla,@temperatura,@litros,@foto_tanque);',
  insertCalibracionPico: 'INSERT INTO calibracion_pico_cabecera (formCode, bodega, fecha_hora, hora, obs_gral, ci_encargado, nombre_encargado, id_mongo) VALUES (@form_code, @id_bod, @fecha, @hora, @obs_gral, @ci_encargado, @nombre_encargado, @id_mongo)',

  getAllPerson: 'SELECT * FROM dbo.persona',
};

