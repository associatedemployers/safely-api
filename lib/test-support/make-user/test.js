const chai   = require('chai'),
      expect = chai.expect,
      User   = require('../../models/company-user'),
      helper = require('.');

describe('Unit :: Test Support :: Make User', () => {
  it('should make a user', function (done) {
    this.timeout(5000);
    require('../../..')();
    let promise = helper();

    promise.then(user => {
      expect(user).to.exist;
      expect(user.toObject()).to.contain.all.keys(['_id', 'company', 'email']);
      return User.findById(user._id).populate('company').exec();
    })
    .then(user => {
      expect(user).to.exist;
      expect(user.company).to.exist;
      done();
    })
    .catch(done);
  });
});
