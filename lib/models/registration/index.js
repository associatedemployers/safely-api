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
var seatSchema = new Schema(_.extend(
  {
    start:   { type: Date, required: true },
    end:     Date,
    times:   [ timeSchema ],
    trainee: { type: Schema.Types.ObjectId, ref: 'Trainee' },
    company: { type: Schema.Types.ObjectId, ref: 'Company' },
    classes: [{ type: Schema.Types.ObjectId, ref: 'Class' }]
  },
  baseModel.base
));

module.exports = require('mongoose-create-model')('Registration', attachments(seatSchema, __dirname));
