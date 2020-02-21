/*
Hub Registration Model
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
var hubRegistrationSchema = new Schema({
  ...baseModel.base,
  firstName: String,
  lastName: String,
  participant: {
    type: Relationship, ref: 'Hub-Participants'
  },
  company: { type: Relationship, ref: 'Hub-Company' },
  class: { type: Relationship, ref: 'Hub-Class' },
  created: Date
});

module.exports = require('mongoose-create-model')('HubRegistration', attachments(hubRegistrationSchema, __dirname));