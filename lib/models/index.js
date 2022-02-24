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
    first: {
      type: String,
      required: true,
      validate: validations.isLength(1)
    },
    middle: String,
    last: {
      type: String,
      required: true,
      validate: validations.isLength(1)
    }
  }
};

exports.user = {
  email: {
    type:      String,
    validate:  validations.isEmail(),
    index:     true,
    lowercase: true,
    trim:      true
  },
  password: String,
  hubUser: Boolean
};
