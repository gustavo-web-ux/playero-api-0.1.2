const { Router } = require('express');
const authenticateToken = require('../middleware_login/auth.Middleware');
const { authJwt } = require('../middlewares/init');
const  tickets = require('../controllers/dataTable.controller')
const traspaso = require('../controllers/traspaso.controller')
const medicion = require('../controllers/medicion.controller')
const precios = require('../controllers/precioCombustible.controller')
const roles = require('../controllers/roles.controller')
const ticketsID = require('../controllers/getTicketID')
const abastecimiento = require('../controllers/abastecimiento.controller')
const calibraciones = require('../controllers/calibracionPico.controller')
const litros = require('../controllers/reportes.controller');
const sap = require('../controllers/dataSap.controller');
const officeTrack = require('../utils/apiOfficeTrack/transformData.util');
// const bodegas = require('../controllers/bodegas.controller')
// const tanques = require('../controllers/tanques.controller')
const sucursal = require('../controllers_login/sucursalController');
const playeroWialon = require('../controllers/cargasWialon.controller');

const router = Router();
// Aplica el middleware de autenticación a todas las rutas
router.use(authenticateToken);

//RUTAS DE LOS CONTROLLERS DEL SISTEMA PLAYERO

//Rutas para la tabla de tickets
router.get('/tickets/:id_suc',tickets.queryTickets); //get para obtener los tickets por id de sucursal
router.get('/tickets/ticket/:id_ticket', ticketsID.getTicketById); //get para obtener los tickets por id de ticket

//Ruta para la tabla trapaso
router.get('/traspaso/:id_sucursal', traspaso.getTraspasos);
router.get('/traspasos/traspaso/:id_traspaso', traspaso.getTraspasoById);

//Ruta para abastecimientos
router.get("/abastecimiento/:id_suc", abastecimiento.getReposSurtidor);
router.get('/abastecimientos/abastecimiento/:id_repos', abastecimiento.getAbastecimientoById);

//Rutas para obtener los datos de las sucursales
router.get('/listSucursal', tickets.getSurcursal); //get para obtener las sucursales

//Rutas para calibraciones
router.get("/calibraciones/:id_sucursal", calibraciones.getCalibraciones);
router.get("/calibraciones/detalle/:id", calibraciones.getCalibracionById);

//Medicion inicial y final
router.get("/mediciones/:id_suc/:fecha/:id_bod", medicion.getMedicionesBySucursalFecha);
router.get("/mediciones/bodegas/:id_sucursal", medicion.getBodegasBySucursal);

//nuevoSucursal
router.get('/getSucursales', sucursal.getSucursales);
router.post('/setDefaultSucursal', sucursal.setDefaultSucursal);
router.get('/getAllSucursales', sucursal.getAllSucursales);
router.get('/getAllSucursal', sucursal.getAllSucursal);
router.post('/postSucursal', sucursal.createSucursal);
router.put('/updateSucursalN/:id_sucursal', sucursal.updateSucursalN);
// router.get('/getSucursalCreada/:id_sucursal', sucursal.getSucursal);
// router.put('/updateSucursal/:id_sucursal', sucursal.updateSucursal);
// router.get("/getConfigSAP", sucursal.getConfigSAP);

//rutas bodegas
// router.post('/createBodegas', bodegas.createBodegas);
// router.get('/getBodegasBySucursal/:id_sucursal', bodegas.getBodegasBySucursal);
// router.get('/getPicosByBodega/:id_sucursal', bodegas.getPicosByBodega);
// router.get('/getTanquesByBodega/:id_sucursal', bodegas.getTanquesByBodega);
// router.get("/getBodegas", bodegas.getBodegas); 
// router.put("/updateBodega/:id_bod", bodegas.updateBodega); 
// router.get("/getListPicosByBodega/:id_bodega", bodegas.getListPicosByBodega); 
// router.get("/getListTanquesByBodega/:id_bodega", bodegas.getListTanquesByBodega); 

// //rutas para crear picos
// router.post('/createPicos', calibraciones.createPicos);
// router.get('/getPicos', calibraciones.getPicos);
// router.put("/updatePico/:id_sucursal/:id_bod/:id_pico", calibraciones.updatePico);

// //rutas tanques
// router.post('/createTanques', tanques.createTanques);
// router.get('/getTanques', tanques.getTanques);
// router.put("/updateTanque/:id_sucursal/:id_bodega/:id_tanque", tanques.updateTanque);

//nuevoRoles
router.get('/getRoles', roles.getRoles);
router.get('/getAutorizaciones', roles.getAutorizaciones);
router.post('/createRol', roles.createRole);
router.get('/roles/:id_rol', roles.getRoleById);
router.put('/updateRole/:id_rol', roles.updateRole);  // Actualizar un rol

