/*
  Hub Company Model
*/

const mongoose    = require('mongoose'),
      Schema      = mongoose.Schema,
      attachments = require('../../util/schema-attachments');

/*
  Schema
*/
const hubCompanySchema = new Schema({
  ...require('../').base,
  name: String,
  email: String
});

// companySchema.plugin(require('../../adapters/sql').mongoose, {
//   documentRecognizer: true,
//   ops: []
// });

module.exports = require('mongoose-create-model')('HubCompany', attachments(hubCompanySchema, __dirname));
