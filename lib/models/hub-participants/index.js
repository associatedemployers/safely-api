/*
Hub Participant Model
*/

const mongoose = require('mongoose'),
      Schema = mongoose.Schema,
      attachments = require('../../util/schema-attachments'),
      baseModel = require('../'),
      Relationship = Schema.ObjectId,
      _ = require('lodash');

/*
Schema
*/
var hubParticipantSchema = new Schema({
  ...baseModel.base,
  firstName: String,
  lastName: String,
  email: String,
  phone: Number,
  company: { type: Relationship, ref: 'HubCompany' },
  registrations: { type: Relationship, ref: 'HubRegistration' },
  created: Date
});

module.exports = require('mongoose-create-model')('HubParticipant', attachments(hubParticipantSchema, __dirname));