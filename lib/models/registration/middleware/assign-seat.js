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
      .then(a => {
        winston.log('findblock', a);
        return [ a, findBlockInArray(a, _time) ];
      });
  };

  let inBlackoutDate = function*(date, classes) {
    let mdate = moment(date);
    let block = yield findBlock(date);

    const catchAllBlackout = {
      start: { $lte: date },
      end: { $gte: date },
      'classExceptions.0': { $exists: false },
      'classExplicit.0': { $exists: false },
      'hubClassExceptions.0': { $exists: false },
      'hubClassExplicit.0': { $exists: false }
    };

    const classSpecificBlackout = {
      start: { $lte: date },
      end: { $gte: date },
      $or: [{
        'classExceptions.0': { $exists: true },
        'classExplicit.0': { $exists: false },
        'hubClassExplicit.0': { $exists: false }
        // blocks: { $not: { $in: [[mdate.hour(), mdate.hour() + 2]] } }
      }, {
        'classExplicit.0': { $exists: true },
        'classExceptions.0': { $exists: false },
        'hubClassExplicit.0': { $exists: false },
        blocks: { $in: [[mdate.hour(), mdate.hour() + 2]] }
      },{
        'hubClassExceptions.0': { $exists: true },
        'hubClassExplicit.0': { $exists: false },
        blocks: { $in: [[mdate.hour(), mdate.hour() + 2]] }
      }]
    };

    const totalBlackouts = !block[1] || (yield BlackoutDate.findOne(catchAllBlackout));
    const classSpecificBlackouts = yield BlackoutDate.find(classSpecificBlackout).then(blackouts => {
      if (blackouts.length < 1) {
        return false;
      }

      let blockRange = [mdate.hour(), mdate.hour() + 2];

      if (blackouts.filter(blk => blk.hubClassExceptions && blk.hubClassExceptions.length > 0).length > 0) {
        return blackouts[0];
      }

      let exceptions = _.map(Array.prototype.concat.apply([], _.map(blackouts, 'classExceptions')), b => b.toString()),
          _classes = _.map(classes, c => c._id.toString());

      let explicitClasses = _.map(Array.prototype.concat.apply([], _.map(blackouts, 'classExplicit')), b => b.toString());

      if (explicitClasses.length > 0) {

        // Make sure at least one of the classes is in the explicit list
        if (_classes.filter(c => _.includes(explicitClasses, c)).length > 0) {
          return blackouts[0];
        }
      } else if (_classes.filter(c => !_.includes(exceptions, c)).length > 0) {
        // The registering class is NOT in classExceptions, so it may be blocked.
        // We need to determine whether the current time slot falls inside the restricted window.
        //
        // BLOCK ENCODING — there are two ways blocks can be stored:
        //
        //   1. DIRECT: blocks lists the restricted slots directly.
        //      e.g. blocks = [[12,14],[14,16]] means only 12pm–4pm is restricted.
        //      A slot is restricted if its start hour matches any block's start hour.
        //
        //   2. INVERTED (gap encoding): blocks stores every slot EXCEPT the restricted window,
        //      so the missing "gap" in the sorted sequence is the actual restricted window.
        //      e.g. blocks = [[8,10],[10,12],[14,16]] → gap is 12–14, so 12pm is restricted.
        //      Sorting by start and finding where consecutive blocks don't connect reveals the gap.
        //      This encoding is used when "allowed times" are configured in the UI and the
        //      backend stores all other times as the blackout payload.
        //
        // In both cases: if the current hour is NOT in the restricted window, return false (allow).
        const currentHour = blockRange[0];

        const matchingBlackout = blackouts.find(blackout => {
          if (!blackout.blocks || !blackout.blocks.length) return true; // no blocks = entire day restricted

          // Sort by start hour so we can scan for a gap.
          // NOTE: [22, 0] blocks (crossing midnight) use 0 to mean 24 in the end position.
          const sorted = [...blackout.blocks].sort((a, b) => a[0] - b[0]);
          let gapStart = null, gapEnd = null;
          for (let i = 0; i < sorted.length - 1; i++) {
            const end = sorted[i][1] === 0 ? 24 : sorted[i][1]; // treat 0 as 24 for midnight blocks
            if (end !== sorted[i + 1][0]) { gapStart = end; gapEnd = sorted[i + 1][0]; break; }
          }

          if (gapStart !== null) {
            // Inverted encoding: the gap IS the restricted window.
            // Block the registration only when the current hour falls inside the gap.
            return currentHour >= gapStart && currentHour < gapEnd;
          }

          // Direct encoding: check whether any block starts at the current hour.
          return blackout.blocks.some(block => block[0] === currentHour);
        });

        if (!matchingBlackout) return false;

        if (!matchingBlackout.seats) {
          return matchingBlackout;
        }

        let qDate = mdate.toDate();

        return Seat.countAvailableSeats(qDate, qDate, matchingBlackout)
          .then(count => count > 0 ? false : matchingBlackout);
      }

      return false;
    });

    const isInBlackout = totalBlackouts || classSpecificBlackouts;

    // Hit the db to see if we are in a user
    // set blackout date or block.
    return isInBlackout;
  };

  let incrementBlock = function*(time) {
    let block = yield findBlock(time);
    return _.findIndex(block[0], block[1]) === block[0].length - 1 ? time.add(1, 'day').hour(8) : time.add(2, 'hours');
  };

  let findNextBlock = function*(start, classes) {
    let blackout;

    let inBlackout = function*() {
      blackout = yield inBlackoutDate(start.toDate(), classes);
      return blackout;
    };

    while (yield inBlackout()) {
      if (
        (blackout.classExceptions || {}).length > 0 || 
        (blackout.classExplicit || {}).length > 0 ||
        (blackout.hubClassExceptions || {}).length > 0 ||
        blackout === true
      ) {
        const classBased = blackout !== true;

        winston.debug('Classes are within a blackout. Exiting with error.');
        let msg = `The classes you've selected fall within a ${classBased ? 'class-specific ' : ''}blackout date.`;
        msg += blackout.seats ? ' There might not be enough seats to accommodate your registration.' : '';
        throw new Error(msg);
      }

      yield incrementBlock(start);
    }

    return start;
  };

  co(function*() {
    let classes = yield Class.find({ _id: { $in: registration.classes } }).exec();
    registration.hours = classes.reduce((s, c) => s + c.hours, 0);

    if (registration.hours % 2) {
      registration.hours = Math.ceil(registration.hours / 2) * 2;
    }

    let start = moment(registration.start),
        startBlocks = yield findBlock(start),
        startBlock = startBlocks[1];

    if ( !startBlock ) {
      winston.debug(`---!!!!!
        RAW time selected is : ${registration.start}.
        ISO time selected is : ${registration.start.toISOString()}.
        Converted time is : ${start},
        Start blocks are: ${startBlocks}---!!!!!!
      `);
      winston.log('No block date in start range, startblocks were:', startBlocks);
      throw new Error('Start date is out of range');
    }

    winston.debug(`
      Found start date in preset blocks. Is in block: ${startBlock[0]}-${startBlock[1]}.
      Finding ${registration.hours / 2} blocks to satisfy ${registration.hours} class hours.
    `);

    start = start.hour(startBlock[0]).startOf('hour');
    registration.start = start.toDate();

    for (let i = 0; i < registration.hours / 2; i++) {
      winston.debug(`On registration block ${i + 1} of ${registration.hours / 2}`);
      yield findNextBlock(start, classes);
      winston.debug(`Found next block ${moment(start).format('M/D h:mma')}`);

      if (!moment(registration.start).isSame(start, 'day')) {
        const multiDayError = new Error('Multi-day registrations are no longer allowed. Please clear your browser\'s cache and try again.');
        multiDayError.status = 400;
        throw multiDayError;
      }

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
