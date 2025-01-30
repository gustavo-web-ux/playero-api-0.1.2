const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');

// Importar rutas
const route = require('./routes/init');
const authRoutes = require('./routes/authSap.routes');
const authRoutesNew = require('./routes/authRoutes');
const permissionsRoutes = require('./routes/permissionsRoutes');
const protectedRoutes = require('./routes/protected.routes');

// Initializing createRoles and connectToDatabase
require('./libs/initialSetup.lib').createRoles();
require('./database/SqlServer.database').connectToDatabase();
require('./database/Mongo.database');

// Config express middleware
const corsOptions = {
  origin: [
    'https://192.168.10.233:2421',
    'http://192.168.10.233:2421',
    'https://190.104.134.250:2421',
    'http://190.104.134.250:2421',
    'http://playero.tecnoedilsa.com.py:2421',
    'http://playero.tecnoedilsa.com.py:4200',
    'https://playero.tecnoedilsa.com.py:2421',
    'https://playero.tecnoedilsa.com.py:4200',
    'http://192.168.10.235:4200',
    'http://localhost:3000',
    'http://localhost:4000',
    'http://localhost:3001',
    'http://localhost:3002'
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true, // Permitir el envío de cookies y encabezados de autorización
};

// Aplicar middleware de CORS
app.use(cors(corsOptions));

// Configurar otros middleware
app.use(express.text({ limit: '35mb' }));
app.use(morgan('dev'));
app.use(express.json());
app.use(bodyParser.json());
app.use(cookieParser());

// Configurar Helmet para seguridad
app.use(
  helmet({
    hidePoweredBy: true,
    xssFilter: true,
    noSniff: true,
    frameguard: { action: 'deny' },
  })
);

// Rutas (por ahora solo un ejemplo)
app.get('/', (req, res) => {
  res.send('API funcionando');
});

// Definir rutas
// esta direccion se cambio /api/kpi a /api/playero
//app.use('/api/kpi', route.kpiRoute);
app.use('/api/playero', route.playeroRoute);
app.use('/api/playero', route.authRoute);
app.use('/api/playero', route.userRoute);
app.use('/api/sap/auth', authRoutes);
app.use('/api/sap', protectedRoutes);
app.use('/api/report', route.reportRoute);
app.use('/api/auth', authRoutesNew);
app.use('/api/permisos', permissionsRoutes);

module.exports = app;

