/*
  Operation Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      attachments = require('../../util/schema-attachments'),
      baseModel   = require('../'),
      _           = require('lodash');

/*
  Schema
*/
var opSchema = new Schema(_.extend(
  {
    name: String,
    model: String,
    completed: Date
  },
  baseModel.base
));

module.exports = require('mongoose-create-model')('Op', attachments(opSchema, __dirname));
