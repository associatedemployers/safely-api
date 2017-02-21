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
var userSchema = new Schema(_.extend(
  {
    administrative: Boolean,
    company: { type: Schema.Types.ObjectId, ref: 'Company' }
  },
  baseModel.base,
  baseModel.name,
  baseModel.user
));

userSchema.plugin(require('mongoose-cryptify'), {
  paths: [ 'password' ],
  factor: 11
});

userSchema.plugin(require('mongoose-title-case'), {
  paths: [ 'name.first', 'name.middle', 'name.last' ],
  trim: true
});

userSchema.plugin(require('../../adapters/sql').mongoose, {
  documentRecognizer: false,
  ops: []
});

module.exports = require('mongoose-create-model')('User', attachments(userSchema, __dirname));
