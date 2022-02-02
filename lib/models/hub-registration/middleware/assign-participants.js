var ObjectId = require('mongodb').ObjectId; 
async function middleware (next) {
  if (!this.isNew) {
    return next();
  }

  const HubClass = require('../../hub-class');
  const HubRegistration = require('../../Hub-registration');

  let classes = await HubClass.findById(this.hubClass);
  this.participants.forEach(async (participant) => {
    let participantID = new ObjectId(participant);
    let oldRegistration = await HubRegistration.find({participants:{$elemMatch:{$eq:participantID}}});

    if (oldRegistration.length) {
      let previousTime = classes.times.filter(time => (time.hubTrainee || []).includes(`${participant}`) && time.start.toString() === oldRegistration[0].start.toString())[0];
      let block = classes.times.indexOf(previousTime);
      if (block >= 0){
        await HubClass.updateOne({'_id': classes._id}, { $pull: { [`times.${block}.hubTrainee`]: `${participant}` } });
      }
    }
  });
  let timeBlock = await classes.times.filter(time => time.start.toString() === this.start.toString())[0];
  let block = classes.times.indexOf(timeBlock);
  if (block >= 0) {
    await HubClass.update({'_id': classes._id}, { $addToSet: { [`times.${block}.hubTrainee`]: this.participants.map(p=>`${p}`) } });
  }

  return next();
}

module.exports = {
  hook: 'pre',
  event: 'save',
  fn: middleware
};
