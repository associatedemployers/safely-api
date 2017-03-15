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
    select SCOPE_IDENTITY() as BusinessEntityID
    insert into Safely.TraineeProfiles
    (EmployeeNumber, SafelyID, NotificationEmail, PersonID)
    values (@SocialSecurity, @SafelyID, @NotificationEmail, SCOPE_IDENTITY())
    `
  );

  this.record.sqlIdentifier = record[0].BusinessEntityID;
  this.record.skipSQLOps = true;
  yield this.record.save();
  yield transaction.commit();
};

exports.update = function*(request, transaction, hash) {
  let PersonHash = extract(hash, [
    'FirstName',
    'MiddleName',
    'LastName',
    'SafelyID'
  ]);

  let personValues = this.adapter.prepareRequest(request, PersonHash, true);

  yield request.query(`
    update Person.Person
    set ${personValues}
    where BusinessEntityID='${this.record.sqlIdentifier}'
  `);

  yield transaction.commit();
};
