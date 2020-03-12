/*
Hub Participant Model
*/

const mongoose     = require('mongoose'),
      Schema       = mongoose.Schema,
      attachments  = require('../../util/schema-attachments'),
      Relationship = Schema.ObjectId;

/*
Schema
*/
var hubParticipantSchema = new Schema({
  ...require('../').base,
  firstName:     String,
  lastName:      String,
  email:         String,
  phone:         Number,
  company:       { type: Relationship, ref: 'HubCompany' }
});

module.exports = require('mongoose-create-model')('HubParticipant', attachments(hubParticipantSchema, __dirname));
