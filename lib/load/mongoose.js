/*
  Mongoose initializer
*/

const mongoose = require('mongoose'),
      winston  = require('winston'),
      chalk    = require('chalk');

const defaults = {
  server: {
    socketOptions: {
      keepAlive: 300000,
      connectTimeoutMS: 30000
    }
  },
  replset: {
    socketOptions: {
      keepAlive: 300000,
      connectTimeoutMS : 30000
    }
  }
};

mongoose.Promise = require('bluebird');

module.exports = function ( db, address ) {
  var _db = process.env.NODE_ENV === 'test' ? 'granitetest' : db ? db : 'granite',
      _address = process.env.MONGODB_URI || address || 'localhost';

  if ( mongoose.connection.readyState === 0 ) {
    mongoose.connection.close();
    winston.debug(chalk.dim('Connecting to', _db, 'db via address:', _address));
    if ( process.env.MONGODB_URI ) {
      mongoose.connect(_address, defaults);
    } else {
      mongoose.connect(_address, _db);
    }
  }

  return mongoose.connection;
};
