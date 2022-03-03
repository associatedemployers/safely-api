exports.create = function*(request, transaction, hash) {  // Insert registration header
  let reg = yield this.record.constructor.populate(this.record, {
    path: 'instructor'
  });

  let classHeader = {
    Instructor:          reg.instructor ? reg.instructor.displayName : 'TBA',
    HubCoursesInfoID:    hash.HubCoursesInfoID,
    Created:             hash.Created,
    ClassCode:           hash.ClassCode,
    HubCoursesID:        hash.HubCoursesID
  };

  let values = this.adapter.prepareRequest(request, classHeader);

  let record = yield request.query(`
    insert into Training.HubCourses ${values}
    select SCOPE_IDENTITY() as ID
  `);

  let sqlIdentifier = record[0].ID,
      query = '';

  if (query.length) {
    yield request.query(query);
  }
  this.record.instructor = hash.Instructor;
  this.record.sqlIdentifier = sqlIdentifier;
  this.record.skipSQLOps = true;
  yield this.record.save();
  yield transaction.commit();
};
