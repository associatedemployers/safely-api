const extract = require('../../util/extract-values');

exports.create = function*(request, transaction, hash) {
  let PersonHash = extract(hash, [
    'FirstName',
    'MiddleName',
    'LastName',
    'SocialSecurity',
    'SafelyID'
  ]);

  let personValues = this.adapter.prepareRequest(request, PersonHash);
  request.input('NotificationEmail', hash.NotificationEmail);

  let record = yield request.query(
    `
    insert into Person.Person ${personValues}
    select SCOPE_IDENTITY() as PersonID
    insert into Safely.TraineeProfiles
    (EmployeeNumber, SafelyID, NotificationEmail, PersonID)
    values (@SocialSecurity, @SafelyID, @NotificationEmail, SCOPE_IDENTITY())
    `
  );

  this.record.sqlIdentifier = record.PersonID;
  this.record.skipSQLOps = true;
  yield this.record.save();
  yield transaction.commit();
};
