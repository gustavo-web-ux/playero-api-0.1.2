const cron = require('node-cron');
const axios = require('axios');

// Ejecutar Cron
const job = cron.schedule('*/10 * * * * *', async () => {
  try {
    /*await axios.get('http://localhost:3000/api/kpi/list-playero');
    await axios.get('http://localhost:3000/api/kpi/abastecimiento');
    await axios.get('http://localhost:3000/api/kpi/calibracion_pico');
    await axios.get('http://localhost:3000/api/kpi/list-inicio');
    await axios.get('http://localhost:3000/api/kpi/traspaso');*/
    console.log('Requests completed successfully');
  } catch (error) {
    console.error('Error making requests:', error);
  }
});

module.exports = job;
