exports.serialize = function (record) {
  delete record.__v;
  return record;
};

exports.deserialize = function (record) {
  return record;
};
