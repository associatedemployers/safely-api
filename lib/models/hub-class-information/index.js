/*
Hub class information Model
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
var hubClassInformationSchema = new Schema({
  ...baseModel.base,
  class:        { type: Relationship, ref: 'HubClass' },
  name:         String,
  description:  String,
  code:         String,
  organization: String
});

module.exports = require('mongoose-create-model')('HubClassInformation', attachments(hubClassInformationSchema, __dirname));