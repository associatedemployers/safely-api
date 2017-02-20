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
      ssn: '123'
    })).save();

    let res = yield chai.request(app)
    .get('/api/v1/trainees')
    .set('X-Test-User', testKey)
    .query({
      ssn: 123
    });

    expect(res).to.have.status(200);
    expect(res.body.trainee[0].email).to.equal('happytree@hotmail.net');

    let resById = yield chai.request(app)
    .get(`/api/v1/trainees/${trainee._id.toString()}`)
    .set('X-Test-User', testKey);

    expect(resById.body.trainee.email).to.equal('happytree@hotmail.net');
  });
});
