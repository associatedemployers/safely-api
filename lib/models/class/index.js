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

classSchema.plugin(require('../../adapters/sql').mongoose, {
  documentRecognizer: true,
  ops: []
});

module.exports = require('mongoose-create-model')('Class', attachments(classSchema, __dirname));
