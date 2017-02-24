exports.serialize = function (record) {
  return record;
};

exports.deserialize = function (record) {
  record.name = {
    first: record['First Name'],
    last: record['Last Name']
  };

  return record;
};
