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
});
