/*
  Mongoose initializer
*/

const mongoose = require('mongoose'),
      winston  = require('winston'),
      chalk    = require('chalk');

const defaults = {
  keepAlive: 300000,
  connectTimeoutMS: 30000
};

mongoose.Promise = require('bluebird');

module.exports = function ( db, address ) {
  let _db = db ? db : 'safely',
      _address = address || 'localhost/',
      fullURI = process.env.MONGODB_URI;

  let uri = fullURI || `mongodb://${_address}${_db}`;

  if (process.env.NODE_ENV === 'test') {
    uri = 'mongodb://localhost/safelytest';
  }

  if ( mongoose.connection.readyState === 0 ) {
    mongoose.connection.close();
    winston.debug(chalk.dim('Connecting to', _db, 'db via address:', _address));
    mongoose.connect(uri, defaults);
  }

  if (process.env.DEBUG_MONGOOSE === 'true') {
    mongoose.set('debug', true);
  }

  return mongoose.connection;
};
