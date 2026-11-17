const toString = require('lodash/toString'),
      map = require('lodash/map'),
      { findSeatsInUse } = require('../seats-in-use');

// How many of a blackout's reserved seats are still waiting for the classes
// they were reserved for. Never less than zero.
function reservedSeatsStillHeldBack (classBlackout, registrations) {
  const reservedFor = map(classBlackout.classExceptions, toString);

  const alreadyRegistered = registrations.filter(registration => {
    return (registration.classes || []).some(c => reservedFor.indexOf((c._id || c).toString()) > -1);
  });

  return Math.max(classBlackout.seats - alreadyRegistered.length, 0);
}

/*
  How many active seats nobody holds between `start` and `end`.

  When a blackout reserves seats for certain classes (`classBlackout.seats`),
  the reserved seats that those classes have not used yet are held back, so the
  answer is how many seats everyone else may still book.
*/
module.exports = function (start, end, classBlackout) {
  return findSeatsInUse(start, end)
    .then(inUse => {
      return this.count({
        _id: { $nin: inUse.seats },
        inactive: { $ne: true }
      })
        .exec()
        .then(freeSeats => {
          if (!classBlackout || !classBlackout.seats) {
            return freeSeats;
          }

          return Math.max(freeSeats - reservedSeatsStillHeldBack(classBlackout, inUse.registrations), 0);
        });
    });
};
