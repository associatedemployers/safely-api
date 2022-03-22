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
  code: String,
  digitalUrl: String,
  rosterAccessKey: String,
  emailConfirmationBody: String,
  digital: Boolean,
  generateTimes: Boolean,
  generateTimeRef:{dayRef:{}, timeBlock:{start:{hour:Number,min:Number}, end:{hour:Number,min:Number}}},
  f2f: Boolean,
  times:   [{ start: Date, end: Date }],
  seats:   Number
});

hubClassSchema.plugin(require('../../adapters/sql').mongoose, {
  documentRecognizer: false,
  ops: [ 'create', 'remove', 'update' ]
});

module.exports = require('mongoose-create-model')('HubClass', attachments(hubClassSchema, __dirname));
