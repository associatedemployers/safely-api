exports.create = function*(request, transaction, hash) {
  // Insert registration header
  let reg = yield this.record.constructor.populate(this.record, [{
    path: 'company'
  }, {
    path: 'creator'
  }, {
    path: 'trainee'
  }, {
    path: 'classes'
  }]);

  let registrationHeader = {
    RegistrationDate:     hash.RegistrationDate,
    CancelledOn:          hash.CancelledOn,
    Comment:              hash.Comment,
    RegistrationStatusID: '1',
    PersonID:             reg.trainee ? reg.trainee.sqlIdentifier : null,
    MemberID:             reg.company ? reg.company.sqlIdentifier : null,
    MemberPersonID:       reg.creator ? reg.creator.sqlIdentifier : null
  };

  let values = this.adapter.prepareRequest(request, registrationHeader);

  let record = yield request.query(`
    insert into Safely.Registrations ${values}
    select SCOPE_IDENTITY() as RegistrationID
  `);

  let sqlIdentifier = record[0].RegistrationID,
      query = '';

  reg.classes.forEach((course, i) => {
    let courseVar = `Course${i}Id`;

    request.input(courseVar, course.sqlIdentifier);

    query += `
      insert into Safely.RegistrationLines
      (CourseID, RegistrationHeaderID)
      values (@${courseVar}, '${sqlIdentifier}')
    `;
  });

  if (query.length) {
    yield request.query(query);
  }

  this.record.sqlIdentifier = sqlIdentifier;
  this.record.skipSQLOps = true;
  yield this.record.save();
  yield transaction.commit();
};
