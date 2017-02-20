const chai          = require('chai'),
      expect        = chai.expect,
      moment        = require('moment'),
      Model         = require('.'),
      Class         = require('../class'),
      Seat          = require('../seat'),
      BlackoutDate  = require('../blackout-date'),
      AvailableTime = require('../available-time');

require('../../load/winston')();

describe('Integration :: Registration Model', () => {
  let classes;

  beforeEach(function*() {
    require('../../load/mongoose')();
    classes = [];

    for (let i = 0; i < 10; i++) {
      classes.push(yield (new Class({
        name: `Class #${i + 1}`,
        hours: i < 6 ? 2 : 4
      })).save());
    }

    yield (new AvailableTime({
      blocks: [[8,10],[10,12],[12,14],[14,16]],
      days: [1,2,3,4,5]
    })).save();
  });

  afterEach(function*() {
    yield require('mongoose').connection.dropDatabase();
  });

  describe('Registering', () => {
    it('should fail if start date is outside a block', function*() {
      let registration = new Model({
        start: moment().day(0).hour(6).toDate()
      });

      try {
        yield registration.save();
      } catch (e) {
        expect(e.message.toLowerCase()).to.contain('start date');
        return;
      }

      throw new Error('Expected error');
    });

    it('should fail if there\'s no available seat', function*() {
      let registration = new Model({
        start: moment().day(1).hour(8).toDate(),
        classes: [ classes[0], classes[1], classes[7] ]
      });

      try {
        yield registration.save();
      } catch (e) {
        expect(e.message.toLowerCase()).to.contain('seat');
        return;
      }

      throw new Error('Expected error');
    });

    it('should work if there are available seats', function*() {
      let seat = yield (new Seat({
        number: 1
      })).save();

      let registration = new Model({
        start: moment().day(1).hour(8).toDate(),
        classes: [ classes[0], classes[1], classes[7] ]
      });

      let reg = yield registration.save();

      expect(reg.times).to.have.lengthOf(4);

      reg.times.forEach((time, i) => {
        expect(moment(time.start).hour()).to.equal(i * 2 + 8);
        expect(moment(time.start).day()).to.equal(1);
        expect(moment(time.end).add(2, 'minutes').hour()).to.equal(i * 2 + 10);
        expect(moment(time.end).day()).to.equal(1);
        expect(time.seat.toString()).to.equal(seat._id.toString());
      });
    });

    it('should work if there are available seats while unavailable seats exist', function*() {
      let eightAm = moment().day(1).hour(8).startOf('hour').toDate();

      let seat = yield (new Seat({
        number: 1
      })).save();

      let seat2 = yield (new Seat({
        number: 2
      })).save();

      yield (new Model({
        _disableAssignment: true,
        start: eightAm,
        classes: [ classes[0]._id ],
        times: [{
          start: eightAm,
          end: moment(eightAm).add(1, 'hour').endOf('hour').toDate(),
          seat: seat._id
        }]
      })).save();

      let registration = new Model({
        start: eightAm,
        classes: [ classes[0], classes[1], classes[7] ]
      });

      let reg = yield registration.save();

      expect(reg.times).to.have.lengthOf(4);

      reg.times.forEach((time, i) => {
        expect(moment(time.start).hour()).to.equal(i * 2 + 8);
        expect(moment(time.start).day()).to.equal(1);
        expect(moment(time.end).add(2, 'minutes').hour()).to.equal(i * 2 + 10);
        expect(moment(time.end).day()).to.equal(1);
        expect(time.seat.toString()).to.equal((i === 0 ? seat2 : seat)._id.toString());
      });
    });

    it('should schedule over blackouts and weekends', function*() {
      let seat = yield (new Seat({
        number: 1
      })).save();

      yield (new BlackoutDate({
        start: moment().day(1).startOf('day'),
        end: moment().day(1).endOf('day')
      })).save();

      let registration = new Model({
        start: moment().subtract(1, 'week').day(5).hour(8).startOf('hour').toDate(),
        classes: [ classes[0], classes[1], classes[7], classes[8] ] // 12 hours
      });

      let reg = yield registration.save();

      expect(reg.times).to.have.lengthOf(6);

      for (let i = 0; i < 4; i++) {
        let time = reg.times[i];
        expect(moment(time.start).hour()).to.equal(i * 2 + 8);
        expect(moment(time.start).day()).to.equal(5);
        expect(moment(time.end).add(2, 'minutes').hour()).to.equal(i * 2 + 10);
        expect(moment(time.end).day()).to.equal(5);
        expect(time.seat.toString()).to.equal(seat._id.toString());
      }

      for (let i = 4; i < 6; i++) {
        let time = reg.times[i],
            ni = i - 4;

        expect(moment(time.start).day()).to.equal(2);
        expect(moment(time.start).hour()).to.equal(ni * 2 + 8);
        expect(moment(time.end).day()).to.equal(2);
        expect(moment(time.end).add(2, 'minutes').hour()).to.equal(ni * 2 + 10);
        expect(time.seat.toString()).to.equal(seat._id.toString());
      }
    });

    it('should schedule with class blackouts', function*() {
      yield (new Seat({
        number: 1
      })).save();

      yield (new BlackoutDate({
        start: moment().day(1).startOf('day').toDate(),
        end: moment().day(1).endOf('day').toDate(),
        classExceptions: classes.slice(0, 2),
        blocks: [[8,10],[10,12]]
      })).save();

      yield (new BlackoutDate({
        start: moment().day(1).startOf('day').toDate(),
        end: moment().day(2).endOf('day').toDate(),
        classExceptions: classes.slice(2, 4),
        blocks: [[10,12],[12,14]]
      })).save();

      let failingRegistrations = [{
        start: moment().day(1).hour(8),
        classes: [ classes[0], classes[7] ]
      }, {
        start: moment().day(1).hour(12),
        classes: [ classes[2], classes[6] ]
      }, {
        start: moment().day(2).hour(10),
        classes: [ classes[2], classes[7] ]
      }];

      let passingRegistrations = [{
        start: moment().day(1).hour(8),
        classes: [ classes[1], classes[0] ]
      }, {
        start: moment().day(2).hour(10),
        classes: [ classes[2], classes[3] ]
      }, {
        start: moment().day(3).hour(8),
        classes: [ classes[0], classes[4] ]
      }];

      let createReg = data => new Model({
        start: data.start.startOf('hour').toDate(),
        classes: data.classes
      });

      for (let i = 0; i < failingRegistrations.length; i++) {
        let err;

        try {
          yield createReg(failingRegistrations[i]).save();
        } catch (e) {
          err = e;
        }

        expect(err, 'Expected error to exist').to.exist;
        expect(err.message.toLowerCase()).to.contain('class');
      }

      for (let i = 0; i < passingRegistrations.length; i++) {
        let reg = yield createReg(passingRegistrations[i]).save();
        expect(reg.times, `Expect registration #${i} to have length of 2`).to.have.lengthOf(2);
        yield reg.remove();
      }
    });
  });
});
