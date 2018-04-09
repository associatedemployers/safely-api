const chai     = require('chai'),
      expect   = chai.expect,
      Promise  = require('bluebird'),
      _        = require('lodash'),
      api      = require('../..'),
      makeUser = require('../../lib/test-support/make-user'),
      Trainee  = require('../../lib/models/trainee');

[ require('chai-http') ].map(plugin => chai.use(plugin));

chai.request.addPromises(Promise);

describe('Acceptance :: Route :: Trainee', () => {
  let testKey;

  before(function*() {
    api();
    testKey = (yield makeUser())._id.toString();
  });

  after(function*() {
    yield require('mongoose').connection.dropDatabase();
  });

  it('should work', function*() {
    let app = api().listen();

    let trainee = yield (new Trainee({
      name: {
        first: 'Bob',
        last: 'Ross'
      },
      email: 'happytree@hotmail.net',
      ssn: '123-12-1111'
    })).save();

    let res = yield chai.request(app)
      .get('/api/v1/trainees')
      .set('X-Test-User', testKey)
      .query({
        ssn: '123-12-1111'
      });

    expect(res).to.have.status(200);
    expect(res.body.trainee).to.have.lengthOf(1);
    expect(res.body.trainee[0].email).to.equal('happytree@hotmail.net');

    let resById = yield chai.request(app)
      .get(`/api/v1/trainees/${trainee._id.toString()}`)
      .set('X-Test-User', testKey);

    expect(resById.body.trainee.email).to.equal('happytree@hotmail.net');
  });

  it('should not allow duplicate writes', function*() {
    this.timeout(5000);
    let app = api().listen();

    let trainee = yield (new Trainee({
      name: {
        first: 'Bob',
        last: 'Ross'
      },
      email: 'happytree@hotmail.net',
      ssn: '123-12-1233'
    })).save();

    yield new Promise(resolve => setTimeout(resolve, 1000));

    let response, noRaceErr;

    try {
      response = yield chai.request(app)
        .post('/api/v1/trainees')
        .set('X-Test-User', testKey)
        .send({
          trainee: {
            name: { first: 'Test', last: 'Test' },
            email: 'test@test.com',
            ssn: '123-12-1233'
          }
        });
    } catch (e) {
      noRaceErr = e;
    }

    let responseDb = yield Trainee.find({ ssn: '123-12-1233' }).exec();

    expect(responseDb).to.have.lengthOf(1);
    expect(noRaceErr).to.have.status(400);

    let responses = [ 1, 2 ].map(() => chai.request(app)
      .post('/api/v1/trainees')
      .set('X-Test-User', testKey)
      .send({
        trainee: {
          name: { first: 'Test', last: 'Test' },
          email: 'test@test.com',
          ssn: '123-12-1234'
        }
      }));

    let err;

    try {
      responses = yield responses;
    } catch (e) {
      err = e;
    }

    let trainees = yield Trainee.find({ ssn: '123-12-1234' }).exec();

    expect(trainees).to.have.lengthOf(1);
    expect(err).to.have.status(400);
  });
});
