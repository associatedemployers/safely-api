/*
  Activation resource
 */

const User = require('../../lib/models/user'),
      winston = require('winston');

exports.getActivationStatus = function*() {
  winston.debug(`Attempting to find user for activation: ${this.params.id}`);

  let user = yield User.findOne({ _id: this.params.id });

  if (!user) {
    winston.debug(`User could not be found for activation: ${this.params.id}`);
    this.status = 404;
    this.body = 'User could not be found.';
    return;
  }

  this.status = 200;

  if (user.activatedOn) {
    winston.debug(`User is already activated: ${this.params.id}`);
    this.body = {
      activated: true
    };
    return;
  }

  winston.debug(`User is ok for activation: ${this.params.id}`);

  this.body = {
    activated: false,
    name: user.name,
    id: user._id
  };
};

exports.activate = function*() {
  let user = yield User.findOne({ _id: this.params.id });

  if (!user) {
    this.status = 404;
    this.body = 'User could not be found.';
    return;
  }

  if (!this.request.body.password) {
    this.status = 400;
    this.body = 'You must specify a password.';
    return;
  }

  user.password = this.request.body.password;
  user.activatedOn = new Date();

  yield user.save();
  this.status = 204;
};
