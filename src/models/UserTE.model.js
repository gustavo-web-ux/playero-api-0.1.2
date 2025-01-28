const { Schema } = require('mongoose');
const { dbUsersTeConnection } = require('../database/Mongo.database');

const userSchema = new Schema(
  {
    nombres: { type: String },
    apellidos: { type: String },
    fecha_nac: { type: Date },
    cargo: { type: String },
    telefono: { type: String },
    username: { type: String, unique: true },
    password: { type: String },
    token: { type: String },
    origen: { type: String },
    jefe_directo: { type: String },
    rol: { type: String, enum: ['admin'] },
    ci: { type: String, unique: true },
    unidadNegocio: { type: String },
    // Los líderes tienen asociado un array de colaboradores
    colaboradores: [
      {
        userId: { type: String }
      }
    ],

    // Cada usuario tiene asociado un array de modulos
    modulos: [
      {
        modulo: {
          type: String,
          required: false
        }
      }
    ],
    tokenUrl: { type: String },
    employeeStartDate: {
      type: Date
    },
    nif: {
      type: String
    },
    idAplicacion: {
      type: String
    },
    correo: {
      type: String
    }
  }
);

module.exports = dbUsersTeConnection.model('user', userSchema);
