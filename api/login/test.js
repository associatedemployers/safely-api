const chai     = require('chai'),
      expect   = chai.expect,
      Promise  = require('bluebird'),
      mongoose = require('mongoose'),
      moment   = require('moment'),
      api      = require('../..'),
      User     = require('../../lib/models/company-user'),
      Grant    = require('../../lib/models/grant');

[ require('chai-http') ].map(plugin => chai.use(plugin));

chai.request.addPromises(Promise);

describe('Acceptance :: Route :: Authentication', () => {
  after(done => mongoose.connection.db.dropDatabase(done));

  before(done => {
    api();

    let user = new User({
      email: 'test@aehr.org',
      password: '1234',
      name: {
        first: 'Morgan',
        last: 'Freeman'
      }
    });

    user.save().then(() => done()).catch(done);
  });

  describe('GET /login/:type', () => {
    it('should respond with 400 when requesting invalid type', done => {
      var app = api();

      chai.request(app.listen())
      .post('/api/v1/login/bleh')
      .then(res => {
        done(res);
      })
      .catch(res => {
        expect(res).to.have.status(400);
        done();
      });
    });

    it('should respond with 400 without password or email', done => {
      var app = api().listen();

      chai.request(app)
      .post('/api/v1/login/company-user')
      .send({
        email: 'sometest@test.com'
      })
      .then(res => {
        done(res);
      })
      .catch(res => {
        expect(res).to.have.status(400);

        return chai.request(app)
        .post('/api/v1/login/company-user')
        .send({
          password: 'sometest'
        });
      })
      .then(res => {
        done(res);
      })
      .catch(res => {
        expect(res).to.have.status(400);
        done();
      });
    });

    it('should respond with invalid password', done => {
      var app = api().listen();

      chai.request(app)
      .post('/api/v1/login/company-user')
      .send({
        email: 'test@aehr.org',
        password: 'invalid'
      })
      .then(res => {
        done(res);
      })
      .catch(res => {
        expect(res).to.have.status(400);
        done();
      });
    });

    it('should respond with grant', done => {
      var app = api().listen();

      chai.request(app)
      .post('/api/v1/login/company-user')
      .send({
        email: 'test@aehr.org',
        password: '1234'
      })
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body).to.have.all.keys(['user', 'expires', 'token', 'id']);
        done();
      })
      .catch(done);
    });
  });

  describe('POST /grant/:id/refresh', () => {
    it('should handle 404', done => {
      var app = api();

      chai.request(app.listen())
      .post('/api/v1/grant/' + mongoose.Types.ObjectId() + '/refresh')
      .then(() => {
        done(new Error('Expected error on request'));
      })
      .catch(err => {
        expect(err.message.toLowerCase()).to.contain('not');
        done();
      });
    });

    it('should reject when grant is expired', done => {
      let grantId;
      let u = new User({
        email: 'test1@aehr.org',
        password: '1234',
        name: {
          first: 'Morgan',
          last: 'Freeman'
        }
      });

      u.save().then(user => {
        return Grant.grant(user);
      })
      .then(grant => {
        grantId = grant._id;
        grant.expires = moment().toDate();
        return grant.save();
      })
      .then(() => {
        return chai.request(api().listen())
        .post('/api/v1/grant/' + grantId + '/refresh');
      })
      .then(() => {
        done(new Error('Expected route to fail with 400'));
      })
      .catch(err => {
        expect(err.response.status).to.equal(400);
        done();
      });
    });

    it('should refresh a grant', done => {
      let u = new User({
        email: 'test2@aehr.org',
        password: '1234',
        name: {
          first: 'Morgan',
          last: 'Freeman'
        }
      });

      u.save().then(user => {
        return Grant.grant(user);
      })
      .then(grant => {
        return chai.request(api().listen())
        .post('/api/v1/grant/' + grant._id + '/refresh');
      })
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.expires).to.exist;
        done();
      })
      .catch(done);
    });
  });
});
