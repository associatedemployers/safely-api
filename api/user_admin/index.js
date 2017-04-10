/*
  Activation resource
 */

const User = require('../../lib/models/user');

exports.activationEmail = function*() {
  if (!this.user.administrative) {
    this.status = 401;
    this.body = 'This method is not allowed per your user type.';
    return;
  }

  let user = yield User.findOne({ _id: this.params.id });

  if (!user) {
    this.status = 404;
    this.body = 'User could not be found.';
    return;
  }

  yield user.notifyActivation();
  this.status = 200;
  this.body = {
    status: 200,
    message: 'OK'
  };
};
