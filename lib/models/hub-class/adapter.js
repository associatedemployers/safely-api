exports.create = function*(request, transaction, hash) {  // Insert registration header
  let reg = yield this.record.constructor.populate(this.record, {
    path: 'instructor'
  });

  let classHeader = {
    Instructor:          reg.instructor ? reg.instructor.displayName : 'TBA',
    HubCoursesInfoID:    hash.HubCoursesInfoID,
    Created:             hash.Created,
    ClassCode:           hash.ClassCode,
    HubCoursesID:        hash.HubCoursesID,
    RegularPrice:        hash.RegularPrice.nonMember
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

exports.update = function*(request, transaction, hash) {
  let reg = yield this.record.constructor.populate(this.record, {
    path: 'instructor'
  });

  let classHeader = {
    Instructor:          reg.instructor ? reg.instructor.displayName : 'TBA',
    HubCoursesInfoID:    hash.HubCoursesInfoID,
    Created:             hash.Created,
    ClassCode:           hash.ClassCode,
    HubCoursesID:        hash.HubCoursesID,
    RegularPrice:        this.record.price.nonMember
  };

  let values = this.adapter.prepareRequest(request, classHeader, true);

  yield request.query(`
   update Training.HubCourses set ${values} where ID='${this.record.sqlIdentifier}'
  `);

  this.record.instructor = hash.Instructor;
  yield transaction.commit();
};
