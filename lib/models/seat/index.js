/*
  Seat Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      attachments = require('../../util/schema-attachments'),
      baseModel   = require('../'),
      _           = require('lodash');

/*
  Schema
*/
var seatSchema = new Schema(_.extend(
  baseModel.base,
  {

  }
));

module.exports = require('mongoose-create-model')('Seat', attachments(seatSchema, __dirname));
