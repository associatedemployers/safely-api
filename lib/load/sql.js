const sql = require('co-mssql'),
      winston = require('winston'),
      _ = require('lodash');

let config;

try {
  config = require('../../config/sql');
} catch (e) {
  winston.debug('Could not load static SQL config:', e);
}

module.exports = function (userConfig) {
  return new sql.Connection(_.assign({}, {
    port:           1433, //62792, used for local testing
    requestTimeout: 3600000,
    options: {
      useUTC: false
    }
  }, {
    server:   process.env.SQL_SERVER,
    user:     process.env.SQL_USER,
    password: process.env.SQL_PASSWORD,
    database: process.env.SQL_DB
  }, config || {}, userConfig));
};
