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
  displayName:  String,
  email:        String,
  phone:        Number,
  organization: String,
  f2f:          Boolean
});

module.exports = require('mongoose-create-model')('HubInstructor', attachments(hubInstructorSchema, __dirname));
