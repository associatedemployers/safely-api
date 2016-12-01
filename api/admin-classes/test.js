const chai     = require('chai'),
      expect   = chai.expect,
      Promise  = require('bluebird'),
      _        = require('lodash'),
      api      = require('../..'),
      makeUser = require('../../lib/test-support/make-user');

[ require('chai-http') ].map(plugin => chai.use(plugin));

chai.request.addPromises(Promise);

var app = api();

describe('Acceptance :: Route :: Employee', () => {
  let testKey;

  before(function*() {
    testKey = (yield makeUser())._id.toString();
  });

  after(done => require('mongoose').connection.db.dropDatabase(done));
});
