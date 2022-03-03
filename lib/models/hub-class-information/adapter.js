exports.create = function*(request, transaction, hash) {
  let classHeader = {
    HubCoursesInfoID:    hash.HubCoursesInfoID,
    Name:                hash.Name,
    Description:         hash.Description,
    Created:             hash.Created
  };

  let values = this.adapter.prepareRequest(request, classHeader);

  let record = yield request.query(`
    insert into Training.HubCoursesInfo ${values}
    select SCOPE_IDENTITY() as ID
  `);

  let sqlIdentifier = record[0].ID,
      query = '';

  if (query.length) {
    yield request.query(query);
  }

  this.record.sqlIdentifier = sqlIdentifier;
  this.record.skipSQLOps = true;
  yield this.record.save();
  yield transaction.commit();
};
