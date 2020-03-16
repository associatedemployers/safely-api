async function middleware () {
  if (!this.isNew) {
    return;
  }

  const HubClass = require('../../hub-class'),
        HubCompany = require('../../hub-company');

  const [
    hubClass,
    memberStatus
  ] = await Promise.all([
    HubClass.findById(this.hubClass._id || this.hubClass),
    HubCompany.searchForMember(this.email)
  ]);

  console.log('hello?', hubClass);

  if (!hubClass) {
    return;
  }

  const {
    organization,
    price: {
      member,
      nonMember,
      memberAddParticipants,
      nonMemberAddParticipants
    }
  } = hubClass;

  const isClassMember = memberStatus.find(({ org, isMember }) => org === organization && isMember),
        participantPrice = isClassMember ? member : nonMember,
        addParticipantPrice = isClassMember ? memberAddParticipants : nonMemberAddParticipants;

  console.log(isClassMember, participantPrice, addParticipantPrice);

  if (!participantPrice || !addParticipantPrice) {
    this.total = null;
    return;
  }

  console.log(participantPrice + (this.participants.length - 1) * addParticipantPrice);
  this.total = participantPrice + (this.participants.length - 1) * addParticipantPrice;
}

module.exports = {
  hook: 'pre',
  event: 'save',
  fn: middleware
};
