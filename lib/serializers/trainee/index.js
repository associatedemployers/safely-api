exports.serialize = function (record) {
  if (record.name) {
    record.FirstName = record.name.first;
    record.MiddleName = record.name.middle;
    record.LastName = record.name.last;
    delete record.name;
  }

  if (record.SocialSecurity) {
    record.SocialSecurity = record.SocialSecurity.replace(/-/g, '');
  }

  return record;
};

exports.deserialize = function (record) {
  record.name = {
    first: record.FirstName,
    middle: record.MiddleName,
    last: record.LastName
  };

  if (record.ssn) {
    record.ssn = record.ssn.replace(/-/g, '').replace(/(\d{3})(\d{2})(\d{4}).*/, '$1-$2-$3');
  }

  return record;
};
