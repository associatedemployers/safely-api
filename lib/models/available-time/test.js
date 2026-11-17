const chai          = require('chai'),
      expect        = chai.expect,
      moment        = require('moment'),
      mongoose      = require('mongoose'),
      loadMongoose  = require('../../load/mongoose'),
      AvailableTime = require('./index');

const MONDAY_TO_THURSDAY = [ 1, 2, 3, 4 ];

// The new lab day: 7:30-9:30, 9:30-11:30, 11:30-1:30.
const NEW_LAB_DAY = [ [ 7.5, 9.5 ], [ 9.5, 11.5 ], [ 11.5, 13.5 ] ];

describe('Unit :: Models :: AvailableTime :: findBlocksOn', () => {
  // Tuesday 2 February 2027 at 9:30am, a booking time on the new lab day.
  const tuesdayMorning = moment('2027-02-02 09:30', 'YYYY-MM-DD HH:mm').toDate();
  const fridayMorning = moment('2027-02-05 09:30', 'YYYY-MM-DD HH:mm').toDate();

  const startOf = day => moment(day, 'YYYY-MM-DD').startOf('day').toDate();
  const endOf = day => moment(day, 'YYYY-MM-DD').endOf('day').toDate();

  before(done => {
    const conn = loadMongoose();
    if (conn.readyState === 1) return done();
    conn.once('open', done);
    conn.once('error', done);
  });

  afterEach(function*() {
    yield mongoose.connection.dropDatabase();
  });

  // Saves a record straight into the collection, so `end: null` is stored
  // exactly as the site sends it (a field that exists and holds null).
  function* saveRaw (fields) {
    yield AvailableTime.collection.insertOne(fields);
  }

  describe('records with no end date', () => {
    it('finds a record whose end date is missing', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY, start: startOf('2027-02-01') });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal(NEW_LAB_DAY);
    });

    it('finds a record whose end date is saved as null (how the site saves "no end date")', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY, start: startOf('2027-02-01'), end: null });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal(NEW_LAB_DAY);
    });

    it('finds a record saved through the model with end set to null', function*() {
      yield (new AvailableTime({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY, start: startOf('2027-02-01'), end: null })).save();

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal(NEW_LAB_DAY);
    });
  });

  describe('records with no start date', () => {
    it('finds a record with neither a start nor an end', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal(NEW_LAB_DAY);
    });

    it('finds a record whose start and end are both null', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY, start: null, end: null });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal(NEW_LAB_DAY);
    });

    it('finds a record with only an end date that has not passed', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY, end: endOf('2027-02-28') });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal(NEW_LAB_DAY);
    });

    it('skips a record with only an end date that has passed', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY, end: endOf('2027-01-31') });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal([]);
    });
  });

  describe('records with a start and an end', () => {
    it('finds a record when the date is inside its range', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY, start: startOf('2027-02-01'), end: endOf('2027-02-28') });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal(NEW_LAB_DAY);
    });

    it('finds a record on its first day', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY, start: startOf('2027-02-02'), end: endOf('2027-02-28') });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal(NEW_LAB_DAY);
    });

    it('finds a record on its last day', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY, start: startOf('2027-01-01'), end: endOf('2027-02-02') });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal(NEW_LAB_DAY);
    });

    it('skips a record that has not started yet', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY, start: startOf('2027-02-03'), end: null });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal([]);
    });

    it('skips a record that ended the day before', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY, start: startOf('2027-01-01'), end: endOf('2027-02-01') });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal([]);
    });
  });

  describe('days of the week', () => {
    it('gives no blocks on a day the record does not list', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY, start: startOf('2027-02-01'), end: null });

      expect(yield AvailableTime.findBlocksOn(fridayMorning)).to.deep.equal([]);
    });

    it('gives no blocks when there are no records at all', function*() {
      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal([]);
    });
  });

  describe('more than one record for the same day', () => {
    it('hands the old day over to the new day on the switch date', function*() {
      const oldLabDay = [ [ 8, 10 ], [ 10, 12 ], [ 12, 14 ], [ 14, 16 ] ];

      yield saveRaw({ blocks: oldLabDay, days: [ 1, 2, 3, 4, 5 ], end: endOf('2027-01-31') });
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY, start: startOf('2027-02-01'), end: null });

      const lastOldTuesday = moment('2027-01-26 10:00', 'YYYY-MM-DD HH:mm').toDate();

      expect(yield AvailableTime.findBlocksOn(lastOldTuesday)).to.deep.equal(oldLabDay);
      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal(NEW_LAB_DAY);
    });

    it('joins the blocks of two records and puts them in time order', function*() {
      yield saveRaw({ blocks: [ [ 11.5, 13.5 ] ], days: MONDAY_TO_THURSDAY });
      yield saveRaw({ blocks: [ [ 9.5, 11.5 ], [ 7.5, 9.5 ] ], days: MONDAY_TO_THURSDAY });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal(NEW_LAB_DAY);
    });

    it('lists a block once when two records both have it', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY });
      yield saveRaw({ blocks: [ [ 7.5, 9.5 ] ], days: [ 2 ] });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal(NEW_LAB_DAY);
    });
  });

  describe('how blocks are returned', () => {
    it('turns blocks saved as text into numbers', function*() {
      yield saveRaw({ blocks: [ [ '7.5', '9.5' ], [ '9.5', '11.5' ] ], days: MONDAY_TO_THURSDAY });

      expect(yield AvailableTime.findBlocksOn(tuesdayMorning)).to.deep.equal([ [ 7.5, 9.5 ], [ 9.5, 11.5 ] ]);
    });

    it('accepts a moment as well as a Date', function*() {
      yield saveRaw({ blocks: NEW_LAB_DAY, days: MONDAY_TO_THURSDAY });

      expect(yield AvailableTime.findBlocksOn(moment(tuesdayMorning))).to.deep.equal(NEW_LAB_DAY);
    });

    it('still returns the old whole-hour day', function*() {
      const oldLabDay = [ [ 8, 10 ], [ 10, 12 ], [ 12, 14 ], [ 14, 16 ] ];

      yield (new AvailableTime({ blocks: oldLabDay, days: [ 1, 2, 3, 4, 5 ] })).save();

      expect(yield AvailableTime.findBlocksOn(fridayMorning)).to.deep.equal(oldLabDay);
    });
  });
});
