async function middleware (next) {
  if (!this.isNew) {
    return next();
  }

  const HubClass = require('../../hub-class');

  let classes = await HubClass.findById(this.hubClass);
  let timeBlock = await classes.times.filter(time => time.start.toString() === this.start.toString())[0];
  let block = classes.times.indexOf(timeBlock);
  
  await HubClass.update({'_id': classes._id}, { $addToSet: { [`times.${block}.hubTrainee`]: this.participants } });
  return next();
}

module.exports = {
  hook: 'pre',
  event: 'save',
  fn: middleware
};
