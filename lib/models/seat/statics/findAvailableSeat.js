const winston = require('winston'),
      { findSeatsInUse } = require('../seats-in-use');

// The lowest numbered active seat that nobody holds between `start` and `end`.
// Resolves to undefined when every seat is taken.
module.exports = function (start, end) {
  return findSeatsInUse(start, end)
    .then(inUse => {
      winston.debug(`
      ----------------------------------------
      Found Registrations:
      ${JSON.stringify(inUse.registrations)}
      ----------------------------------------
    `);

      return this.find({
        _id: { $nin: inUse.seats },
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