//precio combustible sucursal
router.get('/getprecioSucursal/:id_sucursal', precios.getPreciosCombustibleSucursal);
router.post('/createPrecioSucursal/:id_sucursal', precios.createPrecioCombustible);
router.put('/updatePrecioSucursal/:id_sucursal/:id_combustible', precios.updatePrecioCombustible);

//Cargas wialon playero
router.get('/getWialonPlayero', playeroWialon.getReporteWialonPlayero);
//router.get('/getPlayeroWialonDetalle/:id_ticket', playeroWialon.getPlayeroWialonDetalle);

//getCombustibles
router.get('/getCombustibles', precios.getCombustibles);

//getClientes
router.get('/getClientes', precios.getClientes);

//precio combustible cliente
router.get('/getprecioCliente/:id_sucursal', precios.getPreciosClienteSucursal);
router.post('/createPrecioCliente/:id_sucursal', precios.createPrecioClienteSucursal);
router.put('/updatePrecioCliente/:id_sucursal/:id_combustible/:id_ruc', precios.updatePrecioClienteSucursal);
router.delete('/deletePrecioCliente/:id_sucursal/:id_combustible/:id_ruc', precios.deletePrecioClienteSucursal);

//Rutas para obtener los datos de los vehiculos
router.get('/getConfigVehicle/:id_suc', tickets.getAllVehiclesId); // get Configuracion del vehiculo por id
router.get('/getNullConfig/:id_suc', tickets.getNullVehiclesConfig);// get Configuracion del vehiculo para Completar datos
router.get('/editVehicle/:id_vehiculo/:id_sucursal', tickets.editVehicles); // get para editar vehiculo por id
router.put('/editVehicle/:id_vehiculo/:id_sucursal', tickets.addConfigVehicle); // put para editar vehiculo por id
router.get('/getVehicles', tickets.getAllVehicles); // get para obtener todos los vehiculos
router.post('/createVehicle', tickets.createVehicle); // post para crear un vehiculo
router.post('/addConfigVehicleNew/:id_sucursal', tickets.addConfigVehicleNew); // post para agregar configuracion de vehiculo
router.delete('/deleteVehicle/:id_vehiculo/:id_sucursal', tickets.deleteVehicle); // delete para eliminar un vehiculo

//Rutas para obtener los datos de los Clientes
router.get('/getAllClients', tickets.getAllClients) //get para obtener todas las sucursales
router.post('/addNewclient', tickets.addNewclient); // post para agregar un nuevo cliente

//Rutas para obtener los datos de las sucursales
router.get('/getAllSucursals', tickets.getAllSucursals); //get para obtener todas las sucursales
router.post('/createSucursal', tickets.createSucursal); // post para agregar una nueva sucursal
router.delete('/deleteSucursal/:id_sucursal', tickets.deleteSucursal); // delete para eliminar una sucursal
router.patch('/updateSucursal/:id_sucursal', tickets.updateSucursal); // patch para actualizar una sucursal
router.get('/getSucursal/:id_sucursal', tickets.getSucursalId); // get para obtener una sucursal por id

//Rutas para obtener los datos de los precios de los clientes
router.get('/getAllPriceClient/:id_sucursal', tickets.getAllPriceClient); // get para obtener los precios de los clientes por id de sucursal
router.get('/getArticle', tickets.getArticle); // get para obtener los articulos/combustibles
router.post('/addNewclient')

//Rutas para los reportes
router.get('/litrosdiax/:id_sucursal/:id_bod/:fecha_hora', litros.tanques); // get para obtener los Litros inicial y litros final de un día X
router.get('/bodega/:id_sucursal', tickets.getBodReport); // get para obtener las bodegas por id de sucursal
router.post('/createBodega', tickets.createBod); // post para agregar una nueva bodega

//Ruta para enviar datos a Sap
router.post('/dataSap', sap.dataSap); // post para enviar datos a Sap

//get para obtener los datos de los xml trasnformarlos y cargar a la BD de Calibracion de Pico
//get para obtener los datos de los xml trasnformarlos y cargar a la BD de Traspaso de Combustible

router.post('/dataOfficeTrack/:poi/:name/:customernumber', officeTrack.dataOfficeTrack); //post para enviar datos a OfficeTrack

router.get('/getAllPerson', tickets.getAllPerson); //get para obtener todas las personas
router.post('/createPerson', tickets.createPerson); // post para agregar una nueva persona
router.get('/getPerson/:cedula', tickets.getPersonById); 
router.put('/updatePerson/:cedula', tickets.updatePerson);
router.delete('/deletePerson', tickets.deletePerson); // delete para eliminar una persona

module.exports = router;
