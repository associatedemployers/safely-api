/*
  Availabilities resource
 */

const moment        = require('moment'),
      Promise       = require('bluebird'),
      BlackoutDate  = require('../../lib/models/blackout-date'),
      AvailableTime = require('../../lib/models/available-time'),
      Seat          = require('../../lib/models/seat'),
      find          = require('lodash/find'),
      map           = require('lodash/map'),
      concat        = require('lodash/concat');

function getWeekNums (momentObj) {
  var clonedMoment = moment(momentObj),
      first = clonedMoment.startOf('month').week(),
      last = clonedMoment.endOf('month').week();

  // In case last week is in next year
  if ( first > last) {
    last = first + last;
  }

  return last - first + 1;
}

let findBlocks = time => AvailableTime.find({
  $or: [{
    start: { $lte: time },
    end: { $exists: false }
  }, {
    start: { $lte: time },
    end: { $gte: time }
  }, {
    start: { $exists: false },
    end: { $exists: false }
  }],
  days: { $in: [ moment(time).day() ] }
}).lean().exec()
.reduce((b, t) => b.concat(t.blocks), []);

exports.getAvailability = function*() {
  const { month, year, showBackdate } = this.request.body;

  let startFrom     = moment().month(parseFloat(month) - 1).year(year).startOf('month').startOf('day'),
      weeks         = [],
      lookbackStart = moment(startFrom).startOf('week').toDate(),
      lookbackEnd   = moment(startFrom).endOf('month').endOf('week').toDate();

  let blackouts = yield BlackoutDate.find({
    $or: [{
      start: { $gte: lookbackStart, $lte: lookbackEnd }
    }, {
      end: { $gte: lookbackStart, $lte: lookbackEnd }
    }],
    'classExceptions.0': { $exists: false }
  }).lean().exec();

  const findClassBlackout = (blockDate, block) => {
    return BlackoutDate.find({
      start: { $lte: blockDate },
      end: { $gte: blockDate },
      blocks: { $in: [ block ] }
    })
    .populate('classExceptions')
    .then(classBlackouts => ({
      classBlackouts,
      exceptions: concat.apply(this, map(classBlackouts, 'classExceptions'))
    }));
  };

  let filterBlocks = (day, blocks) => {
    return Promise.reduce(blocks, (availableBlocks, block) => {
      let s = moment(day).hour(block[0]).startOf('hour').toDate();

      if ( !showBackdate && moment().isAfter(s) ) {
        return availableBlocks;
      }

      if ( find(blackouts, blackout => day.hour(block[0]).isBetween(blackout.start, blackout.end, null, '[]')) ) {
        return availableBlocks;
      }

      return Seat.countAvailableSeats(s, moment(s).add(1, 'hour').endOf('hour'))
      .then(seats => {
        return findClassBlackout(s, block)
        .then(result => {
          let _block = block.concat([{ seats }]);

          if (result.exceptions.length > 0) {
            Object.assign(_block[_block.length - 1], {
              onlyClasses: result.exceptions,
              reduceSeats: (find(result.classBlackouts, b => !!b.seats) || {}).seats
            });
          }

          availableBlocks.push(_block);
          return availableBlocks;
        });
      });
    }, []);
  };

  for (let i = 0; i < getWeekNums(startFrom); i++) {
    let week = [];

    for (let di = 0; di < 7; di++) {
      let day = moment(startFrom).add(i, 'week').day(di),
          blocks = yield findBlocks(day);

      week.push(yield filterBlocks(day, blocks));
    }

    weeks.push(week);
  }

  this.status = 200;
  this.body = {
    availability: weeks
  };
};
