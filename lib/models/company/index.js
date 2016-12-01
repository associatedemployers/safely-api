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
var companySchema = new Schema(_.extend(
  {
    name: String,
    email: String
  },
  baseModel.base
));

module.exports = require('mongoose-create-model')('Company', attachments(companySchema, __dirname));
