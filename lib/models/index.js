const validations = require('mongoose-validators');

exports.base = {
  created: {
    type: Date,
    default: Date.now,
    index: true
  }
};

exports.name = {
  name: {
    first: String,
    middle: String,
    last: String
  }
};

exports.user = {
  email: {
    type: String,
    validate: validations.isEmail(),
    index: true
  },
  password: String
};
