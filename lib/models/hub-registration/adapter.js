exports.create = function*(request, transaction, hash) {
  // Insert registration header
  let reg = yield this.record.constructor.populate(this.record, [ {
    path: 'hubParticipants'
  }, {
    path: 'participants'
  }, {
    path: 'company'
  }, {
    path: 'creator'
  }]);

  let registrationHeader = {
    HubRegistrationDate:  hash.HubRegistrationDate,
    Comment:              hash.Comment || '',
    HASCWebsiteEnteredFlag: true,
    MemberID:             reg.company ? reg.company.sqlIdentifier : null,
    MemberPersonID:       reg.creator ? reg.creator.sqlIdentifier : null,
    CardPrintedFlag:      reg.cardPrintedFlag || false
  };

  if (hash.CancelledOn) {
    registrationHeader.CancelledOn = hash.CancelledOn;
  }

  let values = this.adapter.prepareRequest(request, registrationHeader);

  let record = yield request.query(`
    insert into Safely.HubRegistrations ${values}
    select SCOPE_IDENTITY() as HubRegistrationID
  `);

  let sqlIdentifier = record[0].HubRegistrationID,
      query = '';

  let pars = [];

  reg.participants.forEach((participant, i) => {
    let participantVar = `Participant${i}Id`;
    let participantID = participant._id || participant.id || participant;
    pars.push(participantID);
    request.input(participantVar, participant.sqlIdentifier);

    query += `
      insert into Safely.HubRegistrationLines
      (ParticipantID, HubRegistrationHeaderID, ClassID, RegistrationStatusID, CourseStatusID)
      values (@${participantVar}, '${sqlIdentifier}', '${hash.HubClass}', '1', '3')
    `;
  });

  if (query.length) {
    yield request.query(query);
  }
  this.record.company = reg.company._id;
  this.record.participants = pars;
  this.record.creator = reg.creator._id;
  this.record.sqlIdentifier = sqlIdentifier;
  this.record.skipSQLOps = true;
  yield this.record.save();
  yield transaction.commit();
};

exports.update = function*(request, transaction, hash) {
  let reg = yield this.record.constructor.populate(this.record, [ {
    path: 'participants'
  }]);

  let sqlIdentifiers = reg.participants.map(participant => participant.sqlIdentifier);

  yield request.query(`
    delete Safely.HubRegistrationLines
    where HubRegistrationHeaderID='${this.record.sqlIdentifier}' and ParticipantID not in (${sqlIdentifiers.join(',')})
  `);

  yield transaction.commit();
};

exports.remove = function*(request, transaction, hash) {
  yield request.query(`
    delete Safely.HubRegistrations
    where HubRegistrationHeaderID='${this.record.sqlIdentifier}'
  `);

  yield request.query(`
    delete Safely.HubRegistrationLines
    where HubRegistrationHeaderID='${this.record.sqlIdentifier}'
  `);
  yield transaction.commit();
};
