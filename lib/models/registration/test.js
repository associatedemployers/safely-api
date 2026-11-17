const Trainee = require('../trainee/index');

const chai          = require('chai'),
      expect        = chai.expect,
      moment        = require('moment'),
      mongoose      = require('mongoose'),
      loadMongoose  = require('../../load/mongoose'),
      BlackoutDate  = require('../blackout-date'),
      Class         = require('../class'),
      HubClass      = require('../hub-class'),
      Seat          = require('../seat'),
      AvailableTime = require('../available-time'),
      Registration  = require('./index');

describe('Unit :: Models :: Registration :: Middleware :: assign-seat', () => {
  before(done => {
    const conn = loadMongoose();
    if (conn.readyState === 1) return done();
    conn.once('open', done);
    conn.once('error', done);
  });
  let regularClass1, regularClass2, hubClass1, hubClass2, trainee;

  beforeEach(function*() {
    // Create test classes
    regularClass1 = yield (new Class({
      name: 'CPR Class',
      description: 'CPR certification',
      hours: 2
    })).save();

    regularClass2 = yield (new Class({
      name: 'First Aid Class',
      description: 'First aid certification',
      hours: 2
    })).save();

    hubClass1 = yield (new HubClass({
      organization: 'Test Organization Alpha',
      code: 'ALPHA-001',
      seats: 15,
      times: []
    })).save();

    hubClass2 = yield (new HubClass({
      organization: 'Test Organization Beta',
      code: 'BETA-002',
      seats: 15,
      times: []
    })).save();

    trainee = yield (new Trainee({
      name: {
        first: 'Bob',
        last: 'Ross'
      },
      email: 'happytree@hotmail.net',
      ssn: '123-12-1111'
    })).save();

    // Set up available times (Monday-Friday, 8am-4pm in 2-hour blocks)
    yield (new AvailableTime({
      blocks: [[8,10],[10,12],[12,14],[14,16]],
      days: [1, 2, 3, 4, 5]
    })).save();

    // Create seats
    for (let i = 1; i <= 3; i++) {
      yield (new Seat({
        number: i
      })).save();
    }
  });

  afterEach(function*() {
    yield require('mongoose').connection.dropDatabase();
  });

  describe('No class filters (all regular classes blacked out)', () => {
    it('should prevent regular class registration when all classes are blacked out', function*() {
      const testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour'); // Next Week's Tuesday @ 10am

      // Create total blackout (no class filters)
      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate()
      })).save();

      let registration = new Registration({
        start: testDate.toDate(),
        classes: [regularClass1._id],
        trainee: trainee._id
      });

      let error;
      try {
        yield registration.save();
      } catch (err) {
        error = err;
      }

      expect(error).to.exist;
      expect(error.message).to.include('The classes you\'ve selected fall within a blackout date.');
      expect(registration.times).to.have.lengthOf(0);
    });
  });

  describe('hubClassExplicit (hub-only filter, regular classes allowed)', () => {
    it('should allow regular classes when hubClassExplicit is set', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      // Hub-only blackout - frontend handles hub class blocking
      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        hubClassExplicit: [hubClass1._id],
        blocks: [[10, 12]]
      })).save();

      // Regular classes should be allowed
      let registration = new Registration({
        start: testDate.toDate(),
        classes: [regularClass1._id],
        trainee: trainee._id
      });

      yield registration.save();
      expect(registration._id).to.exist;
    });

    it('should allow all regular classes with multiple hub classes in hubClassExplicit', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        hubClassExplicit: [hubClass1._id, hubClass2._id],
        blocks: [[10, 12]]
      })).save();

      // Both regular classes should be allowed
      let reg1 = new Registration({
        start: testDate.toDate(),
        classes: [regularClass1._id],
        trainee: trainee._id
      });
      yield reg1.save();
      expect(reg1._id).to.exist;

      let reg2 = new Registration({
        start: testDate.toDate(),
        classes: [regularClass2._id],
        trainee: trainee._id
      });
      yield reg2.save();
      expect(reg2._id).to.exist;
    });
  });

  describe('hubClassExceptions (blocks everything including regular classes)', () => {
    it('should block regular classes when hubClassExceptions is set', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      // hubClassExceptions means "everything except these hub classes is blocked"
      // So regular classes SHOULD be blocked
      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment().add(7, 'days').day(2).endOf('day').toDate(),
        hubClassExceptions: [hubClass1._id],
        blocks: [
          [
            8,
            10
          ],
          [
            10,
            12
          ],
          [
            12,
            14
          ],
          [
            14,
            16
          ]
        ]
      })).save();

      // Regular classes should be blocked
      let reg1 = new Registration({
        start: testDate.toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });

      let error1;
      try {
        yield reg1.save();
      } catch (err) {
        error1 = err;
      }
      expect(error1).to.exist;
      expect(error1.message).to.equal('The classes you\'ve selected fall within a class-specific blackout date.');
      expect(error1.message).to.include('class-specific blackout');

      // Second regular class should also be blocked
      let reg2 = new Registration({
        start: testDate.toDate(),
        trainee: trainee._id,
        classes: [regularClass2._id]
      });

      let error2;
      try {
        yield reg2.save();
      } catch (err) {
        error2 = err;
      }
      expect(error2).to.exist;
      expect(error2.message).to.equal('The classes you\'ve selected fall within a class-specific blackout date.');
      expect(error2.message).to.include('class-specific blackout');
    });
  });

  describe('classExplicit (only specified regular classes blacked out)', () => {
    it('should block only regular classes in classExplicit array', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        classExplicit: [regularClass1._id],
        blocks: [[10, 12]]
      })).save();

      // regularClass1 should be blocked
      let reg1 = new Registration({
        start: testDate.toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });

      let error1;
      try {
        yield reg1.save();
      } catch (err) {
        error1 = err;
      }

      expect(error1).to.exist;
      expect(error1.message).to.include('class-specific blackout');

      // regularClass2 should succeed
      let reg2 = new Registration({
        start: testDate.toDate(),
        classes: [regularClass2._id],
        trainee: trainee._id
      });

      yield reg2.save();
      expect(reg2._id).to.exist;
    });
  });

  describe('classExceptions (all regular classes except specified are blacked out)', () => {
    it('should allow regular classes in classExceptions array', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        classExceptions: [regularClass1._id],
        blocks: [[10, 12]]
      })).save();

      // regularClass1 should succeed (exception)
      let reg1 = new Registration({
        start: testDate.toDate(),
        classes: [regularClass1._id],
        trainee: trainee._id
      });

      yield reg1.save();
      expect(reg1._id).to.exist;

      // regularClass2 should be blocked
      let reg2 = new Registration({
        start: testDate.toDate(),
        trainee: trainee._id,
        classes: [regularClass2._id]
      });

      let error2;
      try {
        yield reg2.save();
      } catch (err) {
        error2 = err;
      }
      expect(error2).to.exist;
      expect(error2.message).to.include('class-specific blackout');
    });
  });

  describe('Seat reduction with class-specific blackouts', () => {
    it('should reduce seats for classExceptions with seat limit', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        classExceptions: [regularClass1._id],
        seats: 1,
        blocks: [[10, 12]]
      })).save();

      // First registration should succeed
      let reg1 = new Registration({
        start: testDate.toDate(),
        classes: [regularClass1._id],
        trainee: trainee._id
      });

      yield reg1.save();
      expect(reg1._id).to.exist;

      // Second registration should pass
      let reg2 = new Registration({
        start: testDate.toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });

      yield reg2.save();

      expect(reg2._id).to.exist;

      // Third registration should pass
      let reg3 = new Registration({
        start: testDate.toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });

      yield reg3.save();

      expect(reg3._id).to.exist;

      // Fourth registration should fail
      let reg4 = new Registration({
        start: testDate.toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });

      try {
        yield reg4.save();
      } catch (err) {
        expect(err).to.exist;
        expect(err.message).to.include('No seat could be found');
      }
    });

    it('should reduce seats for classExceptions with seat limit', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        classExceptions: [regularClass1._id],
        seats: 2,
        blocks: [[10, 12]]
      })).save();

      // First registration should succeed
      let reg1 = new Registration({
        start: testDate.toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });

      yield reg1.save();
      expect(reg1._id).to.exist;

      // Second registration should succeed (2 seats available)
      let reg2 = new Registration({
        start: testDate.toDate(),
        classes: [regularClass1._id],
        trainee: trainee._id
      });

      yield reg2.save();

      expect(reg2._id).to.exist;

    });
  });

  // BLOCK ENCODING PRIMER — read this before editing these tests:
  //
  // classExceptions marks classes that are ALLOWED during a restricted window.
  // Everyone else is blocked. The restricted window is encoded in `blocks` one of two ways:
  //
  //   DIRECT: blocks lists only the restricted slots.
  //     e.g. blocks = [[12,14],[14,16]] → only 12pm–4pm is restricted.
  //     Registration is blocked when currentHour matches any block's start.
  //
  //   INVERTED (gap encoding): blocks stores every slot EXCEPT the restricted window.
  //     The "gap" in the sorted sequence is where the restriction lives.
  //     e.g. blocks = [[8,10],[10,12],[14,16]] → sorted gap is 12–14, so 12pm–2pm is restricted.
  //     This encoding appears when the UI stores "which times the exception class is available"
  //     and the backend records all other time slots as the payload.
  //
  // The excepted class (classExceptions) is NEVER blocked by this logic — A is always false for it.
  // Only non-excepted classes go through the block check.
  describe('classExceptions with specific time blocks (regression)', () => {
    it('should allow a non-excepted class to register OUTSIDE the blackout time blocks (direct encoding)', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      // DIRECT ENCODING: blocks = [[12,14],[14,16]] — restricted window is exactly 12pm–4pm.
      // 10am is outside that window, so a non-excepted class should be allowed.
      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        classExceptions: [regularClass1._id],
        blocks: [[12, 14], [14, 16]]
      })).save();

      // 10am is outside [12-16] → non-excepted class should succeed
      let reg = new Registration({
        start: testDate.toDate(),
        classes: [regularClass2._id],
        trainee: trainee._id
      });

      yield reg.save();
      expect(reg._id).to.exist;
    });

    it('should allow a non-excepted class OUTSIDE the gap window (inverted-blocks encoding)', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      // INVERTED-BLOCKS ENCODING: blocks store every slot *except* the restricted window.
      // The "gap" in the sorted sequence is where the restriction actually lives.
      //
      // blocks: [[8,10],[10,12],[14,16]] → sorted gap is 12-14
      //   - 10am is OUTSIDE the gap (12-14) → not blocked ✓
      //   - 12pm would be inside the gap (12-14) → blocked
      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        classExceptions: [regularClass1._id],
        blocks: [[8, 10], [10, 12], [14, 16]]  // gap = 12-14
      })).save();

      // 10am is outside the restricted gap [12-14] → non-excepted class should succeed
      let reg = new Registration({
        start: testDate.toDate(),
        classes: [regularClass2._id],
        trainee: trainee._id
      });
      yield reg.save();
      expect(reg._id).to.exist;
    });

    it('should block a non-excepted class in the restricted gap window (inverted-blocks encoding)', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      // INVERTED ENCODING: blocks = [[8,10],[12,14],[14,16]] → sorted gap is 10–12.
      // The restricted window is 10am–12pm. Non-excepted class at 10am should be BLOCKED.
      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        classExceptions: [regularClass1._id],
        blocks: [[8, 10], [12, 14], [14, 16]]  // gap = 10–12 → restricted window
      })).save();

      let reg = new Registration({
        start: testDate.toDate(),
        classes: [regularClass2._id],
        trainee: trainee._id
      });

      let error;
      try {
        yield reg.save();
      } catch (err) {
        error = err;
      }
      expect(error).to.exist;
      expect(error.message).to.include('class-specific blackout');
    });

    it('should allow the excepted class in the restricted gap window', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      // Same inverted encoding as above (gap = 10–12), but this time registering the
      // EXCEPTED class (regularClass1). It should always be allowed — classExceptions
      // means "this class is not blocked." The non-excepted check (A) is false for it,
      // so it bypasses the block logic entirely.
      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        classExceptions: [regularClass1._id],
        blocks: [[8, 10], [12, 14], [14, 16]]  // gap = 10–12 → restricted window
      })).save();

      let reg = new Registration({
        start: testDate.toDate(),
        classes: [regularClass1._id],
        trainee: trainee._id
      });

      yield reg.save();
      expect(reg._id).to.exist;
    });
  });

  describe('Time block validation', () => {
    it('should only apply blackout to specified time blocks for classExplicit', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        classExplicit: [regularClass1._id],
        blocks: [[10, 12]] // Only 10-12 block
      })).save();

      // 10am should be blocked
      let reg1 = new Registration({
        start: testDate.toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });

      let error1;
      try {
        yield reg1.save();
      } catch (err) {
        error1 = err;
      }
      expect(error1).to.exist;

      // 2pm should NOT be blocked
      let reg2 = new Registration({
        start: moment(testDate).hour(14).toDate(),
        classes: [regularClass1._id],
        trainee: trainee._id
      });

      yield reg2.save();
      expect(reg2._id).to.exist;
    });

    it('should only apply blackout to specified time blocks for classExceptions', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        classExceptions: [regularClass1._id],
        blocks: [[12, 14]] // Only 12-14 block
      })).save();

      // 12pm (in blocks) should be blocked for a non-excepted class
      let reg1 = new Registration({
        start: moment(testDate).hour(12).toDate(),
        classes: [regularClass2._id], // NOT in classExceptions
        trainee: trainee._id
      });
      let err;
      try {
        yield reg1.save();
      } catch (e) {
        err = e;
      }

      expect(err).to.exist;
      expect(err.message).to.include('a class-specific blackout date');

      // 10am (outside blocks) should NOT be blocked for a non-excepted class
      let reg2 = new Registration({
        start: testDate.toDate(), // 10am — outside blocks [[12, 14]]
        trainee: trainee._id,
        classes: [regularClass2._id] // NOT in classExceptions
      });

      yield reg2.save();
      expect(reg2._id).to.exist;
    });


    it('should apply blackout to multiple time blocks', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        classExplicit: [regularClass1._id],
        blocks: [[10, 12], [14, 16]] // Morning and afternoon blocks
      })).save();

      // 10am blocked
      let reg1 = new Registration({
        start: testDate.toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });

      let error1;
      try {
        yield reg1.save();
      } catch (err) {
        error1 = err;
      }
      expect(error1).to.exist;

      // 2pm also blocked
      let reg2 = new Registration({
        start: moment(testDate).hour(14).toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });

      let error2;
      try {
        yield reg2.save();
      } catch (err) {
        error2 = err;
      }
      expect(error2).to.exist;

      // 12pm NOT blocked
      let reg3 = new Registration({
        start: moment(testDate).hour(12).toDate(),
        classes: [regularClass1._id],
        trainee: trainee._id
      });

      yield reg3.save();
      expect(reg3._id).to.exist;
    });
  });

  describe('Edge cases', () => {
    it('should handle empty class arrays as total blackout', function*() {
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour');

      yield (new BlackoutDate({
        start: moment(testDate).startOf('day').toDate(),
        end: moment(testDate).endOf('day').toDate(),
        classExplicit: [],
        hubClassExplicit: []
      })).save();

      // Should act as total blackout
      let reg = new Registration({
        start: testDate.toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });

      let error;
      try {
        yield reg.save();
      } catch (err) {
        error = err;
      }

      expect(error).to.exist;
    });

    it('should handle blackouts spanning multiple days', function*() {
      let testDate1 = moment().add(7, 'days').day(2).hour(10).startOf('hour');
      let testDate2 = moment().add(8, 'days').day(3).hour(10).startOf('hour');

      yield (new BlackoutDate({
        start: moment(testDate1).startOf('day').toDate(),
        end: moment(testDate2).endOf('day').toDate(),
        classExplicit: [regularClass1._id],
        blocks: [[10, 12]]
      })).save();

      // Day 1 should be blocked
      let reg1 = new Registration({
        start: testDate1.toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });

      let error1;
      try {
        yield reg1.save();
      } catch (err) {
        error1 = err;
      }
      expect(error1).to.exist;

      // Day 2 should be blocked
      let reg2 = new Registration({
        start: testDate2.toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });

      let error2;
      try {
        yield reg2.save();
      } catch (err) {
        error2 = err;
      }
      expect(error2).to.exist;
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // The new lab day: two-hour blocks that start on the half hour.
  //   7:30-9:30, 9:30-11:30, 11:30-1:30, Monday to Thursday.
  // ───────────────────────────────────────────────────────────────────────────
  describe('Half-hour lab day (7:30-9:30, 9:30-11:30, 11:30-1:30)', () => {
    const NOT_A_BLOCK_START = 'That time is no longer available. Please refresh the page and try again.';

    // Every other two-hour block of the day around 9:30-11:30. This is what the
    // blackout form saves when 9:30-11:30 is chosen for an "everyone except" blackout.
    const REST_OF_DAY_AROUND_930 = [
      [11.5, 13.5], [13.5, 15.5], [15.5, 17.5], [17.5, 19.5], [19.5, 21.5], [21.5, 23.5],
      [23.5, 1.5], [1.5, 3.5], [3.5, 5.5], [5.5, 7.5], [7.5, 9.5]
    ];

    let threeHourClass, fourHourClass, sixHourClass;

    // Next week's Tuesday at the given time.
    const tuesdayAt = (hours, minutes) => moment().add(7, 'days').day(2).hour(hours).minute(minutes || 0).startOf('minute');
    const fridayAt = (hours, minutes) => moment().add(7, 'days').day(5).hour(hours).minute(minutes || 0).startOf('minute');

    const clock = date => moment(date).format('HH:mm:ss.SSS');

    function book (start, classes) {
      return new Registration({
        start: moment(start).toDate(),
        trainee: trainee._id,
        classes: classes.map(c => c._id)
      });
    }

    // Saves the registration and hands back the error, if there was one.
    function* errorFromSaving (registration) {
      try {
        yield registration.save();
      } catch (error) {
        return error;
      }
    }

    beforeEach(function*() {
      // Swap the old 8-4 day (created above) for the new one. It is written
      // straight into the collection so `end: null` is stored the way the site
      // saves an empty end date.
      yield AvailableTime.remove({});
      yield AvailableTime.collection.insertOne({
        blocks: [[7.5, 9.5], [9.5, 11.5], [11.5, 13.5]],
        days: [1, 2, 3, 4],
        start: moment().startOf('day').toDate(),
        end: null
      });

      threeHourClass = yield (new Class({ name: 'Three Hour Class', hours: 3 })).save();
      fourHourClass = yield (new Class({ name: 'Four Hour Class', hours: 4 })).save();
      sixHourClass = yield (new Class({ name: 'Six Hour Class', hours: 6 })).save();
    });

    describe('booking a two-hour class', () => {
      it('books the 7:30 block and holds the seat until 9:30', function*() {
        const registration = book(tuesdayAt(7, 30), [regularClass1]);

        yield registration.save();

        expect(registration.times).to.have.lengthOf(1);
        expect(clock(registration.times[0].start)).to.equal('07:30:00.000');
        expect(clock(registration.times[0].end)).to.equal('09:29:59.999');
        expect(clock(registration.start)).to.equal('07:30:00.000');
        expect(clock(registration.end)).to.equal('09:29:59.999');
      });

      it('books the 9:30 block, not the 7:30 block', function*() {
        const registration = book(tuesdayAt(9, 30), [regularClass1]);

        yield registration.save();

        expect(registration.times).to.have.lengthOf(1);
        expect(clock(registration.times[0].start)).to.equal('09:30:00.000');
        expect(clock(registration.times[0].end)).to.equal('11:29:59.999');
      });

      it('books the 11:30 block and holds the seat until 1:30', function*() {
        const registration = book(tuesdayAt(11, 30), [regularClass1]);

        yield registration.save();

        expect(registration.times).to.have.lengthOf(1);
        expect(clock(registration.times[0].start)).to.equal('11:30:00.000');
        expect(clock(registration.times[0].end)).to.equal('13:29:59.999');
      });

      it('keeps the booking on the day that was asked for', function*() {
        const start = tuesdayAt(9, 30);
        const registration = book(start, [regularClass1]);

        yield registration.save();

        expect(moment(registration.times[0].start).isSame(start, 'day')).to.equal(true);
      });

      it('ignores seconds on the requested time', function*() {
        const registration = book(tuesdayAt(9, 30).second(12).millisecond(345), [regularClass1]);

        yield registration.save();

        expect(clock(registration.times[0].start)).to.equal('09:30:00.000');
      });
    });

    describe('times that are not the start of a block', () => {
      it('refuses 9:00 instead of quietly booking the 7:30 block', function*() {
        const registration = book(tuesdayAt(9, 0), [regularClass1]);
        const error = yield errorFromSaving(registration);

        expect(error).to.exist;
        expect(error.status).to.equal(400);
        expect(error.message).to.equal(NOT_A_BLOCK_START);
        expect(registration.times).to.have.lengthOf(0);
        expect(yield Registration.count({})).to.equal(0);
      });

      it('refuses the old 8:00 start', function*() {
        const error = yield errorFromSaving(book(tuesdayAt(8, 0), [regularClass1]));

        expect(error.status).to.equal(400);
        expect(error.message).to.equal(NOT_A_BLOCK_START);
      });

      it('refuses a time before the lab opens', function*() {
        const error = yield errorFromSaving(book(tuesdayAt(5, 30), [regularClass1]));

        expect(error.status).to.equal(400);
        expect(error.message).to.equal(NOT_A_BLOCK_START);
      });

      it('refuses closing time (1:30)', function*() {
        const error = yield errorFromSaving(book(tuesdayAt(13, 30), [regularClass1]));

        expect(error.status).to.equal(400);
        expect(error.message).to.equal(NOT_A_BLOCK_START);
      });

      it('refuses the old 2:00 afternoon start', function*() {
        const error = yield errorFromSaving(book(tuesdayAt(14, 0), [regularClass1]));

        expect(error.status).to.equal(400);
        expect(error.message).to.equal(NOT_A_BLOCK_START);
      });

      it('refuses a quarter past the block start', function*() {
        const error = yield errorFromSaving(book(tuesdayAt(9, 45), [regularClass1]));

        expect(error.status).to.equal(400);
        expect(error.message).to.equal(NOT_A_BLOCK_START);
      });
    });

    describe('days the lab is closed', () => {
      it('refuses Friday', function*() {
        const registration = book(fridayAt(7, 30), [regularClass1]);
        const error = yield errorFromSaving(registration);

        expect(error).to.exist;
        expect(error.status).to.equal(400);
        expect(registration.times).to.have.lengthOf(0);
        expect(yield Registration.count({})).to.equal(0);
      });

      it('refuses a date before the record starts', function*() {
        yield AvailableTime.remove({});
        yield AvailableTime.collection.insertOne({
          blocks: [[7.5, 9.5]],
          days: [1, 2, 3, 4],
          start: moment().add(30, 'days').startOf('day').toDate(),
          end: null
        });

        const error = yield errorFromSaving(book(tuesdayAt(7, 30), [regularClass1]));

        expect(error).to.exist;
        expect(error.status).to.equal(400);
      });

      it('refuses a date after the record ended', function*() {
        yield AvailableTime.remove({});
        yield AvailableTime.collection.insertOne({
          blocks: [[7.5, 9.5]],
          days: [1, 2, 3, 4],
          end: moment().add(1, 'days').endOf('day').toDate()
        });

        const error = yield errorFromSaving(book(tuesdayAt(7, 30), [regularClass1]));

        expect(error).to.exist;
        expect(error.status).to.equal(400);
      });
    });

    describe('classes longer than two hours', () => {
      it('gives a 3 hour class two blocks from 7:30', function*() {
        const registration = book(tuesdayAt(7, 30), [threeHourClass]);

        yield registration.save();

        expect(registration.times.map(t => clock(t.start))).to.deep.equal(['07:30:00.000', '09:30:00.000']);
        expect(clock(registration.end)).to.equal('11:29:59.999');
      });

      it('gives a 3 hour class two blocks from 9:30', function*() {
        const registration = book(tuesdayAt(9, 30), [threeHourClass]);

        yield registration.save();

        expect(registration.times.map(t => clock(t.start))).to.deep.equal(['09:30:00.000', '11:30:00.000']);
        expect(clock(registration.end)).to.equal('13:29:59.999');
      });

      it('refuses a 3 hour class at 11:30 and saves nothing', function*() {
        const registration = book(tuesdayAt(11, 30), [threeHourClass]);
        const error = yield errorFromSaving(registration);

        expect(error).to.exist;
        expect(yield Registration.count({})).to.equal(0);
      });

      it('gives a 4 hour class two blocks from 9:30', function*() {
        const registration = book(tuesdayAt(9, 30), [fourHourClass]);

        yield registration.save();

        expect(registration.times.map(t => clock(t.start))).to.deep.equal(['09:30:00.000', '11:30:00.000']);
      });

      it('refuses a 4 hour class at 11:30', function*() {
        const error = yield errorFromSaving(book(tuesdayAt(11, 30), [fourHourClass]));

        expect(error).to.exist;
        expect(yield Registration.count({})).to.equal(0);
      });

      it('gives a 6 hour class the whole day from 7:30', function*() {
        const registration = book(tuesdayAt(7, 30), [sixHourClass]);

        yield registration.save();

        expect(registration.times.map(t => clock(t.start))).to.deep.equal(['07:30:00.000', '09:30:00.000', '11:30:00.000']);
      });

      it('refuses a 6 hour class at 9:30', function*() {
        const error = yield errorFromSaving(book(tuesdayAt(9, 30), [sixHourClass]));

        expect(error).to.exist;
        expect(yield Registration.count({})).to.equal(0);
      });

      it('adds up two classes: two 2 hour classes take two blocks', function*() {
        const registration = book(tuesdayAt(7, 30), [regularClass1, regularClass2]);

        yield registration.save();

        expect(registration.times.map(t => clock(t.start))).to.deep.equal(['07:30:00.000', '09:30:00.000']);
      });

      it('refuses two 2 hour classes together at 11:30', function*() {
        const error = yield errorFromSaving(book(tuesdayAt(11, 30), [regularClass1, regularClass2]));

        expect(error).to.exist;
        expect(yield Registration.count({})).to.equal(0);
      });
    });

    describe('seats', () => {
      it('gives each booking in the same block its own seat', function*() {
        const first = book(tuesdayAt(9, 30), [regularClass1]);
        const second = book(tuesdayAt(9, 30), [regularClass1]);
        const third = book(tuesdayAt(9, 30), [regularClass1]);

        yield first.save();
        yield second.save();
        yield third.save();

        const seats = [first, second, third].map(r => r.times[0].seat.toString());

        expect(new Set(seats).size).to.equal(3);
      });

      it('refuses a booking when every seat in the block is taken', function*() {
        yield book(tuesdayAt(9, 30), [regularClass1]).save();
        yield book(tuesdayAt(9, 30), [regularClass1]).save();
        yield book(tuesdayAt(9, 30), [regularClass1]).save();

        const error = yield errorFromSaving(book(tuesdayAt(9, 30), [regularClass1]));

        expect(error).to.exist;
        expect(error.message).to.include('No seat could be found');
        expect(yield Registration.count({})).to.equal(3);
      });

      it('does not count a full 9:30 block against 7:30 or 11:30', function*() {
        yield book(tuesdayAt(9, 30), [regularClass1]).save();
        yield book(tuesdayAt(9, 30), [regularClass1]).save();
        yield book(tuesdayAt(9, 30), [regularClass1]).save();

        const early = book(tuesdayAt(7, 30), [regularClass1]);
        const late = book(tuesdayAt(11, 30), [regularClass1]);

        yield early.save();
        yield late.save();

        expect(early.times).to.have.lengthOf(1);
        expect(late.times).to.have.lengthOf(1);
      });

      it('refuses a 3 hour class when its second block is full, and saves nothing for it', function*() {
        yield book(tuesdayAt(9, 30), [regularClass1]).save();
        yield book(tuesdayAt(9, 30), [regularClass1]).save();
        yield book(tuesdayAt(9, 30), [regularClass1]).save();

        const error = yield errorFromSaving(book(tuesdayAt(7, 30), [threeHourClass]));

        expect(error).to.exist;
        expect(error.message).to.include('No seat could be found');
        expect(yield Registration.count({})).to.equal(3);
      });

      it('frees the seat of a cancelled booking', function*() {
        const cancelled = book(tuesdayAt(9, 30), [regularClass1]);

        yield cancelled.save();
        yield book(tuesdayAt(9, 30), [regularClass1]).save();
        yield book(tuesdayAt(9, 30), [regularClass1]).save();

        yield Registration.update({ _id: cancelled._id }, { $set: { cancelledOn: new Date() } });

        const replacement = book(tuesdayAt(9, 30), [regularClass1]);

        yield replacement.save();

        expect(replacement.times).to.have.lengthOf(1);
      });
    });

    describe('blackouts saved on half-hour blocks', () => {
      const wholeDay = () => ({
        start: tuesdayAt(0, 0).startOf('day').toDate(),
        end: tuesdayAt(0, 0).endOf('day').toDate()
      });

      it('refuses every block on a day that is blacked out for everyone', function*() {
        yield (new BlackoutDate(wholeDay())).save();

        const error = yield errorFromSaving(book(tuesdayAt(9, 30), [regularClass1]));

        expect(error).to.exist;
        expect(error.message).to.include('blackout date');
        expect(yield Registration.count({})).to.equal(0);
      });

      it('"only these classes" blocks the named class in the listed block', function*() {
        yield (new BlackoutDate(Object.assign(wholeDay(), {
          classExplicit: [regularClass1._id],
          blocks: [[9.5, 11.5]]
        }))).save();

        const error = yield errorFromSaving(book(tuesdayAt(9, 30), [regularClass1]));

        expect(error).to.exist;
        expect(error.message).to.include('class-specific blackout');
      });

      it('"only these classes" lets another class into the same block', function*() {
        yield (new BlackoutDate(Object.assign(wholeDay(), {
          classExplicit: [regularClass1._id],
          blocks: [[9.5, 11.5]]
        }))).save();

        const registration = book(tuesdayAt(9, 30), [regularClass2]);

        yield registration.save();

        expect(clock(registration.times[0].start)).to.equal('09:30:00.000');
      });

      it('"only these classes" leaves the blocks before and after alone', function*() {
        yield (new BlackoutDate(Object.assign(wholeDay(), {
          classExplicit: [regularClass1._id],
          blocks: [[9.5, 11.5]]
        }))).save();

        const early = book(tuesdayAt(7, 30), [regularClass1]);
        const late = book(tuesdayAt(11, 30), [regularClass1]);

        yield early.save();
        yield late.save();

        expect(clock(early.times[0].start)).to.equal('07:30:00.000');
        expect(clock(late.times[0].start)).to.equal('11:30:00.000');
      });

      it('"only these classes" stops a longer class that would run into the listed block', function*() {
        yield (new BlackoutDate(Object.assign(wholeDay(), {
          classExplicit: [threeHourClass._id],
          blocks: [[9.5, 11.5]]
        }))).save();

        const error = yield errorFromSaving(book(tuesdayAt(7, 30), [threeHourClass]));

        expect(error).to.exist;
        expect(error.message).to.include('class-specific blackout');
        expect(yield Registration.count({})).to.equal(0);
      });

      it('"everyone except" blocks other classes in the chosen block', function*() {
        yield (new BlackoutDate(Object.assign(wholeDay(), {
          classExceptions: [regularClass1._id],
          blocks: REST_OF_DAY_AROUND_930
        }))).save();

        const error = yield errorFromSaving(book(tuesdayAt(9, 30), [regularClass2]));

        expect(error).to.exist;
        expect(error.message).to.include('class-specific blackout');
      });

      it('"everyone except" lets the excepted class into the chosen block', function*() {
        yield (new BlackoutDate(Object.assign(wholeDay(), {
          classExceptions: [regularClass1._id],
          blocks: REST_OF_DAY_AROUND_930
        }))).save();

        const registration = book(tuesdayAt(9, 30), [regularClass1]);

        yield registration.save();

        expect(clock(registration.times[0].start)).to.equal('09:30:00.000');
      });

      it('"everyone except" lets other classes book outside the chosen block', function*() {
        yield (new BlackoutDate(Object.assign(wholeDay(), {
          classExceptions: [regularClass1._id],
          blocks: REST_OF_DAY_AROUND_930
        }))).save();

        const early = book(tuesdayAt(7, 30), [regularClass2]);
        const late = book(tuesdayAt(11, 30), [regularClass2]);

        yield early.save();
        yield late.save();

        expect(early.times).to.have.lengthOf(1);
        expect(late.times).to.have.lengthOf(1);
      });

      it('"everyone except" with the blocks listed directly restricts only that block', function*() {
        yield (new BlackoutDate(Object.assign(wholeDay(), {
          classExceptions: [regularClass1._id],
          blocks: [[9.5, 11.5]]
        }))).save();

        const blocked = yield errorFromSaving(book(tuesdayAt(9, 30), [regularClass2]));
        const allowed = book(tuesdayAt(7, 30), [regularClass2]);

        yield allowed.save();

        expect(blocked).to.exist;
        expect(blocked.message).to.include('class-specific blackout');
        expect(allowed.times).to.have.lengthOf(1);
      });

      it('a hub class blackout blocks regular classes only in its listed block', function*() {
        yield (new BlackoutDate(Object.assign(wholeDay(), {
          hubClassExceptions: [hubClass1._id],
          blocks: [[7.5, 9.5]]
        }))).save();

        const blocked = yield errorFromSaving(book(tuesdayAt(7, 30), [regularClass1]));
        const allowed = book(tuesdayAt(9, 30), [regularClass1]);

        yield allowed.save();

        expect(blocked).to.exist;
        expect(blocked.message).to.include('class-specific blackout');
        expect(allowed.times).to.have.lengthOf(1);
      });

      it('a blackout on another day does not affect the booking', function*() {
        yield (new BlackoutDate({
          start: tuesdayAt(0, 0).add(1, 'day').startOf('day').toDate(),
          end: tuesdayAt(0, 0).add(1, 'day').endOf('day').toDate(),
          classExplicit: [regularClass1._id],
          blocks: [[9.5, 11.5]]
        })).save();

        const registration = book(tuesdayAt(9, 30), [regularClass1]);

        yield registration.save();

        expect(registration.times).to.have.lengthOf(1);
      });
    });
  });

  describe('Old whole-hour lab day (8-10, 10-12, 12-2, 2-4)', () => {
    it('still books a block by its start time', function*() {
      const start = moment().add(7, 'days').day(2).hour(12).startOf('hour');
      const registration = new Registration({ start: start.toDate(), trainee: trainee._id, classes: [regularClass1._id] });

      yield registration.save();

      expect(moment(registration.times[0].start).format('HH:mm:ss.SSS')).to.equal('12:00:00.000');
      expect(moment(registration.times[0].end).format('HH:mm:ss.SSS')).to.equal('13:59:59.999');
    });

    it('books a 4 hour stay as two blocks', function*() {
      const start = moment().add(7, 'days').day(2).hour(8).startOf('hour');
      const registration = new Registration({ start: start.toDate(), trainee: trainee._id, classes: [regularClass1._id, regularClass2._id] });

      yield registration.save();

      expect(registration.times.map(t => moment(t.start).format('HH:mm'))).to.deep.equal(['08:00', '10:00']);
      expect(moment(registration.end).format('HH:mm:ss.SSS')).to.equal('11:59:59.999');
    });

    it('refuses a time in the middle of a block (it used to be moved to the block start)', function*() {
      const start = moment().add(7, 'days').day(2).hour(9).startOf('hour');
      const registration = new Registration({ start: start.toDate(), trainee: trainee._id, classes: [regularClass1._id] });

      let error;
      try {
        yield registration.save();
      } catch (err) {
        error = err;
      }

      expect(error).to.exist;
      expect(error.status).to.equal(400);
      expect(error.message).to.equal('That time is no longer available. Please refresh the page and try again.');
    });

    it('refuses a class that would run past the last block', function*() {
      const start = moment().add(7, 'days').day(2).hour(14).startOf('hour');
      const registration = new Registration({ start: start.toDate(), trainee: trainee._id, classes: [regularClass1._id, regularClass2._id] });

      let error;
      try {
        yield registration.save();
      } catch (err) {
        error = err;
      }

      expect(error).to.exist;
      expect(yield Registration.count({})).to.equal(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // The switch: bookings already made on the old times (8-10) are still on the
  // calendar when the lab moves to 7:30-9:30, 9:30-11:30, 11:30-1:30.
  // The lab has three seats (created at the top of this file).
  // ───────────────────────────────────────────────────────────────────────────
  describe('Old-time bookings on a day that now uses the half-hour blocks', () => {
    const tuesdayAt = (hours, minutes) => moment().add(7, 'days').day(2).hour(hours).minute(minutes || 0).startOf('minute');

    let oldBookingSeat;

    function newBooking (hours, minutes) {
      return new Registration({
        start: tuesdayAt(hours, minutes).toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });
    }

    function* errorFromSaving (registration) {
      try {
        yield registration.save();
      } catch (error) {
        return error;
      }
    }

    beforeEach(function*() {
      // One booking made before the switch, 8:00-10:00, on the old day.
      const oldBooking = new Registration({
        start: tuesdayAt(8).toDate(),
        trainee: trainee._id,
        classes: [regularClass1._id]
      });

      yield oldBooking.save();
      oldBookingSeat = oldBooking.times[0].seat.toString();

      // The switch: the old day is replaced by the new one.
      yield AvailableTime.remove({});
      yield AvailableTime.collection.insertOne({
        blocks: [[7.5, 9.5], [9.5, 11.5], [11.5, 13.5]],
        days: [1, 2, 3, 4],
        end: null
      });
    });

    it('fills the 7:30 block with two more people, not three', function*() {
      const first = newBooking(7, 30);
      const second = newBooking(7, 30);

      yield first.save();
      yield second.save();

      const error = yield errorFromSaving(newBooking(7, 30));

      expect(error).to.exist;
      expect(error.message).to.include('No seat could be found');
      expect(yield Registration.count({})).to.equal(3); // the old booking and two new ones
    });

    it('fills the 9:30 block with two more people, not three', function*() {
      yield newBooking(9, 30).save();
      yield newBooking(9, 30).save();

      const error = yield errorFromSaving(newBooking(9, 30));

      expect(error).to.exist;
      expect(error.message).to.include('No seat could be found');
    });

    it('never gives a new booking the seat the old booking is sitting in', function*() {
      const at730 = newBooking(7, 30);
      const alsoAt730 = newBooking(7, 30);
      const at930 = newBooking(9, 30);

      yield at730.save();
      yield alsoAt730.save();
      yield at930.save();

      [at730, alsoAt730, at930].forEach(booking => {
        expect(booking.times[0].seat.toString()).to.not.equal(oldBookingSeat);
      });
    });

    it('leaves all three seats free at 11:30, after the old booking is over', function*() {
      yield newBooking(11, 30).save();
      yield newBooking(11, 30).save();
      yield newBooking(11, 30).save();

      expect(yield Registration.count({})).to.equal(4);
    });

    it('frees the seat for both blocks once the old booking is cancelled', function*() {
      yield Registration.update({}, { $set: { cancelledOn: new Date() } });

      yield newBooking(7, 30).save();
      yield newBooking(7, 30).save();
      yield newBooking(7, 30).save();

      yield newBooking(9, 30).save();
      yield newBooking(9, 30).save();
      yield newBooking(9, 30).save();

      expect(yield Registration.count({ cancelledOn: null })).to.equal(6);
    });
  });
});
