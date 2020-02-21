/*
Hub Instructor Model
*/

const mongoose = require('mongoose'),
      Schema = mongoose.Schema,
      attachments = require('../../util/schema-attachments'),
      baseModel = require('../'),
      _ = require('lodash');

/*
Schema
*/
var hubInstructorSchema = new Schema({
  ...baseModel.base,
  firstName: String,
  lastName: String,
  email: String,
  phone: Number,
  location: {
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      zipcode: String
    }
  },
  organization: String,
  created: Date
});

module.exports = require('mongoose-create-model')('HubInstructor', attachments(hubInstructorSchema, __dirname));