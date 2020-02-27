/*
Hub Registration Model
*/

const mongoose     = require('mongoose'),
      Schema       = mongoose.Schema,
      attachments  = require('../../util/schema-attachments'),
      Relationship = Schema.ObjectId;

/*
Schema
*/
var hubRegistrationSchema = new Schema({
  ...require('../').base,
  firstName:    String,   // registering name
  lastName:     String,
  email:        String,
  cancelledOn:  Date,
  po: String,
  participants: {
    type: Relationship,
    ref: 'HubParticipant'
  },
  company: { type: Relationship, ref: 'HubCompany' },
  hubClass: { type: Relationship, ref: 'HubClass' }
});

module.exports = require('mongoose-create-model')('HubRegistration', attachments(hubRegistrationSchema, __dirname));
