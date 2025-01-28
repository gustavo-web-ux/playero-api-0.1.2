// routes/kpiRoutes.js
const express = require('express');
const { downloadExcel } = require('../controllers/excelReport');
const getParams = require('../controllers/report.controller');
const router = express.Router();

// Definir la ruta para la descarga del archivo Excel
router.post('/downloadExcel', downloadExcel);
router.post('/getParams', getParams.getParams);
module.exports = router;
