const chai        = require('chai'),
      expect      = chai.expect,
      Promise     = require('bluebird'),
      api         = require('../..'),
      CompanyUser = require('../../lib/models/company-user'),
      makeUser = require('../../lib/test-support/make-user');

[ require('chai-http') ].map(plugin => chai.use(plugin));

chai.request.addPromises(Promise);

describe('Acceptance :: Resource :: CompanyUser Users', () => {
  let testKey, company;

  before(done => {
    api();

    makeUser()
    .then(user => {
      company = user.company;
      testKey = user._id.toString();
      done();
    });
  });

  after(done => require('mongoose').connection.db.dropDatabase(done));

  describe('POST /company-users', () => {
    it('should reject empty requests', done => {
      var app = api();

      chai.request(app.listen())
      .post('/api/v1/company-users')
      .set('X-Test-User', testKey)
      .then(() => {
        done(new Error('Expected error on request'));
      })
      .catch(err => {
        expect(err.message.toLowerCase()).to.contain('bad');
        done();
      });
    });

    it('should facilitate model validations', done => {
      var app = api();

      chai.request(app.listen())
      .post('/api/v1/company-users')
      .set('X-Test-User', testKey)
      .send({
        companyUser: {
          name: {
            first: 'Test CompanyUser'
          }
        }
      })
      .then(() => {
        done('Expected error on request');
      })
      .catch(err => {
        expect(err.response.error.text.toLowerCase()).to.contain('email');
        done();
      });
    });

    it('should POST new records', done => {
      var app = api();

      chai.request(app.listen())
      .post('/api/v1/company-users')
      .set('X-Test-User', testKey)
      .send({
        companyUser: {
          name: {
            first: 'Test',
            last: 'user'
          },
          email: 'test@aehr.org'
        }
      })
      .then(res => {
        var companyUser = res.body.companyUser;
        expect(res).to.have.status(201);
        expect(companyUser).to.have.property('_id');
        expect(companyUser.name.first).to.equal('Test');
        expect(companyUser.email).to.equal('test@aehr.org');

        return CompanyUser.findById(companyUser._id);
      })
      .then(companyUser => {
        expect(companyUser).to.exist;
        done();
      })
      .catch(done);
    });
  });

  describe('GET /company-users/:id', () => {
    it('should return not found', done => {
      let app = api();

      chai.request(app.listen())
      .get('/api/v1/company-users/' + require('mongoose').Types.ObjectId())
      .set('X-Test-User', testKey)
      .then(() => {
        done(new Error('Expected route to fail with 404'));
      })
      .catch(err => {
        expect(err.response.status).to.equal(404);
        done();
      });
    });

    it('should get a record', done => {
      let companyUser = new CompanyUser({
        company,
        name: {
          first: 'Test',
          last: 'User'
        },
        email: 'test@aehr.org'
      });

      companyUser.save()
      .then(record => {
        let app = api();

        return chai.request(app.listen())
        .get('/api/v1/company-users/' + record._id)
        .set('X-Test-User', testKey);
      })
      .then(res => {
        expect(res).to.have.status(200);
        expect(res.body.companyUser).to.exist;
        expect(res.body.companyUser.name.first).to.equal('Test');
        done();
      })
      .catch(done);
    });
  });

  describe('PUT /company-users/:id', () => {
    it('should edit a record', done => {
      let companyUserRecord = new CompanyUser({
        company,
        name: {
          first: 'Test',
          last: 'User'
        },
        email: 'test2@aehr.org'
      });

      companyUserRecord.save()
      .then(record => {
        let app = api(),
            modifiedRecord = record.toObject();

        modifiedRecord.name.first = 'Changed Name';

        return chai.request(app.listen())
        .put('/api/v1/company-users/' + record._id)
        .set('X-Test-User', testKey)
        .send({
          companyUser: modifiedRecord
        });
      })
      .then(res => {
        expect(res).to.have.status(200);
        let companyUser = res.body.companyUser;
        expect(companyUser).to.exist;
        expect(companyUser.name.first).to.equal('Changed Name');
        expect(companyUser.email).to.equal('test2@aehr.org');
        return CompanyUser.findById(companyUser._id);
      })
      .then(companyUser => {
        expect(companyUser.name.first).to.equal('Changed Name');
        expect(companyUser.email).to.equal('test2@aehr.org');
        done();
      })
      .catch(done);
    });
  });

  describe('DELETE /companies', () => {
    it('should delete a record', done => {
      let companyUserRecord = new CompanyUser({
        company,
        name: {
          first: 'Test3',
          last: 'User'
        },
        email: 'test3@aehr.org'
      });
      let id;

      companyUserRecord.save()
      .then(record => {
        let app = api();
        id = record._id;

        return chai.request(app.listen())
        .delete('/api/v1/company-users/' + id)
        .set('X-Test-User', testKey);
      })
      .then(res => {
        expect(res).to.have.status(204);
        return CompanyUser.findById(id);
      })
      .then(companyUser => {
        expect(companyUser).to.not.exist;
        done();
      })
      .catch(done);
    });
  });
});
