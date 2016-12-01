/*
  grant.refresh();
*/
const moment = require('moment'),
      expiration = process.env.TOKEN_EXPIRATION || 60 * 60 * 2;

module.exports = function () {
  if ( moment().isAfter(this.expires) ) {
    throw new Error('This grant cannot be refreshed.');
  }

  this.expires = moment().add(expiration, 'seconds').toDate();
  return this.save();
};
