/*
  User Model
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
  baseModel.base,
  {
    name: String,
    description: String,
    hours: Number
  }
));

module.exports = require('mongoose-create-model')('Class', attachments(classSchema, __dirname));
