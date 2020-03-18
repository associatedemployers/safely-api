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
  companyName:   String,
  firstName:     String, // registering name
  lastName:      String,
  email:         String,
  cancelledOn:   Date,
  po:            String,
  total:         Number,
  isClassMember: Boolean,
  participants:  [{
    type: Relationship,
    ref: 'HubParticipant'
  }],
  address: {
    line1: String,
    line2: String,
    city: String,
    state: String,
    zipcode: String,
    directions: String
  },
  company: { type: Relationship, ref: 'HubCompany' },
  hubClass: { type: Relationship, ref: 'HubClass' }
});

module.exports = require('mongoose-create-model')('HubRegistration', attachments(hubRegistrationSchema, __dirname));
