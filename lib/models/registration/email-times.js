/*
  Email times

  The dates and times printed in the emails about a registration.
  Plain functions only: nothing here reads the database or sends mail.

  Two things the emails must get right:

    - When to arrive. Trainees are asked to come a little before their class.
    - When the class ends. Seat assignment holds a seat until the last
      millisecond BEFORE the block ends (9:29:59.999 for a block that ends at
      9:30), so that the next block can start exactly on time. Printed as it
      is stored, that would read "9:29am".
*/

const moment = require('moment');

// How long before the start of a class a trainee is asked to arrive.
// Change this one number to change the email.
const ARRIVE_MINUTES_EARLY = 15;

const ONE_MILLISECOND = 1;

// The time a trainee should arrive for a class that starts at `start`.
function arrivalTime (start) {
  return moment(start).subtract(ARRIVE_MINUTES_EARLY, 'minutes').toDate();
}

function isHeldToTheLastMillisecond (end) {
  return moment(end).millisecond() === 999 && moment(end).second() === 59;
}

// The time a booking is over, as a person would say it.
// A seat held until 9:29:59.999 is over at 9:30. Any other end is left alone.
// Gives undefined when there is no end.
function endForDisplay (end) {
  if (!end) {
    return undefined;
  }

  if (isHeldToTheLastMillisecond(end)) {
    return moment(end).add(ONE_MILLISECOND, 'millisecond').toDate();
  }

  return moment(end).toDate();
}

// The values the "Your upcoming safety training" email prints.
function traineeEmailTimes (registration) {
  const end = endForDisplay(registration.end);

  return {
    start: moment(registration.start).format('dddd, MMM Do, h:mma'),
    end: end ? moment(end).format('dddd, MMM Do, h:mma') : '',
    arriveAt: moment(arrivalTime(registration.start)).format('M/D/YY [at] h:mma'),
    arriveMinutesEarly: ARRIVE_MINUTES_EARLY,
    // Compared on the stored end, so a seat held to the last moment of a day
    // is not mistaken for a booking that runs into the next day.
    multiDay: registration.end ? !moment(registration.start).isSame(registration.end, 'day') : false
  };
}

// The start and end the daily registration digest prints for one registration.
function digestTimes (registration) {
  const end = endForDisplay(registration.end);

  return {
    startStr: moment(registration.start).format('M/D/YY h:mma'),
    endStr: end ? moment(end).format('M/D/YY h:mma') : ''
  };
}

module.exports = {
  ARRIVE_MINUTES_EARLY,
  arrivalTime,
  endForDisplay,
  traineeEmailTimes,
  digestTimes
};
