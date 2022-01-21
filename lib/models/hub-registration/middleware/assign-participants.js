async function middleware (next) {
  if (!this.isNew) {
    return next();
  }

  const HubClass = require('../../hub-class');

  let classes = await HubClass.findById(this.hubClass);
  let timeBlock = classes.times.filter(time => time.start === this.start)[0];
  let block = classes.times.indexOf(timeBlock);

  await HubClass.updateOne({'times._id': timeBlock._id}, { $addToSet: { [`times.${block}.hubTrainee`]: this.participants } });
  return next();
}

module.exports = {
  hook: 'pre',
  event: 'save',
  fn: middleware
};
