const moment = require('moment'),
      Registration = require('../../registration');

module.exports = function (start, end) {
  console.log(`Querying for registrations in ${moment(start).format('M/D h:mma')} - ${moment(end).format('M/D h:mma')}`);
  return Registration.find({
    cancelledOn: { $not: { $type: 9 } },
  //   'times.start': { $lte: start },
  //   'times.end': { $gte: end }
  // }, {
  //   'times.$': 1
  })
  .lean()
  .exec()
  .then(registrations => {
    console.log('found registrations', registrations);
    let seats = registrations.map(reg => reg.times[0].seat);
    return this.find({
      _id: { $nin: seats },
      inactive: { $ne: true }
    })
    .sort({
      number: 1
    })
    .limit(1)
    .lean()
    .exec();
  })
  .then(seats => seats[0]);
};
