const chai         = require('chai'),
      expect       = chai.expect,
      moment       = require('moment'),
      mongoose     = require('mongoose'),
      loadMongoose = require('../../load/mongoose'),
      Seat         = require('./index'),
      Registration = require('../registration');

const { overlapsWindow, timesOverlapping, findSeatsInUse } = require('./seats-in-use');

const DAY = '2027-02-02'; // a Tuesday

const at = clock => moment(`${DAY} ${clock}`, 'YYYY-MM-DD HH:mm:ss.SSS').toDate();

// A block the way seat assignment holds it: from its start to the last
// millisecond before it ends. held('08:00', '10:00') is 8:00:00.000 - 9:59:59.999.
function held (from, to) {
  return {
    start: at(`${from}:00.000`),
    end: moment(at(`${to}:00.000`)).subtract(1, 'millisecond').toDate()
  };
}

const OLD_8_TO_10 = held('08:00', '10:00');
const OLD_10_TO_12 = held('10:00', '12:00');
const NEW_730_TO_930 = held('07:30', '09:30');
const NEW_930_TO_1130 = held('09:30', '11:30');
const NEW_1130_TO_130 = held('11:30', '13:30');

describe('Unit :: Models :: Seat :: seats in use', () => {
  let seat1, seat2, seat3;

  before(done => {
    const conn = loadMongoose();
    if (conn.readyState === 1) return done();
    conn.once('open', done);
    conn.once('error', done);
  });

  beforeEach(function*() {
    seat1 = yield (new Seat({ number: 1 })).save();
    seat2 = yield (new Seat({ number: 2 })).save();
    seat3 = yield (new Seat({ number: 3 })).save();
  });

  afterEach(function*() {
    yield mongoose.connection.dropDatabase();
  });

  // Writes a booking straight into the collection, skipping seat assignment,
  // so bookings made on the old times and the new times can sit side by side.
  // `blocks` is a list of [ heldTime, seat ].
  function* existingBooking (blocks, extraFields) {
    const times = blocks.map(block => ({ start: block[0].start, end: block[0].end, seat: block[1]._id }));

    yield Registration.collection.insertOne(Object.assign({
      start: times[0].start,
      end: times[times.length - 1].end,
      times
    }, extraFields));
  }

  const idsOf = seats => seats.map(seat => seat.toString()).sort();

  describe('overlapsWindow', () => {
    it('is true when the held time is the window', () => {
      expect(overlapsWindow(OLD_8_TO_10, OLD_8_TO_10.start, OLD_8_TO_10.end)).to.equal(true);
    });

    it('is true when the held time starts before the window and runs into it', () => {
      expect(overlapsWindow(OLD_8_TO_10, NEW_930_TO_1130.start, NEW_930_TO_1130.end)).to.equal(true);
    });

    it('is true when the held time starts inside the window and runs past it', () => {
      expect(overlapsWindow(OLD_8_TO_10, NEW_730_TO_930.start, NEW_730_TO_930.end)).to.equal(true);
    });

    it('is true when the held time sits wholly inside the window', () => {
      expect(overlapsWindow(held('08:00', '09:00'), NEW_730_TO_930.start, NEW_730_TO_930.end)).to.equal(true);
    });

    it('is true when the held time wholly covers the window', () => {
      expect(overlapsWindow(held('07:00', '12:00'), NEW_930_TO_1130.start, NEW_930_TO_1130.end)).to.equal(true);
    });

    it('is false for the block right after: one ends as the other starts', () => {
      expect(overlapsWindow(NEW_730_TO_930, NEW_930_TO_1130.start, NEW_930_TO_1130.end)).to.equal(false);
    });

    it('is false for the block right before', () => {
      expect(overlapsWindow(NEW_930_TO_1130, NEW_730_TO_930.start, NEW_730_TO_930.end)).to.equal(false);
    });

    it('is false for blocks that are apart', () => {
      expect(overlapsWindow(OLD_8_TO_10, NEW_1130_TO_130.start, NEW_1130_TO_130.end)).to.equal(false);
    });

    describe('asked about one exact moment (start and end the same)', () => {
      const isTakenAt = (time, moment) => overlapsWindow(time, moment, moment);

      it('is true at the first moment of the held time', () => {
        expect(isTakenAt(NEW_930_TO_1130, at('09:30:00.000'))).to.equal(true);
      });

      it('is true in the middle of the held time', () => {
        expect(isTakenAt(NEW_930_TO_1130, at('10:15:00.000'))).to.equal(true);
      });

      it('is true at the last held millisecond', () => {
        expect(isTakenAt(NEW_930_TO_1130, at('11:29:59.999'))).to.equal(true);
      });

      it('is false one millisecond after the held time', () => {
        expect(isTakenAt(NEW_930_TO_1130, at('11:30:00.000'))).to.equal(false);
      });

      it('is false one millisecond before the held time', () => {
        expect(isTakenAt(NEW_930_TO_1130, at('09:29:59.999'))).to.equal(false);
      });
    });
  });

  describe('timesOverlapping', () => {
    it('builds the database condition for a held time that overlaps the window', () => {
      expect(timesOverlapping(NEW_730_TO_930.start, NEW_730_TO_930.end)).to.deep.equal({
        $elemMatch: {
          start: { $lte: NEW_730_TO_930.end },
          end: { $gte: NEW_730_TO_930.start }
        }
      });
    });
  });

  describe('findSeatsInUse', () => {
    it('counts an old 8-10 booking against the new 7:30-9:30 block', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1]]);

      const inUse = yield findSeatsInUse(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(idsOf(inUse.seats)).to.deep.equal(idsOf([seat1._id]));
    });

    it('counts the same old booking against the new 9:30-11:30 block too', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1]]);

      const inUse = yield findSeatsInUse(NEW_930_TO_1130.start, NEW_930_TO_1130.end);

      expect(idsOf(inUse.seats)).to.deep.equal(idsOf([seat1._id]));
    });

    it('does not count it against the 11:30-1:30 block', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1]]);

      const inUse = yield findSeatsInUse(NEW_1130_TO_130.start, NEW_1130_TO_130.end);

      expect(inUse.seats).to.deep.equal([]);
    });

    it('does not count the block before against the block after', function*() {
      yield existingBooking([[NEW_730_TO_930, seat1]]);

      const inUse = yield findSeatsInUse(NEW_930_TO_1130.start, NEW_930_TO_1130.end);

      expect(inUse.seats).to.deep.equal([]);
    });

    it('does not count the block after against the block before', function*() {
      yield existingBooking([[NEW_930_TO_1130, seat1]]);

      const inUse = yield findSeatsInUse(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(inUse.seats).to.deep.equal([]);
    });

    it('still counts a booking for exactly the same block', function*() {
      yield existingBooking([[NEW_930_TO_1130, seat2]]);

      const inUse = yield findSeatsInUse(NEW_930_TO_1130.start, NEW_930_TO_1130.end);

      expect(idsOf(inUse.seats)).to.deep.equal(idsOf([seat2._id]));
    });

    it('ignores a cancelled booking', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1]], { cancelledOn: new Date() });

      const inUse = yield findSeatsInUse(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(inUse.seats).to.deep.equal([]);
    });

    it('counts a booking whose cancelledOn is saved as null', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1]], { cancelledOn: null });

      const inUse = yield findSeatsInUse(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(idsOf(inUse.seats)).to.deep.equal(idsOf([seat1._id]));
    });

    it('counts both seats of a two-block booking when the window touches both blocks', function*() {
      // An old four hour booking: 8-10 in seat 1, then 10-12 in seat 2.
      yield existingBooking([[OLD_8_TO_10, seat1], [OLD_10_TO_12, seat2]]);

      // 9:30-11:30 runs across both of its blocks.
      const inUse = yield findSeatsInUse(NEW_930_TO_1130.start, NEW_930_TO_1130.end);

      expect(idsOf(inUse.seats)).to.deep.equal(idsOf([seat1._id, seat2._id]));
    });

    it('counts only the seat of the block the window touches', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1], [OLD_10_TO_12, seat2]]);

      // 7:30-9:30 only reaches the 8-10 block.
      const inUse = yield findSeatsInUse(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(idsOf(inUse.seats)).to.deep.equal(idsOf([seat1._id]));
    });

    it('counts a seat once when two blocks of one booking hold the same seat', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1], [OLD_10_TO_12, seat1]]);

      const inUse = yield findSeatsInUse(NEW_930_TO_1130.start, NEW_930_TO_1130.end);

      expect(idsOf(inUse.seats)).to.deep.equal(idsOf([seat1._id]));
    });

    it('counts the seats of several bookings', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1]]);
      yield existingBooking([[NEW_730_TO_930, seat3]]);

      const inUse = yield findSeatsInUse(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(idsOf(inUse.seats)).to.deep.equal(idsOf([seat1._id, seat3._id]));
    });

    it('does not count a booking on another day', function*() {
      const nextDay = time => moment(time).add(1, 'day').toDate();

      yield Registration.collection.insertOne({
        start: nextDay(OLD_8_TO_10.start),
        end: nextDay(OLD_8_TO_10.end),
        times: [{ start: nextDay(OLD_8_TO_10.start), end: nextDay(OLD_8_TO_10.end), seat: seat1._id }]
      });

      const inUse = yield findSeatsInUse(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(inUse.seats).to.deep.equal([]);
    });

    it('hands back the bookings it found, with their classes', function*() {
      const classId = new mongoose.Types.ObjectId();

      yield existingBooking([[OLD_8_TO_10, seat1]], { classes: [classId] });

      const inUse = yield findSeatsInUse(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(inUse.registrations).to.have.lengthOf(1);
      expect(inUse.registrations[0].classes.map(String)).to.deep.equal([classId.toString()]);
    });

    it('finds nothing when there are no bookings', function*() {
      const inUse = yield findSeatsInUse(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(inUse.seats).to.deep.equal([]);
      expect(inUse.registrations).to.deep.equal([]);
    });
  });

  describe('Seat.findAvailableSeat', () => {
    it('does not hand out the seat of an old booking that overlaps the new block', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1]]);

      const seat = yield Seat.findAvailableSeat(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(seat).to.exist;
      expect(seat._id.toString()).to.not.equal(seat1._id.toString());
    });

    it('gives a free seat when another seat in the same block is taken', function*() {
      yield existingBooking([[NEW_930_TO_1130, seat2]]);

      const seat = yield Seat.findAvailableSeat(NEW_930_TO_1130.start, NEW_930_TO_1130.end);

      expect(seat).to.exist;
      expect(seat._id.toString()).to.not.equal(seat2._id.toString());
    });

    it('gives the only seat left when old and new bookings hold the others', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1]]);
      yield existingBooking([[NEW_730_TO_930, seat3]]);

      const seat = yield Seat.findAvailableSeat(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(seat._id.toString()).to.equal(seat2._id.toString());
    });

    it('lets the block after reuse the seat of the block before', function*() {
      // Seats 2 and 3 are taken at 9:30, and seat 1 was only held until 9:30.
      yield existingBooking([[NEW_730_TO_930, seat1]]);
      yield existingBooking([[NEW_930_TO_1130, seat2]]);
      yield existingBooking([[NEW_930_TO_1130, seat3]]);

      const seat = yield Seat.findAvailableSeat(NEW_930_TO_1130.start, NEW_930_TO_1130.end);

      expect(seat._id.toString()).to.equal(seat1._id.toString());
    });

    it('gives nothing when old and new bookings together hold every seat', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1]]);
      yield existingBooking([[NEW_730_TO_930, seat2]]);
      yield existingBooking([[NEW_730_TO_930, seat3]]);

      const seat = yield Seat.findAvailableSeat(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(seat).to.equal(undefined);
    });

    it('never gives an inactive seat', function*() {
      yield Seat.update({ _id: { $in: [seat1._id, seat2._id] } }, { $set: { inactive: true } }, { multi: true, strict: false });

      const seat = yield Seat.findAvailableSeat(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(seat._id.toString()).to.equal(seat3._id.toString());
    });

    it('gives a seat back once its booking is cancelled', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1]], { cancelledOn: new Date() });
      yield existingBooking([[NEW_730_TO_930, seat2]]);
      yield existingBooking([[NEW_730_TO_930, seat3]]);

      const seat = yield Seat.findAvailableSeat(NEW_730_TO_930.start, NEW_730_TO_930.end);

      expect(seat._id.toString()).to.equal(seat1._id.toString());
    });
  });

  describe('Seat.countAvailableSeats', () => {
    it('counts every seat when nothing is booked', function*() {
      expect(yield Seat.countAvailableSeats(NEW_730_TO_930.start, NEW_730_TO_930.end)).to.equal(3);
    });

    it('takes one off both new blocks for an old 8-10 booking, and none off the third', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1]]);

      expect(yield Seat.countAvailableSeats(NEW_730_TO_930.start, NEW_730_TO_930.end)).to.equal(2);
      expect(yield Seat.countAvailableSeats(NEW_930_TO_1130.start, NEW_930_TO_1130.end)).to.equal(2);
      expect(yield Seat.countAvailableSeats(NEW_1130_TO_130.start, NEW_1130_TO_130.end)).to.equal(3);
    });

    it('takes two off a block that an old four hour booking crosses in two seats', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1], [OLD_10_TO_12, seat2]]);

      expect(yield Seat.countAvailableSeats(NEW_930_TO_1130.start, NEW_930_TO_1130.end)).to.equal(1);
    });

    it('counts zero when every seat is held', function*() {
      yield existingBooking([[OLD_8_TO_10, seat1]]);
      yield existingBooking([[NEW_730_TO_930, seat2]]);
      yield existingBooking([[NEW_730_TO_930, seat3]]);

      expect(yield Seat.countAvailableSeats(NEW_730_TO_930.start, NEW_730_TO_930.end)).to.equal(0);
    });

    it('does not count inactive seats', function*() {
      yield Seat.update({ _id: seat3._id }, { $set: { inactive: true } }, { strict: false });

      expect(yield Seat.countAvailableSeats(NEW_730_TO_930.start, NEW_730_TO_930.end)).to.equal(2);
    });

    it('answers for one exact moment the way seat assignment asks', function*() {
      yield existingBooking([[NEW_930_TO_1130, seat1]]);

      const firstMoment = NEW_930_TO_1130.start;
      const momentAfter = NEW_1130_TO_130.start;

      expect(yield Seat.countAvailableSeats(firstMoment, firstMoment)).to.equal(2);
      expect(yield Seat.countAvailableSeats(momentAfter, momentAfter)).to.equal(3);
    });

    describe('with seats reserved for some classes by a blackout', () => {
      const exceptedClass = new mongoose.Types.ObjectId();
      const otherClass = new mongoose.Types.ObjectId();

      // "Two seats in this block are kept for the excepted class."
      const blackout = { seats: 2, classExceptions: [exceptedClass] };

      it('keeps the reserved seats back when no one has used them yet', function*() {
        const count = yield Seat.countAvailableSeats(NEW_930_TO_1130.start, NEW_930_TO_1130.end, blackout);

        expect(count).to.equal(1); // 3 seats, 2 still reserved
      });

      it('keeps fewer back once the excepted class has used one', function*() {
        yield existingBooking([[NEW_930_TO_1130, seat1]], { classes: [exceptedClass] });

        const count = yield Seat.countAvailableSeats(NEW_930_TO_1130.start, NEW_930_TO_1130.end, blackout);

        expect(count).to.equal(1); // 2 free, 1 still reserved
      });

      it('keeps none back once the excepted class has used them all', function*() {
        yield existingBooking([[NEW_930_TO_1130, seat1]], { classes: [exceptedClass] });
        yield existingBooking([[NEW_930_TO_1130, seat2]], { classes: [exceptedClass] });

        const count = yield Seat.countAvailableSeats(NEW_930_TO_1130.start, NEW_930_TO_1130.end, blackout);

        expect(count).to.equal(1); // 1 free, none reserved
      });

      it('never adds seats when the excepted class has more bookings than were reserved', function*() {
        yield existingBooking([[NEW_930_TO_1130, seat1]], { classes: [exceptedClass] });
        yield existingBooking([[NEW_930_TO_1130, seat2]], { classes: [exceptedClass] });
        yield existingBooking([[NEW_930_TO_1130, seat3]], { classes: [exceptedClass] });

        const count = yield Seat.countAvailableSeats(NEW_930_TO_1130.start, NEW_930_TO_1130.end, blackout);

        expect(count).to.equal(0); // nothing free, and nothing invented
      });

      it('does not treat a booking for another class as using a reserved seat', function*() {
        yield existingBooking([[NEW_930_TO_1130, seat1]], { classes: [otherClass] });

        const count = yield Seat.countAvailableSeats(NEW_930_TO_1130.start, NEW_930_TO_1130.end, blackout);

        expect(count).to.equal(0); // 2 free, both still reserved
      });

      it('counts an old-time booking of the excepted class as using a reserved seat', function*() {
        yield existingBooking([[OLD_8_TO_10, seat1]], { classes: [exceptedClass] });

        const count = yield Seat.countAvailableSeats(NEW_930_TO_1130.start, NEW_930_TO_1130.end, blackout);

        expect(count).to.equal(1); // 2 free, 1 still reserved
      });

      it('ignores a blackout that reserves no seats', function*() {
        const count = yield Seat.countAvailableSeats(NEW_930_TO_1130.start, NEW_930_TO_1130.end, { classExceptions: [exceptedClass] });

        expect(count).to.equal(3);
      });
    });
  });
});
