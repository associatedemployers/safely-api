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
        let Monday = week[1]; // Monday Dec 26

        expect(Monday).to.have.length.greaterThan(0);
      
        let tenToTwelve = Monday.find(block => block[0] === 10 && block[1] === 12);
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
});
