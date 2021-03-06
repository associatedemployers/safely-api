/*
  Company Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      attachments = require('../../util/schema-attachments'),
      baseModel   = require('../'),
      _           = require('lodash');

/*
  Schema
*/
var companySchema = new Schema(_.extend(
  {
    name: String,
    email: String
  },
  baseModel.base
));


companySchema.plugin(require('../../adapters/sql').mongoose, {
  documentRecognizer: true,
  ops: []
});

module.exports = require('mongoose-create-model')('Company', attachments(companySchema, __dirname));
