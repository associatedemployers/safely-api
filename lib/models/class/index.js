/*
  Class Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      attachments = require('../../util/schema-attachments'),
      baseModel   = require('../'),
      _           = require('lodash');

/*
  Schema
*/
var classSchema = new Schema(_.extend(
  {
    name: String,
    description: String,
    hours: Number
  },
  baseModel.base
));

module.exports = require('mongoose-create-model')('Class', attachments(classSchema, __dirname));
