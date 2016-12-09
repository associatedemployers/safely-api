const chai          = require('chai'),
      expect        = chai.expect,
      Promise       = require('bluebird'),
      moment        = require('moment'),
      api           = require('../..'),
      makeUser      = require('../../lib/test-support/make-user'),
      BlackoutDate  = require('../../lib/models/blackout-date'),
      Seat          = require('../../lib/models/seat'),
      AvailableTime = require('../../lib/models/available-time');

[ require('chai-http') ].map(plugin => chai.use(plugin));

chai.request.addPromises(Promise);

describe('Acceptance :: Routes :: availability', () => {
  let testKey;

  before(function*() {
    api();
    testKey = (yield makeUser())._id.toString();
  });

  afterEach(function*() {
    yield require('mongoose').connection.dropDatabase();
  });

  describe('GET /api/v1/availability', () => {
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
        year: 2016
      });

      expect(res).to.have.status(200);
      expect(res.body.availability).to.have.lengthOf(5);
      console.dir(res.body.availability, { depth: 10 });
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
});
