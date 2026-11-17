const expect = require('chai').expect,
      moment = require('moment');

const {
  ARRIVE_MINUTES_EARLY,
  arrivalTime,
  endForDisplay,
  traineeEmailTimes,
  digestTimes
} = require('./email-times');

const at = text => moment(text, 'YYYY-MM-DD HH:mm:ss.SSS').toDate();
const clock = date => moment(date).format('YYYY-MM-DD HH:mm:ss.SSS');

// A booking the way seat assignment stores it: each block is held from its
// start to the last millisecond before it ends.
const HALF_HOUR_BOOKING = { start: at('2027-02-02 07:30:00.000'), end: at('2027-02-02 09:29:59.999') };
const TWO_BLOCK_BOOKING = { start: at('2027-02-02 07:30:00.000'), end: at('2027-02-02 11:29:59.999') };
const OLD_STYLE_BOOKING = { start: at('2027-01-26 08:00:00.000'), end: at('2027-01-26 09:59:59.999') };
const TWO_DAY_BOOKING = { start: at('2027-01-26 14:00:00.000'), end: at('2027-01-27 09:59:59.999') };

describe('Unit :: Models :: Registration :: email-times', () => {
  describe('ARRIVE_MINUTES_EARLY', () => {
    it('is 15 minutes', () => {
      expect(ARRIVE_MINUTES_EARLY).to.equal(15);
    });
  });

  describe('arrivalTime', () => {
    it('is 7:15 for a 7:30 class, not 7:00', () => {
      expect(clock(arrivalTime(at('2027-02-02 07:30:00.000')))).to.equal('2027-02-02 07:15:00.000');
    });

    it('is 7:45 for an 8:00 class', () => {
      expect(clock(arrivalTime(at('2027-01-26 08:00:00.000')))).to.equal('2027-01-26 07:45:00.000');
    });

    it('is 11:15 for an 11:30 class', () => {
      expect(clock(arrivalTime(at('2027-02-02 11:30:00.000')))).to.equal('2027-02-02 11:15:00.000');
    });

    it('goes back to the day before for a class just after midnight', () => {
      expect(clock(arrivalTime(at('2027-02-02 00:05:00.000')))).to.equal('2027-02-01 23:50:00.000');
    });

    it('gives back a Date', () => {
      expect(arrivalTime(at('2027-02-02 07:30:00.000'))).to.be.an.instanceof(Date);
    });

    it('accepts a moment as well as a Date', () => {
      expect(clock(arrivalTime(moment(at('2027-02-02 07:30:00.000'))))).to.equal('2027-02-02 07:15:00.000');
    });

    it('does not change the start it is given', () => {
      const start = moment(at('2027-02-02 07:30:00.000'));

      arrivalTime(start);

      expect(start.format('HH:mm')).to.equal('07:30');
    });
  });

  describe('endForDisplay', () => {
    it('reads 9:30 for a block held until 9:29:59.999', () => {
      expect(clock(endForDisplay(at('2027-02-02 09:29:59.999')))).to.equal('2027-02-02 09:30:00.000');
    });

    it('reads 10:00 for an old block held until 9:59:59.999', () => {
      expect(clock(endForDisplay(at('2027-01-26 09:59:59.999')))).to.equal('2027-01-26 10:00:00.000');
    });

    it('reads 1:30pm for the last block of the new lab day', () => {
      expect(moment(endForDisplay(at('2027-02-02 13:29:59.999'))).format('h:mma')).to.equal('1:30pm');
    });

    it('leaves an end that is already on the minute alone', () => {
      expect(clock(endForDisplay(at('2027-02-02 09:30:00.000')))).to.equal('2027-02-02 09:30:00.000');
    });

    it('leaves an end in the middle of a minute alone', () => {
      expect(clock(endForDisplay(at('2027-02-02 09:30:20.500')))).to.equal('2027-02-02 09:30:20.500');
    });

    it('rolls a block held to the end of the day over to midnight', () => {
      expect(clock(endForDisplay(at('2027-02-02 23:59:59.999')))).to.equal('2027-02-03 00:00:00.000');
    });

    it('gives back a Date and does not change the end it is given', () => {
      const end = moment(at('2027-02-02 09:29:59.999'));
      const shown = endForDisplay(end);

      expect(shown).to.be.an.instanceof(Date);
      expect(end.format('HH:mm:ss.SSS')).to.equal('09:29:59.999');
    });

    it('gives nothing for a booking with no end', () => {
      expect(endForDisplay(undefined)).to.equal(undefined);
      expect(endForDisplay(null)).to.equal(undefined);
    });
  });

  describe('traineeEmailTimes', () => {
    it('tells a 7:30 trainee to arrive at 7:15', () => {
      const times = traineeEmailTimes(HALF_HOUR_BOOKING);

      expect(times.arriveAt).to.equal('2/2/27 at 7:15am');
      expect(times.arriveMinutesEarly).to.equal(15);
    });

    it('prints the start and the real end of a half-hour booking', () => {
      const times = traineeEmailTimes(HALF_HOUR_BOOKING);

      expect(times.start).to.equal('Tuesday, Feb 2nd, 7:30am');
      expect(times.end).to.equal('Tuesday, Feb 2nd, 9:30am');
      expect(times.multiDay).to.equal(false);
    });

    it('prints the end of the last block for a two-block booking', () => {
      const times = traineeEmailTimes(TWO_BLOCK_BOOKING);

      expect(times.start).to.equal('Tuesday, Feb 2nd, 7:30am');
      expect(times.end).to.equal('Tuesday, Feb 2nd, 11:30am');
      expect(times.multiDay).to.equal(false);
    });

    it('prints an old whole-hour booking as 8:00 to 10:00', () => {
      const times = traineeEmailTimes(OLD_STYLE_BOOKING);

      expect(times.start).to.equal('Tuesday, Jan 26th, 8:00am');
      expect(times.end).to.equal('Tuesday, Jan 26th, 10:00am');
      expect(times.arriveAt).to.equal('1/26/27 at 7:45am');
    });

    it('marks a booking that ends on a later day as multi-day', () => {
      const times = traineeEmailTimes(TWO_DAY_BOOKING);

      expect(times.multiDay).to.equal(true);
      expect(times.end).to.equal('Wednesday, Jan 27th, 10:00am');
    });

    it('does not call a booking multi-day because it is held to the end of the day', () => {
      // Held until 23:59:59.999; shown as midnight, but it is still one day of training.
      const times = traineeEmailTimes({ start: at('2027-02-02 22:00:00.000'), end: at('2027-02-02 23:59:59.999') });

      expect(times.multiDay).to.equal(false);
    });

    it('copes with a booking that has no end yet', () => {
      const times = traineeEmailTimes({ start: at('2027-02-02 07:30:00.000') });

      expect(times.start).to.equal('Tuesday, Feb 2nd, 7:30am');
      expect(times.end).to.equal('');
      expect(times.multiDay).to.equal(false);
    });
  });

  describe('digestTimes', () => {
    it('prints a half-hour booking as 7:30am to 9:30am', () => {
      expect(digestTimes(HALF_HOUR_BOOKING)).to.deep.equal({
        startStr: '2/2/27 7:30am',
        endStr: '2/2/27 9:30am'
      });
    });

    it('prints an old whole-hour booking as 8:00am to 10:00am, not 9:59am', () => {
      expect(digestTimes(OLD_STYLE_BOOKING)).to.deep.equal({
        startStr: '1/26/27 8:00am',
        endStr: '1/26/27 10:00am'
      });
    });

    it('prints an empty end for a booking that has none', () => {
      expect(digestTimes({ start: at('2027-02-02 07:30:00.000') }).endStr).to.equal('');
    });
  });

  describe('the trainee email', () => {
    const mail = require('../../mail');

    function* renderTraineeEmail (booking) {
      const rendered = yield mail.__render('trainee-registration', Object.assign({
        registration: { classes: [], trainee: { name: { first: 'Bob', last: 'Ross' } } },
        company: { name: 'Happy Trees Inc' }
      }, traineeEmailTimes(booking)));

      return rendered.html;
    }

    it('says when to arrive and how early that is', function*() {
      const html = yield renderTraineeEmail(HALF_HOUR_BOOKING);

      expect(html).to.include('2/2/27 at 7:15am');
      expect(html).to.include('15 minutes before your scheduled start time');
    });

    it('no longer says 30 minutes', function*() {
      const html = yield renderTraineeEmail(HALF_HOUR_BOOKING);

      expect(html).to.not.include('30mins');
      expect(html).to.not.include('7:00am');
    });

    it('says the training is on the start time for a one-day booking', function*() {
      const html = yield renderTraineeEmail(HALF_HOUR_BOOKING);

      expect(html).to.include('on Tuesday, Feb 2nd, 7:30am.');
    });

    it('says start through end for a booking over two days', function*() {
      const html = yield renderTraineeEmail(TWO_DAY_BOOKING);

      expect(html).to.include('Tuesday, Jan 26th, 2:00pm through Wednesday, Jan 27th, 10:00am.');
    });
  });
});
