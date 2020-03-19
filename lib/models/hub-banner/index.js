/*
  Hub Banner Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      attachments = require('../../util/schema-attachments'),
      baseModel   = require('../');

/*
  Schema
*/
const hubBannerSchema = new Schema({
  ...baseModel.base,
  heading: String,
  body: String,
  link: String,
  color: String
});

module.exports = require('mongoose-create-model')('HubBanner', attachments(hubBannerSchema, __dirname));
