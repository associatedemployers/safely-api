/*
  Registration Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      attachments = require('../../util/schema-attachments'),
      baseModel   = require('../'),
      _           = require('lodash');

/*
  Schema
*/
var seatSchema = new Schema(_.extend(
  {
    start:   Date,
    end:     Date,
    trainee: { type: Schema.Types.ObjectId, ref: 'Trainee' },
    seat:    { type: Schema.Types.ObjectId, ref: 'Seat' },
    company: { type: Schema.Types.ObjectId, ref: 'Company' },
    classes: [{ type: Schema.Types.ObjectId, ref: 'Class' }]
  },
  baseModel.base
));

module.exports = require('mongoose-create-model')('Registration', attachments(seatSchema, __dirname));
