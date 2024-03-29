/*
Hub Registration Model
*/

const mongoose     = require('mongoose'),
      Schema       = mongoose.Schema,
      attachments  = require('../../util/schema-attachments'),
      Relationship = Schema.ObjectId,
      _           = require('lodash');

/*
Schema
*/
var hubRegistrationSchema = new Schema(_.extend(
  {
    ...require('../').base,
    companyName:   String,
    firstName:     String, // registering name
    lastName:      String,
    email:         String,
    cancelledOn:   Date,
    po:            String,
    total:         Number,
    isClassMember: Boolean,
    hubParticipants:  [{
      type: Relationship,
      ref: 'HubParticipant'
    }],
    participants:  [{
      type: Relationship,
      ref: 'Trainee'
    }],
    start: Date,
    end:   Date,
    creator:  {
      type: Relationship,
      ref: 'User'
    },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      zipcode: String,
      directions: String
    },
    hubClass: { type: Relationship, ref: 'HubClass' },
    company: { type: Schema.Types.ObjectId, ref: 'Company' }
  }));

hubRegistrationSchema.plugin(require('../../adapters/sql').mongoose, {
  documentRecognizer: false,
  ops: [ 'create', 'update', 'remove' ]
});

module.exports = require('mongoose-create-model')('HubRegistration', attachments(hubRegistrationSchema, __dirname));
