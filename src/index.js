//const job = require('./cron/SyncKpi.Cron');
const config = require('./config/server.config');
const app = require('./app');

app.listen(config.PORT);
//job.start();

console.log('Server listen on port', config.PORT);
