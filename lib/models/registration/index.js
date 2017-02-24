/*
  Registration Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      attachments = require('../../util/schema-attachments'),
      baseModel   = require('../'),
      _           = require('lodash');

let timeSchema = new Schema({
  start: Date,
  end:   Date,
  seat:  { type: Schema.Types.ObjectId, ref: 'Seat' }
});

/*
  Schema
*/
var registrationSchema = new Schema(_.extend(
  {
    start:       { type: Date, required: true },
    end:         Date,
    cancelledOn: Date,
    times:       [ timeSchema ],

    trainee: { type: Schema.Types.ObjectId, ref: 'Trainee' },
    company: { type: Schema.Types.ObjectId, ref: 'Company' },
    classes: [{ type: Schema.Types.ObjectId, ref: 'Class' }],
    creator: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  baseModel.base
));

registrationSchema.plugin(require('../../adapters/sql').mongoose, {
  documentRecognizer: false,
  ops: [ 'create', 'update', 'remove' ]
});

module.exports = require('mongoose-create-model')('Registration', attachments(registrationSchema, __dirname));
