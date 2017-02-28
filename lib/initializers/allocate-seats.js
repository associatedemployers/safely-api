/*
  Initializer - Seats
*/

const co = require('co'),
      winston = require('winston'),
      Seat = require('../models/seat');

exports.init = function () {
  let numberOfSeats = parseFloat(process.env.SAFELY_SEATS || 0);

  return co(function*() {
    let seatCount = yield Seat.count();

    if (seatCount >= numberOfSeats) {
      return;
    }

    for (let i = 0; i < seatCount - numberOfSeats; i++) {
      winston.debug(`Creating seat #${i + 1}`);
      yield (new Seat()).save();
    }

    winston.debug('Finished creating seats.');
  });
};
