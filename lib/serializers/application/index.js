const { toString } = require('lodash');

exports.serialize = function (record) {
  delete record.__v;
  record.SafelyID = toString(record._id);
  delete record._id;
  return record;
};

exports.deserialize = function (record) {
  return record;
};
