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

// cache
const findBlocks = time => AvailableTime.find({
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
}).select('blocks').lean().exec()
  .reduce((b, t) => [...b, ...t.blocks ], []);

exports.getAvailability = function*() {
  yield (async () => {
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

      // these could be cached even more (memoize)
      let blackouts = await BlackoutDate.find({
        $or: [{
          start: { $gte: lookbackStart, $lte: lookbackEnd }
        }, {
          end: { $gte: lookbackStart, $lte: lookbackEnd }
        }],
        'classExceptions.0': { $exists: false }
      }).lean().exec();

      // does this *really* need to be a new fn
      const findClassBlackout = (blockDate, block) => {
        return BlackoutDate.find({
          start: { $lte: blockDate },
          end: { $gte: blockDate },
          blocks: { $in: [ block ] }
        })
          .populate('classExceptions')
          .then(classBlackouts => ({
            classBlackouts,
            exceptions: concat.apply(this, map(classBlackouts, blk => blk.toObject().classExceptions))
          }));
      };


      // move outside route
      const filterBlocks = async (day, blocks) => {
        return await Promise.all(blocks.map(async (block) => {
          const newBlock = [ ...block ];
          let s = moment(day).hour(newBlock[0]).startOf('hour').toDate();

          if (!showBackdate && moment().isAfter(s)) {
            return null;
          }

          if (find(blackouts, blackout => day.hour(newBlock[0]).isBetween(blackout.start, blackout.end, null, '[]'))) {
            return null;
          }

          const end = moment(s).add(1, 'hour').endOf('hour');
          const seats = await Seat.countAvailableSeats(s, end);
          const { exceptions, classBlackouts } = await findClassBlackout(s, newBlock);
          const blockMetadata = { seats };
          newBlock.push(blockMetadata);
  
          if (!exceptions.length) {
            return newBlock;
          }
          const reduction = find(classBlackouts, b => !!b.seats); // b.seats is a value
          const reduceByRegistrations = reduction && await Registration.count({
            $or: [{
              cancelledOn: null
            }, {
              cancelledOn: { $exists: false }
            }],
            'times.start': { $lte: s },
            'times.end': { $gte: end },
            classes: { $in: map(reduction.classExceptions, '_id') }
          }).exec();

          Object.assign(blockMetadata, {
            onlyClasses: exceptions,
            ...reduction && {
              registrations: reduceByRegistrations,
              reduceSeats: reduction.seats - reduceByRegistrations
            }
          });
        }).filter(Boolean));
      };

      const availability = [];

      for (let w = 0; w < getWeekNums(startFrom) + 1; w++) {
        const days = await Promise.all([ ...new Array(7) ].map(async (di) => {
          const day = moment(startFrom).add(w, 'week').day(di);
          return await filterBlocks(day, await findBlocks(day));
        }));

        availability.push(days);
      }

      const body = { availability };

      cache.set(cacheKey, JSON.stringify(body));
      this.status = 200;
      this.body = body;
    } catch (err) {
      error(`Error fetching availability: ${err}`);
      error(err.stack);
      throw err;
    }
  })();
};
