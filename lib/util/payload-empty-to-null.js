const _ = require('lodash');

/**
 * For parsing queries where types are converted by http
 * @param  {Object} value Payload to parse
 * @return {Object}       Parsed payload
 */
module.exports = function stripEmptyStrings (value) {
  if( _.isObject(value) && !_.isArray(value) ) {
    return _.mapValues(value, stripEmptyStrings);
  } else if( _.isArray(value) ) {
    return value.map(stripEmptyStrings);
  } else {
    return value === '' ? null : value;
  }
};
