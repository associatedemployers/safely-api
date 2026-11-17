/*
  Seats in use

  Answers "which seats are taken during this window of time?".

  A registration holds one seat for each lab block it books. Each of those is
  an entry in registration.times: { start, end, seat }. The seat is held from
  the start of the block to the last millisecond BEFORE the block ends
  (9:30:00.000 to 11:29:59.999), so the next block can start exactly on time.

  A held time counts against a window when the two OVERLAP at all. It does not
  have to cover the whole window. That matters when block times change: a
  booking made for 8:00-10:00 overlaps both 7:30-9:30 and 9:30-11:30 and must
  keep its seat out of both.

  This file is deliberately not in ./statics, where every file is loaded as a
  method on the Seat model.
*/

const Registration = require('../registration');

// Whether a held time { start, end } overlaps the window from `start` to `end`.
// Both ends are included. Back-to-back blocks do not overlap, because a block
// is held only to the millisecond before the next one starts.
// Asking with `start` and `end` the same asks "is it held at this exact moment?".
function overlapsWindow (heldTime, start, end) {
  return heldTime.start <= end && heldTime.end >= start;
}

// The same rule as a database condition on a registration's `times` list.
// $elemMatch makes both halves apply to ONE entry in the list.
function timesOverlapping (start, end) {
  return {
    $elemMatch: {
      start: { $lte: end },
      end: { $gte: start }
    }
  };
}

function addOnce (seats, seat) {
  const alreadyListed = seats.some(listed => listed.toString() === seat.toString());

  if (!alreadyListed) {
    seats.push(seat);
  }
}

/*
  Finds the registrations that hold a seat during the window, leaving out
  cancelled ones.

  Resolves to:
    seats          every seat held during the window, each listed once
    registrations  the registrations found, with their `times` and `classes`

  A registration with several blocks can hold different seats in each, so
  every overlapping entry is read, not only the first.
*/
function findSeatsInUse (start, end) {
  return Registration.find({
    cancelledOn: null, // matches a missing cancelledOn as well as null
    times: timesOverlapping(start, end)
  }, {
    times: 1,
    classes: 1
  })
    .lean()
    .exec()
    .then(registrations => {
      const seats = [];

      registrations.forEach(registration => {
        registration.times
          .filter(heldTime => heldTime.seat && overlapsWindow(heldTime, start, end))
          .forEach(heldTime => addOnce(seats, heldTime.seat));
      });

      return { seats, registrations };
    });
}

module.exports = {
  overlapsWindow,
  timesOverlapping,
  findSeatsInUse
};
