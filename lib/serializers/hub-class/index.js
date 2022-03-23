exports.serialize = function (record) {
  if (record.instructor) {
    record.instructor = record.instructor._id;
  }
  return record;
};

exports.deserialize = function (record) {
  return record;
};
