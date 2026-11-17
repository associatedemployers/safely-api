const chai          = require('chai'),
      expect        = chai.expect,
      Promise       = require('bluebird'),
      moment        = require('moment'),
      api           = require('../..'),
      makeUser      = require('../../lib/test-support/make-user'),
      BlackoutDate  = require('../../lib/models/blackout-date'),
      Class         = require('../../lib/models/class'),
      HubClass      = require('../../lib/models/hub-class'),
      Seat          = require('../../lib/models/seat'),
      AvailableTime = require('../../lib/models/available-time');

[ require('chai-http') ].map(plugin => chai.use(plugin));

chai.request.addPromises(Promise);

describe('Acceptance :: Routes :: availability', () => {
  let testKey, regularClass1, regularClass2, hubClass1, hubClass2;

  before(function*() {
    api();
    testKey = (yield makeUser())._id.toString();
  });

  beforeEach(function*() {
    // Create test classes
    regularClass1 = yield (new Class({
      name: 'CPR Certification',
      description: 'CPR training class',
      hours: 2
    })).save();

    regularClass2 = yield (new Class({
      name: 'First Aid Certification',
      description: 'First aid training class',
      hours: 2
    })).save();

    // Hub classes
    hubClass1 = yield (new HubClass({
      organization: 'Test Organization',
      code: 'HUB-TEST-1',
      seats: 10,
      times: []
    })).save();

    hubClass2 = yield (new HubClass({
      organization: 'Test Organization',
      code: 'HUB-TEST-2',
      seats: 10,
      times: []
    })).save();
  });

  afterEach(function*() {
    yield require('mongoose').connection.dropDatabase();
  });

  describe('GET /api/v1/availability', () => {
    describe('with no filters', () => {
      it('should work', function*() {
        let dec = moment().year(2016).month(11);

        yield (new AvailableTime({
          blocks: [[8,10],[10,12],[12,14],[14,16]],
          days: [1, 2, 3, 4, 5]
        })).save();

        yield (new Seat({
          number: 1
        })).save();

        yield (new AvailableTime({
          blocks: [[16,18]],
          days: [1, 2, 3, 4, 5],
          start: moment(dec).date(26).startOf('day').toDate()
        })).save();

        yield (new BlackoutDate({
          start: moment(dec).date(30).startOf('day').toDate(),
          end: moment(dec).date(30).endOf('day').toDate()
        })).save();

        let res = yield chai.request(api().listen())
          .get('/api/v1/availability')
          .set('X-Test-User', testKey)
          .query({
            month: 12,
            year: 2016,
            showBackdate: true
          });

        expect(res).to.have.status(200);
        expect(res.body.availability).to.have.lengthOf(5);

        let s = { seats: 1 };

        res.body.availability.forEach((a, wi) => {
          expect(a).to.have.lengthOf(7);

          a.forEach((d, i) => {
            if ( i === 0 || i === 6 ) {
              expect(d).to.have.lengthOf(0);
            } else {
              let lw = wi === 4,
                  compare = lw ? [[8,10,s], [10,12,s], [12,14,s], [14,16,s], [16, 18,s]] : [[8,10,s], [10,12,s], [12,14,s], [14,16,s]];

              if ( lw && i === 5 ) {
                expect(d).to.have.lengthOf(0);
                return;
              }

              expect(d).to.have.lengthOf(lw ? 5 : 4);
              expect(d).to.deep.equal(compare);
            }
          });
        });
      });
    });

    describe('with blackout dates and class exceptions/explicit', () => {
      it('should handle blackouts with class exceptions for one time block', function*() {
        let dec = moment().year(2018).month(11);

        yield (new AvailableTime({
          blocks: [[8,10],[10,12],[12,14],[14,16]],
          days: [1, 2, 3, 4, 5],
          start: moment(dec).date(26).startOf('day').toDate(),
          end: moment(dec).date(26).endOf('day').toDate()
        })).save();

        yield (new Seat({
          number: 1
        })).save();

        // classExceptions means "blackout everything EXCEPT these classes"
        // So regularClass1 is allowed, all others are blocked
        yield (new BlackoutDate({
          start: moment(dec).date(26).startOf('day').toDate(),
          end: moment(dec).date(26).endOf('day').toDate(),
          classExceptions: [regularClass1._id],
          blocks: [[10,12]]
        })).save();

        let res = yield chai.request(api().listen())
          .get('/api/v1/availability')
          .set('X-Test-User', testKey)
          .query({
            month: 12,
            day: 26,
            year: 2018,
            showBackdate: true
          });

        expect(res).to.have.status(200);
      
        // Find week containing Dec 26
        let week = res.body.availability[4];
        let wednesday = week[3]; // Wednesday Dec 26

        // Should have blocks available but with onlyClasses restriction
        expect(wednesday).to.have.length.greaterThan(0);
      
        let tenToTwelve = wednesday.find(block => block[0] === 10 && block[1] === 12);
        expect(tenToTwelve).to.exist;
        expect(tenToTwelve[2]).to.have.property('onlyClasses');
        expect(tenToTwelve[2].onlyClasses[0]._id).to.equal(regularClass1._id.toString());
        expect(tenToTwelve[2].onlyClasses).to.be.an('array');

        let eightToTen = wednesday.find(block => block[0] === 8 && block[1] === 10);
        expect(eightToTen).to.exist;
        expect(eightToTen[2]).to.have.property('seats');
        expect(eightToTen[2]).not.to.have.property('onlyClasses');
        expect(eightToTen[2].seats).to.equal(1);
      });

      it('should not block out classes outside a blackout class exception', function*() {
        /**
         * Asserts that classes outside the range of a blackout configuration for the same day are not blocked. 
         * Trello Issue QXy0m8BR <-- paste in dashboard search
         */
        let year = 2020;
        let dec = moment().year(year).month(11);
        let thursday = 24;

        yield (new AvailableTime({
          blocks: [[0,2],[2,4],[4,6],[6,8],[8,10],[10,12],[12,14],[14,16],[16,18], [18,20]],
          days: [1, 2, 3, 4, 5],
          start: moment(dec).date(thursday).startOf('day').toDate(),
          end: moment(dec).date(thursday).endOf('day').toDate()
        })).save();

        yield (new Seat({
          number: 1
        })).save();

        const blocks = [
          [ 18, 20 ], 
          [ 20, 22 ], 
          [ 22, 0 ], 
          [ 0, 2 ], 
          [ 2, 4 ], 
          [ 4, 6 ], 
          [ 6, 8 ], 
          [ 8, 10 ], 
          [ 10, 12 ], 
          [ 12, 14 ]
        ];

        // classExceptions means "blackout everything EXCEPT these classes"
        // So regularClass1 is allowed, all others are blocked
        yield (new BlackoutDate({
          start: moment(dec).date(thursday).startOf('day').toDate(),
          end: moment(dec).date(thursday).endOf('day').toDate(),
          classExceptions: [regularClass1._id],
          blocks
        })).save();

        let res = yield chai.request(api().listen())
          .get('/api/v1/availability')
          .set('X-Test-User', testKey)
          .query({
            month: 12,
            day:  thursday,
            year,
            showBackdate: true
          });

        expect(res).to.have.status(200);

        let week = res.body.availability[3];
        let th = week[4]; // Thursday Dec 24

        expect(th).to.have.lengthOf(10);

        let zeroToTwo        = th.find(block => block[0] === 0  && block[1] === 2);
        let twoToFour        = th.find(block => block[0] === 2  && block[1] === 4);
        let fourToSix        = th.find(block => block[0] === 4  && block[1] === 6);
        let sixToEight       = th.find(block => block[0] === 6  && block[1] === 8);
        let eightToTen       = th.find(block => block[0] === 8  && block[1] === 10);
        let tenToTwelve      = th.find(block => block[0] === 10 && block[1] === 12);
        let twelveToFourteen = th.find(block => block[0] === 12 && block[1] === 14);
        let fourteenToSixteen = th.find(block => block[0] === 14 && block[1] === 16);
        let sixteenToEighteen = th.find(block => block[0] === 16 && block[1] === 18);
        let eighteenToTwenty = th.find(block => block[0] === 18 && block[1] === 20);

        // 0-2, 2-4, 4-6, 6-8 are outside the blackout range; should NOT be restricted
        expect(zeroToTwo).to.exist;
        expect(zeroToTwo[2]).to.not.have.property('onlyClasses');
        expect(zeroToTwo[2]).to.have.property('seats', 1);

        expect(twoToFour).to.exist;
        expect(twoToFour[2]).to.not.have.property('onlyClasses');
        expect(twoToFour[2]).to.have.property('seats', 1);

        expect(fourToSix).to.exist;
        expect(fourToSix[2]).to.not.have.property('onlyClasses');
        expect(fourToSix[2]).to.have.property('seats', 1);

        expect(sixToEight).to.exist;
        expect(sixToEight[2]).to.not.have.property('onlyClasses');
        expect(sixToEight[2]).to.have.property('seats', 1);

        expect(eightToTen).to.exist;
        expect(eightToTen[2]).to.have.property('seats', 1);
        expect(eightToTen[2]).not.to.have.property('onlyClasses');

        expect(tenToTwelve).to.exist;
        expect(tenToTwelve[2]).to.have.property('seats', 1);
        expect(tenToTwelve[2]).not.to.have.property('onlyClasses');

        // 12-14 touches the gap boundary at 14:00; should not be restricted
        expect(twelveToFourteen).to.exist;
        expect(twelveToFourteen[2]).to.have.property('seats', 1);
        expect(twelveToFourteen[2]).not.to.have.property('onlyClasses');

        // 14-16 starts at gap boundary (14:00); should be restricted
        expect(fourteenToSixteen).to.exist;
        expect(fourteenToSixteen[2]).to.have.property('onlyClasses');
        expect(fourteenToSixteen[2].onlyClasses).to.be.an('array');
        expect(fourteenToSixteen[2].onlyClasses[0]._id).to.equal(regularClass1._id.toString());

        // 16-18 ends at gap boundary (16:00); should be restricted
        expect(sixteenToEighteen).to.exist;
        expect(sixteenToEighteen[2]).to.have.property('onlyClasses');
        expect(sixteenToEighteen[2].onlyClasses).to.be.an('array');
        expect(sixteenToEighteen[2].onlyClasses[0]._id).to.equal(regularClass1._id.toString());

        // 18-20 touches the gap boundary at 18:00; should not be restricted
        expect(eighteenToTwenty).to.exist;
        expect(eighteenToTwenty[2]).to.have.property('seats', 1);
        expect(eighteenToTwenty[2]).not.to.have.property('onlyClasses');
      });

      it('should handle blackouts with hub class exceptions', function*() {
        let dec = moment().year(2019).month(11);

        yield (new AvailableTime({
          blocks: [[8,10],[10,12],[12,14],[14,16]],
          days: [1, 2, 3, 4, 5],
          start: moment(dec).date(26).startOf('day').toDate(),
          end: moment(dec).date(26).endOf('day').toDate()
        })).save();

        yield (new Seat({
          number: 1
        })).save();

        // classExceptions means "blackout everything EXCEPT these classes"
        // So regularClass1 is allowed, all others are blocked
        yield (new BlackoutDate({
          start: moment(dec).date(26).startOf('day').toDate(),
          end: moment(dec).date(26).endOf('day').toDate(),
          hubClassExceptions: [hubClass1._id],
          blocks: [[10,12]]
        })).save();

        let res = yield chai.request(api().listen())
          .get('/api/v1/availability')
          .set('X-Test-User', testKey)
          .query({
            month: 12,
            day: 26,
            year: 2019,
            showBackdate: true
          });

        expect(res).to.have.status(200);
      
        let week = res.body.availability[3];
        let thursday = week[4]; // Thursday Dec 26

        // Should have blocks with onlyClasses (empty array since no regular classes allowed)
        expect(thursday).to.have.length.greaterThan(0);
      
        let tenToTwelve = thursday.find(block => block[0] === 10 && block[1] === 12);
        expect(tenToTwelve).to.exist;
        expect(tenToTwelve[2]).to.have.property('onlyClasses');
        expect(tenToTwelve[2].onlyClasses[0]).to.equal(hubClass1._id.toString());
      });

      it('should handle blackouts with class explicit', function*() {
        let dec = moment().year(2016).month(11);

        yield (new AvailableTime({
          blocks: [[8,10],[10,12],[12,14],[14,16]],
          days: [1, 2, 3, 4, 5],
          start: moment(dec).date(26).startOf('day').toDate(),
          end: moment(dec).date(26).endOf('day').toDate()
        })).save();

        yield (new Seat({
          number: 1
        })).save();

        // classExplicit means "blackout ONLY these specific classes"
        // So regularClass1 is blocked, others are allowed
        yield (new BlackoutDate({
          start: moment(dec).date(26).startOf('day').toDate(),
          end: moment(dec).date(26).endOf('day').toDate(),
          classExplicit: [regularClass1._id],
          blocks: [[8, 10], [10, 12], [12, 14], [14, 16]]
        })).save();

        let res = yield chai.request(api().listen())
          .get('/api/v1/availability')
          .set('X-Test-User', testKey)
          .query({
            month: 12,
            day: 26,
            year: 2016,
            showBackdate: true
          });

        expect(res).to.have.status(200);
      
        let week = res.body.availability[4];
        let monday = week[1]; // Monday Dec 26

        expect(monday).to.have.length.greaterThan(0);
      
        let tenToTwelve = monday.find(block => block[0] === 10 && block[1] === 12);
        expect(tenToTwelve).to.exist;
        expect(tenToTwelve[2]).to.have.property('blockOutExplicit');
        expect(tenToTwelve[2].blockOutExplicit[0]).to.equal(regularClass1._id.toString());
        expect(tenToTwelve[2].blockOutExplicit).to.be.an('array');
        expect(tenToTwelve[2].blockOutExplicit.length).to.be.greaterThan(0);
      });

      it('should handle blackouts with hub class explicit', function*() {
        let dec = moment().year(2017).month(11); // Use 2017 instead of 2016

        yield (new Seat({
          number: 1
        })).save();

        yield (new AvailableTime({
          blocks: [[8,10],[10,12],[12,14],[14,16]],
          days: [1, 2, 3, 4, 5],
          start: moment(dec).date(15).startOf('day').toDate(),
          end: moment(dec).date(15).endOf('day').toDate()
        })).save();

        // hubClassExplicit means "blackout ONLY these hub classes"
        // Regular classes should NOT be affected
        yield (new BlackoutDate({
          start: moment(dec).date(15).startOf('day').toDate(),
          end: moment(dec).date(15).endOf('day').toDate(),
          hubClassExplicit: [hubClass1._id],
          blocks: [[10, 12]]
        })).save();

        // Add a small delay to ensure cache expires (20 second maxAge)
        yield new Promise(resolve => setTimeout(resolve, 25));

        let res = yield chai.request(api().listen())
          .get('/api/v1/availability')
          .set('X-Test-User', testKey)
          .query({
            month: 12,
            year: 2017, // Match the year above
            showBackdate: true
          });

        expect(res).to.have.status(200);

        let week = res.body.availability[2];
        let friday = week[5]; // Friday Dec 15

        // Regular classes should still have full availability
        expect(friday).to.have.length.greaterThan(0);
      
        let tenToTwelve = friday.find(block => block[0] === 10 && block[1] === 12);
        expect(tenToTwelve).to.exist;

        // Should NOT have blockOutExplicit or onlyClasses for regular classes
        expect(tenToTwelve[2]).to.have.property('blockOutExplicit');
        expect(tenToTwelve[2].blockOutExplicit[0]).to.equal(hubClass1._id.toString());
        expect(tenToTwelve[2]).to.not.have.property('onlyClasses');
        expect(tenToTwelve[2].seats).to.equal(1);

        let eightToTen = friday.find(block => block[0] === 8 && block[1] === 10);
        expect(eightToTen).to.exist;
        expect(eightToTen[2]).to.have.property('seats');
        expect(eightToTen[2]).to.not.have.property('blockOutExplicit');
        expect(eightToTen[2]).not.to.have.property('onlyClasses');
        expect(eightToTen[2].seats).to.equal(1);
      });

      it('should handle blackouts with multiple classes', function*() {
        let dec = moment().year(2014).month(11); // Use 2014

        yield (new Seat({
          number: 1
        })).save();

        yield (new AvailableTime({
          blocks: [[8,10],[10,12],[12,14],[14,16]],
          days: [1, 2, 3, 4, 5],
          start: moment(dec).date(26).startOf('day').toDate(),
          end: moment(dec).date(26).endOf('day').toDate()
        })).save();

        // hubClassExplicit means "blackout ONLY these hub classes"
        // Regular classes should NOT be affected
        yield (new BlackoutDate({
          start: moment(dec).date(26).startOf('day').toDate(),
          end: moment(dec).date(26).endOf('day').toDate(),
          hubClassExplicit: [hubClass1._id, hubClass2._id],
          classExplicit: [regularClass1._id, regularClass2._id],
          blocks: [[10, 12]]
        })).save();

        // Add a small delay to ensure cache expires (20 second maxAge)
        yield new Promise(resolve => setTimeout(resolve, 25));

        let res = yield chai.request(api().listen())
          .get('/api/v1/availability')
          .set('X-Test-User', testKey)
          .query({
            month:        12,
            day:          26,
            year:         2014, // Match the year above
            showBackdate: true
          });

        expect(res).to.have.status(200);

        let week = res.body.availability[3];
        let friday = week[5]; // Friday Dec 26

        // Regular classes should still have full availability
        expect(friday).to.have.length.greaterThan(0);
      
        let tenToTwelve = friday.find(block => block[0] === 10 && block[1] === 12);
        expect(tenToTwelve).to.exist;

        // Should NOT have blockOutExplicit or onlyClasses for regular classes
        expect(tenToTwelve[2]).to.have.property('blockOutExplicit');
        expect(tenToTwelve[2].blockOutExplicit).to.include(hubClass1._id.toString());
        expect(tenToTwelve[2].blockOutExplicit).to.include(hubClass2._id.toString());
        expect(tenToTwelve[2].blockOutExplicit).to.include(regularClass1._id.toString());
        expect(tenToTwelve[2].blockOutExplicit).to.include(regularClass2._id.toString());

        expect(tenToTwelve[2]).to.not.have.property('onlyClasses');
        expect(tenToTwelve[2].seats).to.equal(1);

        let eightToTen = friday.find(block => block[0] === 8 && block[1] === 10);
        expect(eightToTen).to.exist;
        expect(eightToTen[2]).to.have.property('seats');
        expect(eightToTen[2]).to.not.have.property('blockOutExplicit');
        expect(eightToTen[2]).not.to.have.property('onlyClasses');
        expect(eightToTen[2].seats).to.equal(1);
      });

      it('should not block time slots outside the blackout hour blocks (issue #168)', function*() {
        // Reproduce: blackout covers 4am-6am; F2F at 8am should remain visible
        let dec = moment().year(2021).month(11); // December 2021

        yield (new AvailableTime({
          blocks: [[4,6],[8,10],[10,12]],
          days: [1, 2, 3, 4, 5],
          start: moment(dec).date(7).startOf('day').toDate(),
          end:   moment(dec).date(7).endOf('day').toDate()
        })).save();

        yield (new Seat({ number: 1 })).save();

        // Total blackout (no class filters) but only for 4am-6am
        yield (new BlackoutDate({
          start:  moment(dec).date(7).startOf('day').toDate(),
          end:    moment(dec).date(7).endOf('day').toDate(),
          blocks: [[4, 6]]
        })).save();

        yield new Promise(resolve => setTimeout(resolve, 25));

        let res = yield chai.request(api().listen())
          .get('/api/v1/availability')
          .set('X-Test-User', testKey)
          .query({ month: 12, year: 2021, showBackdate: true });

        expect(res).to.have.status(200);

        // Dec 7 2021 is a Tuesday → week index 1, day index 2
        let tuesday = res.body.availability[1][2];

        // 4-6 block should be blocked (not present)
        let fourToSix = tuesday.find(b => b[0] === 4 && b[1] === 6);
        expect(fourToSix, '4-6 block should be blacked out').to.not.exist;

        // 8-10 block must still be available — this is the bug
        let eightToTen = tuesday.find(b => b[0] === 8 && b[1] === 10);
        expect(eightToTen, '8-10 block should not be blacked out').to.exist;
        expect(eightToTen[2]).to.have.property('seats', 1);
        expect(eightToTen[2]).to.not.have.property('onlyClasses');

        // 10-12 block must also still be available
        let tenToTwelve = tuesday.find(b => b[0] === 10 && b[1] === 12);
        expect(tenToTwelve, '10-12 block should not be blacked out').to.exist;
        expect(tenToTwelve[2]).to.have.property('seats', 1);
      });

      it('should handle blackouts with NO classes or hub classes (meaning all classes are blackout)', function*() {
        let dec = moment().year(2015).month(11);

        yield (new AvailableTime({
          blocks: [[8,10],[10,12],[12,14],[14,16]],
          days: [1, 2, 3, 4, 5],
          start: moment(dec).date(15).startOf('day').toDate(),
          end: moment(dec).date(15).endOf('day').toDate()
        })).save();

        yield (new Seat({
          number: 1
        })).save();

        // No class filters = total blackout for all classes
        yield (new BlackoutDate({
          start: moment(dec).date(15).startOf('day').toDate(),
          end: moment(dec).date(15).endOf('day').toDate()
        })).save();

        // Add a small delay to ensure cache expires (20 second maxAge)
        yield new Promise(resolve => setTimeout(resolve, 25));

        let res = yield chai.request(api().listen())
          .get('/api/v1/availability')
          .set('X-Test-User', testKey)
          .query({
            month: 12,
            year: 2015,
            showBackdate: true
          });

        expect(res).to.have.status(200);
      
        let week = res.body.availability[2];
        let thursday = week[3]; // Thursday Dec 15

        // Should have NO blocks available (completely blacked out)
        expect(thursday).to.have.lengthOf(0);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // The new lab day: two-hour blocks that start on the half hour.
  //   7:30-9:30, 9:30-11:30, 11:30-1:30, Monday to Thursday.
  //
  // The endpoint caches a month for 20 seconds, so every test asks for a
  // different month.
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/availability on the half-hour lab day', () => {
    const Registration = require('../../lib/models/registration');

    const NEW_LAB_DAY = [[7.5, 9.5], [9.5, 11.5], [11.5, 13.5]];
    const MONDAY_TO_THURSDAY = [1, 2, 3, 4];

    const day = text => moment(text, 'YYYY-MM-DD');

    // Saves an Available Time record straight into the collection, so that
    // `end: null` is stored the way the site saves an empty end date.
    function* openTheLab (fields) {
      yield AvailableTime.collection.insertOne(Object.assign({
        blocks: NEW_LAB_DAY,
        days: MONDAY_TO_THURSDAY
      }, fields));
    }

    function* getMonth (month, year) {
      const res = yield chai.request(api().listen())
        .get('/api/v1/availability')
        .set('X-Test-User', testKey)
        .query({ month, year, showBackdate: true });

      expect(res).to.have.status(200);

      return res.body.availability;
    }

    // Picks one day's blocks out of the month the endpoint returned.
    // The month is a list of weeks, and each week is a list of seven days.
    function blocksOn (availability, date) {
      const firstWeekStart = moment(date).startOf('month').startOf('week'),
            weekIndex = moment(date).startOf('week').diff(firstWeekStart, 'weeks');

      return availability[weekIndex][moment(date).day()];
    }

    const startsOf = blocks => blocks.map(block => block[0]);
    const seatsAt = (blocks, startHour) => blocks.find(block => block[0] === startHour)[2].seats;

    beforeEach(function*() {
      yield (new Seat({ number: 1 })).save();
      yield (new Seat({ number: 2 })).save();
    });

    it('shows the three blocks for a record with a start date and no end date', function*() {
      yield openTheLab({ start: day('2027-02-01').startOf('day').toDate(), end: null });

      const availability = yield getMonth(2, 2027);
      const tuesday = blocksOn(availability, day('2027-02-02'));

      expect(tuesday).to.deep.equal([
        [7.5, 9.5, { seats: 2 }],
        [9.5, 11.5, { seats: 2 }],
        [11.5, 13.5, { seats: 2 }]
      ]);
    });

    it('shows the blocks Monday to Thursday and nothing Friday to Sunday', function*() {
      yield openTheLab({ start: day('2027-03-01').startOf('day').toDate(), end: null });

      const availability = yield getMonth(3, 2027);

      // The week of Sunday 7 March 2027.
      expect(blocksOn(availability, day('2027-03-07'))).to.have.lengthOf(0, 'Sunday');
      expect(startsOf(blocksOn(availability, day('2027-03-08')))).to.deep.equal([7.5, 9.5, 11.5], 'Monday');
      expect(startsOf(blocksOn(availability, day('2027-03-09')))).to.deep.equal([7.5, 9.5, 11.5], 'Tuesday');
      expect(startsOf(blocksOn(availability, day('2027-03-10')))).to.deep.equal([7.5, 9.5, 11.5], 'Wednesday');
      expect(startsOf(blocksOn(availability, day('2027-03-11')))).to.deep.equal([7.5, 9.5, 11.5], 'Thursday');
      expect(blocksOn(availability, day('2027-03-12'))).to.have.lengthOf(0, 'Friday');
      expect(blocksOn(availability, day('2027-03-13'))).to.have.lengthOf(0, 'Saturday');
    });

    it('shows nothing before the record starts and blocks from its first day', function*() {
      yield openTheLab({ start: day('2027-04-14').startOf('day').toDate(), end: null });

      const availability = yield getMonth(4, 2027);

      expect(blocksOn(availability, day('2027-04-13'))).to.have.lengthOf(0, 'the Tuesday before');
      expect(startsOf(blocksOn(availability, day('2027-04-14')))).to.deep.equal([7.5, 9.5, 11.5], 'the first day');
    });

    it('shows blocks up to the record\'s last day and nothing after', function*() {
      yield openTheLab({ end: day('2027-05-12').endOf('day').toDate() });

      const availability = yield getMonth(5, 2027);

      expect(startsOf(blocksOn(availability, day('2027-05-12')))).to.deep.equal([7.5, 9.5, 11.5], 'the last day');
      expect(blocksOn(availability, day('2027-05-13'))).to.have.lengthOf(0, 'the Thursday after');
    });

    it('switches from the old day to the new day on the start date', function*() {
      yield (new AvailableTime({
        blocks: [[8, 10], [10, 12], [12, 14], [14, 16]],
        days: [1, 2, 3, 4, 5],
        end: day('2027-06-15').endOf('day').toDate()
      })).save();
      yield openTheLab({ start: day('2027-06-16').startOf('day').toDate(), end: null });

      const availability = yield getMonth(6, 2027);

      expect(startsOf(blocksOn(availability, day('2027-06-15')))).to.deep.equal([8, 10, 12, 14], 'last old day');
      expect(startsOf(blocksOn(availability, day('2027-06-16')))).to.deep.equal([7.5, 9.5, 11.5], 'first new day');
      expect(blocksOn(availability, day('2027-06-18'))).to.have.lengthOf(0, 'the Friday after is closed');
    });

    it('lists a block once and in time order when two records overlap', function*() {
      yield openTheLab({ blocks: [[11.5, 13.5], [7.5, 9.5]] });
      yield openTheLab({ blocks: [[9.5, 11.5], [7.5, 9.5]] });

      const availability = yield getMonth(7, 2027);

      expect(startsOf(blocksOn(availability, day('2027-07-06')))).to.deep.equal([7.5, 9.5, 11.5]);
    });

    it('takes a seat away only from the block that was booked', function*() {
      yield openTheLab({ end: null });

      const tuesday = day('2027-08-03');

      yield (new Registration({
        start: moment(tuesday).hour(9).minute(30).toDate(),
        classes: [regularClass1._id]
      })).save();

      const blocks = blocksOn(yield getMonth(8, 2027), tuesday);

      expect(seatsAt(blocks, 7.5)).to.equal(2, '7:30 is untouched');
      expect(seatsAt(blocks, 9.5)).to.equal(1, '9:30 lost one seat');
      expect(seatsAt(blocks, 11.5)).to.equal(2, '11:30 is untouched');
    });

    it('takes a seat from both blocks of a three hour class', function*() {
      yield openTheLab({ end: null });

      const threeHourClass = yield (new Class({ name: 'Three Hour Class', hours: 3 })).save();
      const tuesday = day('2027-09-07');

      yield (new Registration({
        start: moment(tuesday).hour(7).minute(30).toDate(),
        classes: [threeHourClass._id]
      })).save();

      const blocks = blocksOn(yield getMonth(9, 2027), tuesday);

      expect(seatsAt(blocks, 7.5)).to.equal(1);
      expect(seatsAt(blocks, 9.5)).to.equal(1);
      expect(seatsAt(blocks, 11.5)).to.equal(2);
    });

    it('shows a full block with no seats and leaves the others open', function*() {
      yield openTheLab({ end: null });

      const tuesday = day('2027-10-05');
      const at930 = moment(tuesday).hour(9).minute(30).toDate();

      yield (new Registration({ start: at930, classes: [regularClass1._id] })).save();
      yield (new Registration({ start: at930, classes: [regularClass1._id] })).save();

      const blocks = blocksOn(yield getMonth(10, 2027), tuesday);

      expect(seatsAt(blocks, 9.5)).to.equal(0);
      expect(seatsAt(blocks, 7.5)).to.equal(2);
    });

    it('hides only the blacked-out block when a blackout for everyone lists 9:30-11:30', function*() {
      yield openTheLab({ end: null });

      const tuesday = day('2027-11-02');

      yield (new BlackoutDate({
        start: moment(tuesday).startOf('day').toDate(),
        end: moment(tuesday).endOf('day').toDate(),
        blocks: [[9.5, 11.5]]
      })).save();

      const availability = yield getMonth(11, 2027);

      expect(startsOf(blocksOn(availability, tuesday))).to.deep.equal([7.5, 11.5], 'the blacked-out Tuesday');
      expect(startsOf(blocksOn(availability, day('2027-11-03')))).to.deep.equal([7.5, 9.5, 11.5], 'the day after');
    });

    it('hides the whole day when a blackout for everyone lists no blocks', function*() {
      yield openTheLab({ end: null });

      const tuesday = day('2027-12-07');

      yield (new BlackoutDate({
        start: moment(tuesday).startOf('day').toDate(),
        end: moment(tuesday).endOf('day').toDate()
      })).save();

      expect(blocksOn(yield getMonth(12, 2027), tuesday)).to.have.lengthOf(0);
    });

    it('marks only the 9:30 block when a blackout names a class for 9:30-11:30', function*() {
      yield openTheLab({ end: null });

      const tuesday = day('2028-01-04');

      yield (new BlackoutDate({
        start: moment(tuesday).startOf('day').toDate(),
        end: moment(tuesday).endOf('day').toDate(),
        classExplicit: [regularClass1._id],
        blocks: [[9.5, 11.5]]
      })).save();

      const blocks = blocksOn(yield getMonth(1, 2028), tuesday);
      const infoAt = startHour => blocks.find(block => block[0] === startHour)[2];

      expect(startsOf(blocks)).to.deep.equal([7.5, 9.5, 11.5], 'every block is still listed');
      expect(infoAt(9.5).blockOutExplicit).to.deep.equal([regularClass1._id.toString()]);
      expect(infoAt(7.5)).to.not.have.property('blockOutExplicit');
      expect(infoAt(11.5)).to.not.have.property('blockOutExplicit');
    });

    it('shows every day closed when there are no Available Time records', function*() {
      const availability = yield getMonth(2, 2028);

      availability.forEach(week => week.forEach(blocks => expect(blocks).to.have.lengthOf(0)));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // The switch: a booking made on the old times (8-10) is still on the calendar
  // when the lab moves to the half-hour blocks.
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/availability with an old-time booking on a half-hour day', () => {
    const Registration = require('../../lib/models/registration');

    function* getDay (month, year, date) {
      const res = yield chai.request(api().listen())
        .get('/api/v1/availability')
        .set('X-Test-User', testKey)
        .query({ month, year, showBackdate: true });

      expect(res).to.have.status(200);

      const firstWeekStart = moment(date).startOf('month').startOf('week'),
            weekIndex = moment(date).startOf('week').diff(firstWeekStart, 'weeks');

      return res.body.availability[weekIndex][moment(date).day()];
    }

    const seatsAt = (blocks, startHour) => blocks.find(block => block[0] === startHour)[2].seats;

    // Makes an 8:00-10:00 booking on the old day, then switches to the new day.
    function* bookOldTimeThenSwitch (tuesday, seatCount) {
      for (let number = 1; number <= seatCount; number++) {
        yield (new Seat({ number })).save();
      }

      yield (new AvailableTime({ blocks: [[8, 10], [10, 12], [12, 14], [14, 16]], days: [1, 2, 3, 4, 5] })).save();

      const oldBooking = new Registration({
        start: moment(tuesday).hour(8).toDate(),
        classes: [regularClass1._id]
      });

      yield oldBooking.save();

      yield AvailableTime.remove({});
      yield AvailableTime.collection.insertOne({
        blocks: [[7.5, 9.5], [9.5, 11.5], [11.5, 13.5]],
        days: [1, 2, 3, 4],
        end: null
      });

      return oldBooking;
    }

    it('shows 6, 6 and 7 seats in a 7 seat lab', function*() {
      const tuesday = moment('2028-03-07', 'YYYY-MM-DD');

      yield bookOldTimeThenSwitch(tuesday, 7);

      const blocks = yield getDay(3, 2028, tuesday);

      expect(seatsAt(blocks, 7.5)).to.equal(6, '7:30-9:30 overlaps the 8-10 booking');
      expect(seatsAt(blocks, 9.5)).to.equal(6, '9:30-11:30 overlaps the 8-10 booking');
      expect(seatsAt(blocks, 11.5)).to.equal(7, '11:30-1:30 is after it');
    });

    it('shows a one seat lab as full in both blocks the old booking overlaps', function*() {
      const tuesday = moment('2028-04-04', 'YYYY-MM-DD');

      yield bookOldTimeThenSwitch(tuesday, 1);

      const blocks = yield getDay(4, 2028, tuesday);

      expect(seatsAt(blocks, 7.5)).to.equal(0);
      expect(seatsAt(blocks, 9.5)).to.equal(0);
      expect(seatsAt(blocks, 11.5)).to.equal(1);
    });

    it('shows every seat again once the old booking is cancelled', function*() {
      const tuesday = moment('2028-05-02', 'YYYY-MM-DD');
      const oldBooking = yield bookOldTimeThenSwitch(tuesday, 7);

      yield Registration.update({ _id: oldBooking._id }, { $set: { cancelledOn: new Date() } });

      const blocks = yield getDay(5, 2028, tuesday);

      expect(seatsAt(blocks, 7.5)).to.equal(7);
      expect(seatsAt(blocks, 9.5)).to.equal(7);
    });

    it('does not touch the days around the old booking', function*() {
      const tuesday = moment('2028-06-06', 'YYYY-MM-DD');

      yield bookOldTimeThenSwitch(tuesday, 7);

      const wednesday = yield getDay(6, 2028, moment(tuesday).add(1, 'day'));

      expect(seatsAt(wednesday, 7.5)).to.equal(7);
      expect(seatsAt(wednesday, 9.5)).to.equal(7);
    });
  });
});
