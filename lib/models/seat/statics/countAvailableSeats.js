const Registration = require('../../registration'),
      toString = require('lodash/toString'),
      map = require('lodash/map'),
      find = require('lodash/find');

module.exports = function (start, end, classBlackout) {
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
  .select('times')
  .lean()
  .exec()
  .then(registrations => {
    let seats = registrations.map(reg => reg.times[0].seat);

    return this.count({
      _id: { $nin: seats },
      inactive: { $ne: true }
    })
    .exec()
    .then(count => {
      if (!classBlackout || !classBlackout.seats) {
        return count;
      }

      let classExceptions = map(classBlackout.classExceptions, toString);
      // Filter to find the number of seats we need to disclude from
      // the class specific reduction
      let registeredInException = registrations.filter((reg) => {
        return find(reg.classes, c => classExceptions.indexOf((c._id || c).toString()) > -1);
      });

      let toSubtract = (classBlackout.seats || 0) - (registeredInException.length || 0);
      return count - (toSubtract || 0);
    });
  });
};
