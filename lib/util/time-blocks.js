/*
  Time blocks

  A lab "block" is a pair of hours on a 24 hour clock: [ start, end ].
  Hours can carry a half hour as a decimal, so:

    [ 8, 10 ]     is 8:00am - 10:00am
    [ 7.5, 9.5 ]  is 7:30am - 9:30am
    [ 22, 0 ]     is 10:00pm - midnight (an end of 0 means midnight)

  Everything in this file is a plain function with no database access.

  Never write `moment().hour(block[0])` anywhere else: moment drops the
  decimal, so hour(7.5) becomes 7:00. Use blockStart / blockEnd instead.
*/

const moment = require('moment');

const MINUTES_IN_AN_HOUR = 60,
      MIDNIGHT_AS_START_OF_DAY = 0,
      MIDNIGHT_AS_END_OF_DAY = 24;

// The hour a block ends on, with midnight written as 24 so that it is
// always greater than the start hour.
function blockEndHour (block) {
  const endHour = block[1];

  return endHour === MIDNIGHT_AS_START_OF_DAY ? MIDNIGHT_AS_END_OF_DAY : endHour;
}

// How long a block lasts, in hours.
function blockLength (block) {
  return blockEndHour(block) - block[0];
}

// The date and time a decimal hour falls on for the given day.
// Sets the clock time directly, so a daylight saving change earlier
// that day cannot shift it.
function dateAtHour (day, decimalHour) {
  const wholeHours = Math.floor(decimalHour),
        minutes = Math.round((decimalHour - wholeHours) * MINUTES_IN_AN_HOUR);

  return moment(day).startOf('day').hour(wholeHours).minute(minutes).toDate();
}

// The date and time a block starts on the given day.
function blockStart (day, block) {
  return dateAtHour(day, block[0]);
}

// The date and time a block is over on the given day.
// This is the first moment AFTER the block, so the next block may start on it.
function blockEnd (day, block) {
  return dateAtHour(day, blockEndHour(block));
}

// The time of day as a decimal hour: 9:30am is 9.5. Seconds are ignored.
function fractionalHour (date) {
  const time = moment(date);

  return time.hour() + time.minute() / MINUTES_IN_AN_HOUR;
}

function isPairOfNumbers (block) {
  return Array.isArray(block) && block.length === 2 && !isNaN(block[0]) && !isNaN(block[1]);
}

// Cleans up blocks read from the database:
//  - number-like strings become numbers
//  - anything that is not a [ start, end ] pair is dropped
//  - duplicates are removed
//  - the result is sorted by start time
function normalizeBlocks (blocks) {
  const seen = {},
        cleanBlocks = [];

  (blocks || []).forEach(rawBlock => {
    if (!Array.isArray(rawBlock) || rawBlock.length !== 2) {
      return;
    }

    const block = [ parseFloat(rawBlock[0]), parseFloat(rawBlock[1]) ];

    if (!isPairOfNumbers(block)) {
      return;
    }

    const key = `${block[0]}-${block[1]}`;

    if (seen[key]) {
      return;
    }

    seen[key] = true;
    cleanBlocks.push(block);
  });

  return cleanBlocks.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

// The block that starts exactly at the given time, or undefined.
// A time in the middle of a block does not match.
function findBlockStartingAt (blocks, date) {
  const hour = fractionalHour(date);

  return blocks.find(block => block[0] === hour);
}

// Whether two blocks share any time. Blocks that only touch
// (one ends when the other starts) do not overlap.
function blocksOverlap (blockA, blockB) {
  return blockA[0] < blockEndHour(blockB) && blockB[0] < blockEndHour(blockA);
}

// A decimal hour as people read it: 7.5 is "7:30am".
function formatHour (decimalHour) {
  // Any day without a daylight saving change works; only the clock time is printed.
  const anOrdinaryDay = moment('2000-01-01', 'YYYY-MM-DD');

  return moment(dateAtHour(anOrdinaryDay, decimalHour)).format('h:mma');
}

module.exports = {
  blockEndHour,
  blockLength,
  blockStart,
  blockEnd,
  fractionalHour,
  normalizeBlocks,
  findBlockStartingAt,
  blocksOverlap,
  formatHour
};
