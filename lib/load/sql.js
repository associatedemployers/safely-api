const sql = require('co-mssql'),
      config = require('../../config/sql'),
      _ = require('lodash');

module.exports = function (userConfig) {
  console.log('Constructing connection');
  return new sql.Connection(_.assign({}, config, userConfig));
};
