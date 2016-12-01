var _      = require('lodash'),
    moment = require('moment');


function defaultCallback ( value ) {
  if ( value && !isNaN( value ) ) {
    return parseFloat( value );
  } else if ( value === 'true' || value === 'false' ) {
    return value === 'true' ? true : false;
  } else if ( moment(new Date(value)).isValid() ) {
    return moment(new Date(value)).toDate();
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
module.exports = function ( object, callback ) {
  if ( !_.isObject( object ) ) {
    return object;
  }

  var cb = callback || defaultCallback;

  var mapObjectValue = function ( value ) {
    if( _.isObject( value ) && !_.isArray( value ) ) {
      return _.mapValues( value, mapObjectValue );
    } else if( _.isArray( value ) ) {
      return value.map( mapObjectValue );
    } else {
      return cb( value );
    }
  };

  return _.mapValues( object, mapObjectValue );
};
