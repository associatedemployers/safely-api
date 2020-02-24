/*
Hub Instructor Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      attachments = require('../../util/schema-attachments');

/*
Schema
*/
var hubInstructorSchema = new Schema({
  ...require('../').base,
  firstName:    String,
  lastName:     String,
  email:        String,
  phone:        Number,
  organization: String
});

module.exports = require('mongoose-create-model')('HubInstructor', attachments(hubInstructorSchema, __dirname));
