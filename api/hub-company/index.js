const HubCompany = require('../../lib/models/hub-company');

exports.getMemberStatus = function* () {
  const email = (this.request.body.email || '').toLowerCase();

  if (!email || !email.length) {
    this.status = 400;
    return;
  }

  const memberStatus = yield HubCompany.searchForMember(email);

  this.status = 200;
  this.body = {
    memberStatus
  };
};
