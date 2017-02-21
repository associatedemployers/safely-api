/*
  Trainee Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      baseModel   = require('../'),
      attachments = require('../../util/schema-attachments'),
      _           = require('lodash');

/*
  Schema
*/
var traineeSchema = new Schema(_.extend(
  {
    company: [{ type: Schema.Types.ObjectId, ref: 'Company' }],
    ssn: String,
    email: String
  },
  baseModel.base,
  baseModel.name
), { minimize: false });

traineeSchema.plugin(require('mongoose-cryptify'), {
  paths: [ 'password' ],
  factor: 11
});

traineeSchema.plugin(require('mongoose-title-case'), {
  paths: [ 'name.first', 'name.middle', 'name.last' ],
  trim: true
});

traineeSchema.plugin(require('../../adapters/sql').mongoose, {
  documentRecognizer: false,
  ops: [ 'create', 'update' ]
});

module.exports = require('mongoose-create-model')('Trainee', attachments(traineeSchema, __dirname));
