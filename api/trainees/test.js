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

  beforeEach(function*() {
    api();
    testKey = (yield makeUser())._id.toString();
  });

  afterEach(function*() {
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
      ssn: '123-12-1234'
    })).save();

    let res = yield chai.request(app)
      .get('/api/v1/trainees')
      .set('X-Test-User', testKey)
      .query({
        ssn: '123-12-1234'
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
    yield Trainee.ensureIndexes();
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

    let response = yield chai.request(app)
      .post('/api/v1/trainees')
      .set('X-Test-User', testKey)
      .send({
        trainee: {
          name: { first: 'Test', last: 'Test' },
          email: 'test@test.com',
          ssn: '123-12-1233'
        }
      });

    let responseDb = yield Trainee.find({ ssn: '123-12-1233' }).exec();
    console.log(responseDb);
    expect(responseDb).to.have.lengthOf(1);
    expect(response).to.have.status(400);

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

    yield responses;
    console.log('got responses');


    let trainees = yield Trainee.find({ ssn: '123-12-1234' }).exec();

    expect(trainees).to.have.lengthOf(1);
    expect(responses.find(x => x.status === 400), 'Duplicate key error is returned').to.exist;
  });
});
