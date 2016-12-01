/*
  grant.unlock();
*/
const jwt = require('jwt-simple'),
      signature = process.env.SIGNATURE || '';

module.exports = function () {
  return jwt.decode(this.token, this.salt + signature);
};
