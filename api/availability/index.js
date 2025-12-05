/*
  Availabilities resource
 */

const moment        = require('moment'),
      Promise       = require('bluebird'),
      lruCache      = require('lru-cache'),
      BlackoutDate  = require('../../lib/models/blackout-date'),
      AvailableTime = require('../../lib/models/available-time'),
      Registration  = require('../../lib/models/registration'),
      Seat          = require('../../lib/models/seat'),
      find          = require('lodash/find'),
      map           = require('lodash/map'),
      { error }     = require('winston'),
      concat        = require('lodash/concat'),
      range         = require('lodash/range');

const cache = lruCache({
  max: 10,
  maxAge: 1000 * 20
});

function getWeekNums (momentObj) {
  var clonedMoment = moment(momentObj),
      start = clonedMoment.startOf('month').toDate(),
      end = clonedMoment.endOf('month').toDate();

  return moment.duration(end - start).weeks();
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
  try {
    // Check the cache...
    const cacheKey = JSON.stringify(this.request.body),
          isCached = cache.peek(cacheKey);

    if (isCached) {
      this.status = 200;
      this.body = JSON.parse(isCached);
      return;
    }

    const { month, year, showBackdate } = this.request.body;

    let startFrom     = moment().month(parseFloat(month) - 1).year(year).startOf('month').startOf('day'),
        lookbackStart = moment(startFrom).startOf('week').toDate(),
        lookbackEnd   = moment(startFrom).endOf('month').endOf('week').toDate();

    let totalClassBlackouts = yield BlackoutDate.find({
      $or: [{
        start: { $gte: lookbackStart, $lte: lookbackEnd }
      }, {
        end: { $gte: lookbackStart, $lte: lookbackEnd }
      }],
      'classExceptions.0': { $exists: false },
      'classExplicit.0': { $exists: false }
    }).lean().exec();

    if (totalClassBlackouts.filter(blk => blk.hubClassExplicit).length){
      totalClassBlackouts = totalClassBlackouts.filter(blk => blk.hubClassExplicit.length === 0);
    }

    const findClassBlackout = (blockDate, block) => {
      return BlackoutDate.find({
        start: { $lte: blockDate },
        end: { $gte: blockDate },
        blocks: { $in: [ block ] }
      })
        .populate('classExceptions hubClassExceptions classExplicit hubClassExplicit' )
        .then(classBlackouts => {
          return {
            classBlackouts,
            exceptions: concat.apply(this, map(classBlackouts, blk => blk.toObject().classExceptions)),
            explicit: concat.apply(this, map(classBlackouts, blk => blk.toObject().classExplicit ) )
          };
        });
    };

    let filterBlocks = (day, blocks) => {
      return Promise.map(blocks, (block) => {
        let s = moment(day).hour(block[0]).startOf('hour').toDate();

        if (!showBackdate && moment().isAfter(s)) {
          return null;
        }

        if (find(totalClassBlackouts, blackout => day.hour(block[0]).isBetween(blackout.start, blackout.end, null, '[]'))) {
          return null;
        }

        let end = moment(s).add(1, 'hour').endOf('hour');

        return Seat.countAvailableSeats(s, end)
          .then(seats => {
            return findClassBlackout(s, block)
              .then(result => {
                let _block = block.concat([{ seats }]);

                if (result.exceptions.length > 0) {
                  const reduction = find(result.classBlackouts, b => !!b.seats);

                  if (reduction) {
                    return Registration.count({
                      $or: [{
                        cancelledOn: null
                      }, {
                        cancelledOn: { $exists: false }
                      }],
                      'times.start': { $lte: s },
                      'times.end': { $gte: end },
                      classes: { $in: map(reduction.classExceptions, '_id') }
                    }).then(registrations => {
                      Object.assign(_block[_block.length - 1], {
                        registrations,
                        onlyClasses: result.exceptions,
                        reduceSeats: reduction.seats - registrations
                      });

                      return _block;
                    });
                  } else {
                    Object.assign(_block[_block.length - 1], {
                      onlyClasses: result.exceptions
                    });
                  }
                } else if (result.explicit.length > 0) {
                  const reduction = find(result.classBlackouts, b => !!b.seats);

                  if (reduction) {
                    return Registration.count({
                      $or: [{
                        cancelledOn: null
                      }, {
                        cancelledOn: { $exists: false }
                      }],
                      'times.start': { $lte: s },
                      'times.end': { $gte: end },
                      classes: { $in: map(reduction.classExplicit, '_id') }
                    }).then(registrations => {
                      Object.assign(_block[_block.length - 1], {
                        registrations,
                        blockOutExplicit: result.explicit,
                        reduceSeats: reduction.seats - registrations
                      });

                      return _block;
                    });
                  } else {
                    Object.assign(_block[_block.length - 1], {
                      blockOutExplicit: result.explicit
                    });
                  }
                }

                return _block;
              });
          });
      })
        .filter(b => b !== null);
    };

    const body = {
      availability: yield range(getWeekNums(startFrom) + 1).map(w => {
        return Promise.reduce(range(7), (week, di) => {
          let day = moment(startFrom).add(w, 'week').day(di);

          return findBlocks(day)
            .then(blocks => filterBlocks(day, blocks))
            .then(fb => [ ...week, fb ]);
        }, []);
      })
    };

    cache.set(cacheKey, JSON.stringify(body));
    this.status = 200;
    this.body = body;
  } catch (err) {
    error(`Error fetching availability: ${err}`);
    error(err.stack);
    throw err;
  }
};
