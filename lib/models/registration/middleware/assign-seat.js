const co      = require('co'),
      moment  = require('moment'),
      winston = require('winston'),
      Promise = require('bluebird'),
      _       = require('lodash'),
      blocks  = [ [ 8, 10 ], [ 10, 12 ], [ 12, 14 ], [ 14, 16 ] ];

let findBlock = time => _.findIndex(blocks, block => time.hour() >= block[0] && time.hour() <= block[1]);

function middleware (next) {
  if ( this._disableAssignment ) {
    return next();
  }

  const Seat = require('../../seat'),
        Class = require('../../class'),
        BlackoutDate = require('../../blackout-date'),
        Registration = this.constructor;

  let registration = this;

  let inBlackoutDate = date => {
    let day = moment(date).day();

    // Check to see if the date falls in a weekend,
    // if so, return that it is in a blackout without
    // hitting the db.
    if ( moment(date).hour() >= blocks[blocks.length - 1][1] || day === 0 || day === 6 ) {
      return Promise.resolve(true);
    }

    // If we are not in a weekend, hit the db
    // to see if we are in a user set blackout
    // date.
    return BlackoutDate.findOne({
      start: { $lte: date },
      end: { $gte: date }
    }).exec()
    .then(blackout => !!blackout);
  };

  let incrementBlock = time => {
    return findBlock(time) === blocks.length - 1 ? time.add(1, 'day').hour(8) : time.add(2, 'hours')
  };

  let findNextBlock = function*(start) {
    while ( yield inBlackoutDate(start.toDate()) ) {
      incrementBlock(start);
    }

    return start;
  };

  co(function*() {
    let classes = yield Class.find({ _id: { $in: registration.classes } }).exec();
    registration.hours = classes.reduce((s, c) => s + c.hours, 0);

    let start = moment(registration.start),
        startBlock = findBlock(start);

    if ( startBlock < 0 ) {
      throw new Error('Start date is out of range');
    }

    winston.debug(`
      Found start date in preset blocks. Is in block: ${blocks[startBlock][0]}-${blocks[startBlock][1]}.
      Finding ${registration.hours / 2} blocks to satisfy ${registration.hours} class hours.
    `);

    start = start.hour(blocks[startBlock][0]).startOf('hour');

    for (let i = 0; i < registration.hours / 2; i++) {
      winston.debug(`On registration block ${i + 1} of ${registration.hours / 2}`);
      yield findNextBlock(start);
      winston.debug(`Found next block ${moment(start).format('M/D h:mma')}`);

      let regStart = start.toDate(),
          regEnd = moment(start).add(1, 'hour').endOf('hour').toDate();

      winston.debug(`
        Pushing time and finding seat for block:
        ${moment(regStart).format('M/D h:mma')} - ${moment(regEnd).format('M/D h:mma')}
      `);

      let seat = yield Seat.findAvailableSeat(regStart, regEnd);

      if ( !seat ) {
        throw new Error(`No seat could be found for ${moment(regStart).format('M/D h:mma')} - ${moment(regEnd).format('M/D h:mma')}`);
      }

      registration.times.push({
        seat,
        start: regStart,
        end: regEnd
      });

      winston.debug(`
        Pushed time block:
        ${registration.times[registration.times.length - 1]}
      `);

      incrementBlock(start);
    }
  })
  .then(() => next()).catch(next);
}

module.exports = {
  hook: 'pre',
  event: 'save',
  fn: middleware
};
