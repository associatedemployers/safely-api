/*
  Available Time Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      attachments = require('../../util/schema-attachments'),
      baseModel   = require('../'),
      _           = require('lodash');

/*
  Schema
*/
var availableTimeSchema = new Schema(_.extend(
  {
    blocks: [[ Number ]],
    days: [ Number ],
    start: Date,
    end: Date
  },
  baseModel.base
));

module.exports = require('mongoose-create-model')('AvailableTime', attachments(availableTimeSchema, __dirname));
