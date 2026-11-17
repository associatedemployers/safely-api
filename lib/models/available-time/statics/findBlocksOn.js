const moment = require('moment'),
      { normalizeBlocks } = require('../../../util/time-blocks');

/*
  The lab blocks that can be booked on the given date, in time order.

  An Available Time record applies to a date when:
    - the date's day of the week is one of the record's days, and
    - the record has no start date, or started on or before the date, and
    - the record has no end date, or ends on or after the date.

  "No date" means the field is missing OR holds null. The site saves an
  empty end date as null, and `{ end: null }` matches both in MongoDB.
  (`{ end: { $exists: false } }` only matches a missing field, which is why
  a record with a start date and an empty end date used to be ignored.)

  Returns a promise for a list such as [ [ 7.5, 9.5 ], [ 9.5, 11.5 ] ].
  The list is empty when the lab is closed that day.
*/
module.exports = function findBlocksOn (date) {
  const when = moment(date).toDate();

  const hasStarted = { $or: [ { start: null }, { start: { $lte: when } } ] },
        hasNotEnded = { $or: [ { end: null }, { end: { $gte: when } } ] };

  return this.find({
    days: moment(when).day(),
    $and: [ hasStarted, hasNotEnded ]
  })
    .lean()
    .exec()
    .then(records => {
      const everyBlock = records.reduce((blocks, record) => blocks.concat(record.blocks || []), []);

      return normalizeBlocks(everyBlock);
    });
};
