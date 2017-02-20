const sql = require('co-mssql'),
      config = require('../../config/sql'),
      _ = require('lodash');

module.exports = function (userConfig) {
  return new sql.Connection(_.assign({}, config, userConfig));
};
