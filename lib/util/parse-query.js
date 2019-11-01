const _         = require('lodash'),
      moment    = require('moment'),
      JS_FORMAT = 'ddd MMM DD YYYY HH:mm:ss [GMT]ZZ';

function defaultCallback (value) {
  if (value && !isNaN(value)) {
    return parseFloat(value);
  } else if (value === 'true' || value === 'false') {
    return value === 'true' ? true : false;
  } else if (typeof value === 'string' && moment(value.replace(/ \(.*\)/, ''), [ moment.ISO_8601, JS_FORMAT ], true).isValid()) {
    return new Date(value);
  } else {
    return value;
  }
}

/**
 * For parsing queries where types are converted by http
 * @param  {Object} object   Object to parse
 * @param  {Object} callback Function to parse values with
 * @return {Object}          Parsed Object
 */
module.exports = function (object, callback) {
  if (!_.isObject(object)) {
    return object;
  }

  const cb = callback || defaultCallback;

  const mapObjectValue = value => {
    if (_.isObject(value) && !_.isArray(value)) {
      return _.mapValues(value, mapObjectValue);
    } else if (_.isArray(value)) {
      return value.map(mapObjectValue);
    } else {
      return cb(value);
    }
  };

  return _.mapValues(object, mapObjectValue);
};
