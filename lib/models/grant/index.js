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
  baseModel.base,
  {
    token: String,
    salt: String,
    expires: Date
  }
));

module.exports = require('mongoose-create-model')('Grant', attachments(grantSchema, __dirname));
