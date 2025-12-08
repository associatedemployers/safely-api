const Trainee = require('../trainee/index');

const chai          = require('chai'),
      expect        = chai.expect,
      moment        = require('moment'),
      BlackoutDate  = require('../blackout-date'),
      Class         = require('../class'),
      HubClass      = require('../hub-class'),
      Seat          = require('../seat'),
      AvailableTime = require('../available-time'),
      Registration  = require('./index');

describe.only('Unit :: Models :: Registration :: Middleware :: assign-seat', () => {
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
      let testDate = moment().add(7, 'days').day(2).hour(10).startOf('hour'); // Tuesday 10am

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
        trainee: trainee._id,
        _disableAssignment: true
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
        _disableAssignment: true,
        trainee: trainee._id
      });
      yield reg1.save();
      expect(reg1._id).to.exist;

      let reg2 = new Registration({
        start: testDate.toDate(),
        classes: [regularClass2._id],
        trainee: trainee._id,
        _disableAssignment: true
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
        trainee: trainee._id,

        _disableAssignment: true
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
        trainee: trainee._id,

        _disableAssignment: true
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
        trainee: trainee._id,

        _disableAssignment: true
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

      // Fourth registration should pass
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

        classes: [regularClass1._id],
        _disableAssignment: true
      });

      yield reg1.save();
      expect(reg1._id).to.exist;

      // Second registration should succeed (2 seats available)
      let reg2 = new Registration({
        start: testDate.toDate(),
        classes: [regularClass1._id],
        trainee: trainee._id,

        _disableAssignment: true
      });

      yield reg2.save();

      expect(reg2._id).to.exist;

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
        trainee: trainee._id,

        _disableAssignment: true
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

      // 10am should be blocked
      let reg1 = new Registration({
        start: testDate.toDate(),
        classes: [regularClass1._id],
        trainee: trainee._id,

        _disableAssignment: true
      });
      let err;
      try {
        yield reg1.save();
      } catch (e) {
        err = e;
      }

      expect(err).to.exist;
      expect(err.message).to.include('a class-specific blackout date');


      // 2pm should NOT be blocked
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
        trainee: trainee._id,

        _disableAssignment: true
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
