const { Schema } = require('mongoose');
const { dbKpiConnection } = require('../database/Mongo.database');

const officeTrackSchema = new Schema(
  {
    base: String,
    codForm: String,
    sync: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = dbKpiConnection.model('officeTrack', officeTrackSchema);
