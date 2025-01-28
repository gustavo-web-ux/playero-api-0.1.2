const { transformFormXml } = require('./apikpi/transformData.util');
const { insertDataIntoDatabase } = require('./apikpi/insertToSqlDatabase.util');
const {transformFormXmlPlayero} = require('./apiPlayero/transformDataPlayero.util')
const {insertDataPlayeroIntoDatabase} = require('./apiPlayero/insertToSqlDbPlayero.util')
const {transformFormXmlInicio} = require('./apiInicioCarga/transformDataInicioCarga')
const {insertDataIntoInicioFin} = require('./apiInicioCarga/insertToSqlDbDataInicioFin.util')
const {transformFuelSupplyData} = require('./apiAbastecimientoCombus/transformDataAbas.util')
const {insertDataAbastecimiento} = require('./apiAbastecimientoCombus/insertDataAbas.util')
const {transformFormXmlCalibraPico} = require('./apiCalibracionPico/transformDataCalibraPico.util')
const {insertDataIntoCalibracionesPico} = require('./apiCalibracionPico/insertToSqlDbDataCalibracionPico.util')
const {transformDataTraspaso} = require('./apiTraspasoCombus/transformDataTraspaso.util')


module.exports = {
  insertDataIntoDatabase,
  transformFormXml,
  transformFormXmlPlayero,
  insertDataPlayeroIntoDatabase,
  transformFormXmlInicio,
  insertDataIntoInicioFin,
  transformFuelSupplyData,
  insertDataAbastecimiento,
  transformFormXmlCalibraPico,
  insertDataIntoCalibracionesPico,
  transformDataTraspaso
};
