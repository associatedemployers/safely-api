exports.create = function*(request, transaction, hash) {
  // Insert registration header
  let reg = yield this.record.constructor.populate(this.record, [ {
    path: 'participants'
  }, {
    path: 'hubClass'
  }]);

  let registrationHeader = {
    HubRegistrationDate:  hash.HubRegistrationDate,
    CancelledOn:          hash.CancelledOn,
    Comment:              hash.Comment
  };

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
    pars.push(participant._id);
    request.input(participantVar, participant.sqlIdentifier);

    query += `
      insert into Safely.HubRegistrationLines
      (ParticipantID, HubRegistrationHeaderID, ClassID)
      values (@${participantVar}, '${sqlIdentifier}', '${hash.HubClass}')
    `;
  });

  if (query.length) {
    yield request.query(query);
  }
  
  this.record.participants = pars;
  this.record.hubClass = hash.HubClass;
  this.record.sqlIdentifier = sqlIdentifier;
  this.record.skipSQLOps = true;
  yield this.record.save();
  yield transaction.commit();
};
