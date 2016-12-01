/*
  Grant.grant(userModel);
*/
const keygen = require('keygenerator'),
      jwt = require('jwt-simple'),
      toString = require('lodash').toString,
      moment = require('moment');

const signature = process.env.SIGNATURE || '',
      expiration = process.env.TOKEN_EXPIRATION || 60 * 60 * 2;

/**
 * Grants a token to a client and saves it
 * @param  {Object} user User document
 * @return {Promise}     Resolves to new grant
 */
module.exports = function ( user ) {
  let salt = keygen._({ length: 126 }),
      key = salt + signature;

  let grant = new this({
    salt,
    token: jwt.encode({
      type: user.constructor.modelName,
      user: toString(user._id)
    }, key),
    expires: moment().add(expiration, 'seconds').toDate()
  });

  return grant.save();
};
