const Trainee = require('../../trainee');
const HubClass = require('../../hub-class');
const HubParticipant = require('../../hub-participant/index');

async function middleware (next) {
  if (this.isNew) {
    const hubClass = await HubClass.findById(this.hubClass);
    const hubParticipantIds = [];
    
    if (hubClass.f2f && Array.isArray(this.hubParticipants)) {

      for (let i = 0; i < this.hubParticipants.length; i++) {
        let hubParticipant = await HubParticipant.findById(this.hubParticipants[i]);

        if (!hubParticipant.ssn) {
          return;
        }

        let trainee = (await Trainee.find({
          ssn: hubParticipant.ssn
        }))[0];

        hubParticipantIds.push(hubParticipant._id);

        if (!trainee) {
          trainee = await (new Trainee({
            ...hubParticipant,
            name:{
              first: hubParticipant.firstName,
              last: hubParticipant.lastName
            },
            ssn: hubParticipant.ssn
          })).save();
        }

        const trainees = Array.isArray(trainee) ? trainee : [ trainee ];
        this.participants = [ ...this.participants, trainees[0]._id ];
      }
    }
    this.hubParticipants = this.hubParticipants.filter((p) => hubParticipantIds.includes(p._id));
  }

  next();
}

module.exports = {
  hook: 'pre',
  event: 'save',
  fn: middleware
};
