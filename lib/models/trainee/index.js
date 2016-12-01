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
  baseModel.base,
  baseModel.user,
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company' }
  }
), { minimize: false });

traineeSchema.plugin(require('mongoose-cryptify'), {
  paths: [ 'password' ],
  factor: 11
});

traineeSchema.plugin(require('mongoose-title-case'), {
  paths: [ 'name.first', 'name.middle', 'name.last' ],
  trim: true
});

module.exports = require('mongoose-create-model')('Trainee', attachments(traineeSchema, __dirname));
