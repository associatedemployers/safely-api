const winston = require('winston'),
      Registration = require('../../registration');

module.exports = function (start, end) {
  return Registration.find({
    $or: [{
      cancelledOn: null
    }, {
      cancelledOn: { $exists: false }
    }],
    'times.start': { $lte: start },
    'times.end': { $gte: end }
  }, {
    'times.$': 1
  })
  .lean()
  .exec()
  .then(registrations => {
    winston.debug(`
      ----------------------------------------
      Found Registrations:
      ${JSON.stringify(registrations)}
      ----------------------------------------
    `);

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
