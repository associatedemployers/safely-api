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
      'classExplicit.0': { $exists: false },
      'hubClassExceptions.0': { $exists: false },
      'hubClassExplicit.0': { $exists: false }
    }).lean().exec();

    if (totalClassBlackouts.filter(blk => blk.hubClassExplicit).length){
      totalClassBlackouts = totalClassBlackouts.filter(blk => blk.hubClassExplicit.length === 0);
    }

    const findClassBlackout = (blockDate, block) => {
      return BlackoutDate.find({
        start: { $lte: blockDate },
        end: { $gte: blockDate }
      })
        .populate('classExceptions')
        .then(classBlackouts => {
          // Filter blackouts to only those where the block time falls within the blackout time ranges
          const relevantBlackouts = classBlackouts.filter(blackout => {
            if (!blackout.blocks || blackout.blocks.length === 0) {
              return true; // No blocks specified means entire day is blacked out
            }
            
            const blockStart = block[0];
            const blockEnd = block[1];

            // Sort blocks to find the gap in overnight sequences
            const sortedBlocks = [...blackout.blocks].sort((a, b) => a[0] - b[0]);
            
            // Find the gap (where the sequence breaks)
            let gapStart = null;
            let gapEnd = null;
            
            for (let i = 0; i < sortedBlocks.length - 1; i++) {
              const currentEnd = sortedBlocks[i][1] === 0 ? 24 : sortedBlocks[i][1];
              const nextStart = sortedBlocks[i + 1][0];
              
              if (currentEnd !== nextStart) {
                gapStart = currentEnd;
                gapEnd = nextStart;
                break;
              }
            }
            
            // If there's a gap, restrict blocks that strictly overlap with the gap.
            // Both boundaries are exclusive: a block ending exactly at gapStart or
            // starting exactly at gapEnd is considered outside the blackout.
            if (gapStart !== null && gapEnd !== null) {
              const blockEndAdjusted = blockEnd === 0 ? 24 : blockEnd;
              return blockStart < gapEnd && blockEndAdjusted > gapStart;
            }
            
            // No gap found, apply standard overlap check
            return blackout.blocks.some(blackoutBlock => {
              const blackoutStart = blackoutBlock[0];
              const blackoutEnd = blackoutBlock[1] === 0 ? 24 : blackoutBlock[1];
              const blkEnd = blockEnd === 0 ? 24 : blockEnd;
              
              return blockStart < blackoutEnd && blkEnd > blackoutStart;
            });
          });
          
          return {
            classBlackouts: relevantBlackouts,
            exceptions: concat.apply(this, [...map(relevantBlackouts, blk => blk.toObject().classExceptions), ...map(relevantBlackouts, blk => blk.toObject().hubClassExceptions)]),
            explicit: concat.apply(this, [...map(relevantBlackouts, blk => blk.toObject().classExplicit), ...map(relevantBlackouts, blk => blk.toObject().hubClassExplicit)])
          };
        });
    };

    let filterBlocks = (day, blocks) => {
      return Promise.map(blocks, (block) => {
        let s = moment(day).hour(block[0]).startOf('hour').toDate();

        if (!showBackdate && moment().isAfter(s)) {
          return null;
        }

        if (find(totalClassBlackouts, blackout => {
          if (!day.hour(block[0]).isBetween(blackout.start, blackout.end, null, '[]')) {
            return false;
          }
          // If the blackout has no hour blocks, it blocks the entire day
          if (!blackout.blocks || blackout.blocks.length === 0) {
            return true;
          }
          // Only block this availability slot if it overlaps with a blackout hour block
          return blackout.blocks.some(bBlock => block[0] < bBlock[1] && block[1] > bBlock[0]);
        })) {
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
