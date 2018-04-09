/*
  Trainee Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      v = require('mongoose-validators'),
      baseModel   = require('../'),
      attachments = require('../../util/schema-attachments'),
      _           = require('lodash');

/*
  Schema
*/
var traineeSchema = new Schema(_.extend(
  {
    company: [{ type: Schema.Types.ObjectId, ref: 'Company' }],
    ssn:  {
      type: String,
      required: true,
      unique: true,
      validate: [
        v.matches(/\d{3}-\d{2}-\d{4}/)
      ]
    },
    email: String
  },
  baseModel.base,
  baseModel.name
), { minimize: false, background: false });

traineeSchema.plugin(require('mongoose-cryptify'), {
  paths: [ 'password' ],
  factor: 11
});

traineeSchema.plugin(require('mongoose-title-case'), {
  paths: [ 'name.first', 'name.middle', 'name.last' ],
  trim: true
});

traineeSchema.plugin(require('../../adapters/sql').mongoose, {
  documentRecognizer: true,
  ops: [ 'create', 'update' ]
});

let Trainee = require('mongoose-create-model')('Trainee', attachments(traineeSchema, __dirname));
Trainee.on('index', (err) => {
  if (err) {
    return console.error('Error creating indexes:', err);
  }

  console.log('Created indexes');
});

module.exports = Trainee;
