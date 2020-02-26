/*
  Hub Class Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      attachments = require('../../util/schema-attachments'),
      baseModel   = require('../'),
      Relationship = Schema.ObjectId,
      _           = require('lodash');

/*
  Schema
*/
var hubClassSchema = new Schema({
  ...baseModel.base,
  organization: String,
  instructor: {
    type: Relationship,
    ref:  'HubInstructor'
  },
  classInformation: {
    type: Relationship,
    ref: 'HubClassInformation'
  },
  location: {
    name: String,
    geo: {
      type: {
        type: String,
        enum: [ 'Point' ]
      },
      coordinates: {
        type: [ Number ]
      }
    },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      zipcode: String,
      directions: String
    }
  },
  price: {
    member:                   Number,
    nonMember:                Number,
    memberAddParticipants:    Number,
    nonMemberAddParticipants: Number
  },
  times:   [{ start: Date, end: Date }],
  seats:   Number,
  created: Date
});

module.exports = require('mongoose-create-model')('HubClass', attachments(hubClassSchema, __dirname));
