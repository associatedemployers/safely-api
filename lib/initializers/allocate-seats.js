/*
  Initializer - Seats
*/

const co = require('co'),
      winston = require('winston'),
      Seat = require('../models/seat');

exports.init = function () {
  let numberOfSeats = parseFloat(process.env.SAFELY_SEATS || 0);

  return co(function*() {
    winston.debug(`Making sure there are ${numberOfSeats} seats available`);
    let seatCount = yield Seat.count();
    winston.debug(`Current seat count is ${seatCount}`);

    if (seatCount >= numberOfSeats) {
      winston.debug('Suitable number of seats. Exiting...');
      return;
    }

    for (let i = 0; i < numberOfSeats - seatCount; i++) {
      winston.debug(`Creating seat #${i + 1}`);
      yield (new Seat()).save();
    }

    winston.debug('Finished creating seats.');
  });
};
