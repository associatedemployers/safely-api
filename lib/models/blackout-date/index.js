/*
  Blackout Date Model
*/

const mongoose     = require('mongoose'),
      Schema       = mongoose.Schema,
      Relationship = Schema.ObjectId,
      attachments  = require('../../util/schema-attachments'),
      baseModel    = require('../'),
      _            = require('lodash');

/*
  Schema
*/
var blackoutDateSchema = new Schema(_.extend(
  {
    start: Date,
    end: Date,
    seats: Number,

    classExceptions: [{ type: Relationship, ref: 'Class' }],
    blocks: [[ Number ]]
  },
  baseModel.base
));

module.exports = require('mongoose-create-model')('BlackoutDate', attachments(blackoutDateSchema, __dirname));
