const winston = require('winston'),
      Registration = require('../../registration');

module.exports = function (start, end) {
  return Registration.find({
    cancelledOn: { $not: { $type: 9 } },
    'times.start': { $lte: start },
    'times.end': { $gte: end }
  }, {
    'times.$': 1
  })
  .select('times')
  .lean()
  .exec()
  .then(registrations => {
    let seats = registrations.map(reg => reg.times[0].seat);

    return this.count({
      _id: { $nin: seats },
      inactive: { $ne: true }
    })
    .exec();
  });
};
