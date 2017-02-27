/*
  Initializer - Admin users
*/

const co = require('co'),
      winston = require('winston'),
      User = require('../models/user'),
      users = require('../../config/admin-users').admins;

exports.init = function () {
  if (!users || !users.length) {
    return;
  }

  return co(function*() {
    for (let i = 0; i < users.length; i++) {
      let userData = users[i];

      winston.debug(`Attempting to make user for: ${userData.email}`);

      if (yield User.findOne({ email: userData.email }) || !userData.email) {
        winston.debug(`User exists for: ${userData.email}`);
        continue; // skip user
      }

      yield (new User({
        name: {
          first: userData.firstName,
          last: userData.lastName
        },
        email: userData.email,
        administrative: true
      })).save();

      winston.debug(`Made user for: ${userData.email}`);
    }
  });
};
