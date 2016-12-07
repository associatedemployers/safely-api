const chai   = require('chai'),
      expect = chai.expect,
      moment = require('moment'),
      _      = require('lodash'),
      Model  = require('.'),
      Class  = require('../class'),
      Seat   = require('../seat');

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
  });

  afterEach(function*() {
    yield require('mongoose').connection.dropDatabase();
  });

  describe('registering', () => {
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
        console.log(e.message);
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

      reg.times.forEach(time => {
        console.log(`Seat: ${time.seat} | ${moment(time.start).format('M/D h:mma')} - ${moment(time.end).format('M/D h:mma')}`);
      });
    });

    it('should work if there are available seats while unavailable seats exist', function*() {
      let eightAm = moment().day(1).hour(8).toDate();

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
          seat: seat2._id
        }]
      })).save();

      let registration = new Model({
        start: eightAm,
        classes: [ classes[0], classes[1], classes[7] ]
      });

      let reg = yield registration.save();

      expect(reg.times).to.have.lengthOf(4);
      reg.times.forEach(time => {
        console.log(`Seat: ${time.seat} | ${moment(time.start).format('M/D h:mma')} - ${moment(time.end).format('M/D h:mma')}`);
      });
      reg.times.forEach((time, i) => {
        expect(moment(time.start).hour()).to.equal(i * 2 + 8);
        expect(moment(time.start).day()).to.equal(1);
        expect(moment(time.end).add(2, 'minutes').hour()).to.equal(i * 2 + 10);
        expect(moment(time.end).day()).to.equal(1);
        expect(time.seat.toString()).to.equal((i === 0 ? seat2 : seat)._id.toString());
      });
    });
  });
});
