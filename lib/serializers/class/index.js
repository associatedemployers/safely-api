exports.serialize = function (record) {
  return record;
};

exports.deserialize = function (record) {
  if (record.hours % 2) {
    record.hours = Math.ceil(record.hours / 2) * 2; // Round up to the nearest multiple of 2
  }

  return record;
};
