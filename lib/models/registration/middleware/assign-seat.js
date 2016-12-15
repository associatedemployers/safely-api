const co      = require('co'),
      moment  = require('moment'),
      winston = require('winston'),
      _       = require('lodash');

let findBlockInArray = (a, time) => _.find(a, block => moment(time).hour() >= block[0] && moment(time).hour() < block[1]);

function middleware (next) {
  if ( this._disableAssignment || !this.isNew ) {
    return next();
  }

  const Seat = require('../../seat'),
        Class = require('../../class'),
        BlackoutDate = require('../../blackout-date'),
        AvailableTime = require('../../available-time');

  let registration = this;

  let findBlock = time => {
    let _time = moment(time).toDate();

    return AvailableTime.find({
      $or: [{
        start: { $lte: _time },
        end: { $exists: false }
      }, {
        start: { $lte: _time },
        end: { $gte: _time }
      }, {
        start: { $exists: false },
        end: { $exists: false }
      }],
      days: { $in: [ moment(_time).day() ] }
    }).exec()
    .reduce((b, t) => b.concat(t.blocks), [])
    .then(a => [ a, findBlockInArray(a, _time) ]);
  };

  let inBlackoutDate = function*(date) {
    // Hit the db to see if we are in a user
    // set blackout date or block.
    return !(yield findBlock(date))[1] || !!(yield BlackoutDate.findOne({
      start: { $lte: date },
      end: { $gte: date }
    }));
  };

  let incrementBlock = function*(time) {
    let block = yield findBlock(time);
    return _.findIndex(block[0], block[1]) === block[0].length - 1 ? time.add(1, 'day').hour(8) : time.add(2, 'hours');
  };

  let findNextBlock = function*(start) {
    while ( yield inBlackoutDate(start.toDate()) ) {
      yield incrementBlock(start);
    }

    return start;
  };

  co(function*() {
    let classes = yield Class.find({ _id: { $in: registration.classes } }).exec();
    registration.hours = classes.reduce((s, c) => s + c.hours, 0);

    let start = moment(registration.start),
        startBlock = (yield findBlock(start))[1];

    if ( !startBlock ) {
      throw new Error('Start date is out of range');
    }

    winston.debug(`
      Found start date in preset blocks. Is in block: ${startBlock[0]}-${startBlock[1]}.
      Finding ${registration.hours / 2} blocks to satisfy ${registration.hours} class hours.
    `);

    start = start.hour(startBlock[0]).startOf('hour');

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

      yield incrementBlock(start);
    }

    let lastBlock = registration.times[registration.times.length - 1];
    registration.end = lastBlock ? lastBlock.end : registration.start;
  })
  .then(() => next()).catch(next);
}

module.exports = {
  hook: 'pre',
  event: 'save',
  fn: middleware
};
