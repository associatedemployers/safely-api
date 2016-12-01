/*
  Grant Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      baseModel   = require('../'),
      attachments = require('../../util/schema-attachments'),
      _           = require('lodash');

/*
  Schema
*/
var grantSchema = new Schema(_.extend(
  {
    token: String,
    salt: String,
    expires: Date
  },
  baseModel.base
));

module.exports = require('mongoose-create-model')('Grant', attachments(grantSchema, __dirname));
