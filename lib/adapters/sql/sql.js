const { forOwn } = require('lodash'),
      co = require('co'),
      sql = require('co-mssql'),
      winston = require('winston'),
      { dasherize, underscore } = require('i')(),
      { join } = require('path'),
      connectToSql = require('../../load/sql'),
      applicationSerializer = require('../../serializers/application');

function SQLMongooseAdapter (opts) {
  this.connect();

  this.table = opts.table;
  this.sql = sql;

  ['create', 'update', 'remove'].map(op => {
    this.prototype[op] = function (record) {
      return this.runOp(op, record);
    };
  });

  return this;
}

SQLMongooseAdapter.prototype.connect = function () {
  this.connection = connectToSql();
  return this.connection;
};

SQLMongooseAdapter.prototype._runOp = function (op, record) {
  return co(require(`./methods/${op}`).bind({
    record,
    adapter: this
  }));
};

SQLMongooseAdapter.prototype.configFor = function (record) {
  try {
    var config = require(`../../serializers/${this.modelNameFor(record).dasherized}/config`);
  } catch (e) {
    winston.debug(`SQL Adapter :: Couldn't find hash map for: ${record.constructor.modelName}`);
  }

  return config;
};

SQLMongooseAdapter.prototype.modelNameFor = function (record) {
  return {
    camelized: record.constructor.modelName,
    dasherized: dasherize(underscore(record.constructor.modelName))
  };
};

SQLMongooseAdapter.prototype.serialize = function (record) {
  let modelName = this.modelNameFor(record),
      serializerPath = `../../serializers/${modelName}`;

  try {
    var serializer = require(serializerPath);
  } catch (e) {
    winston.debug(`SQL Adapter :: Couldn't find serializer for: ${modelName}`);
  }

  let object = record.toObject(),
      hashMap = this.configFor(record),
      serialized;

  if (hashMap) {
    serialized = this.mapWithHash(hashMap, object);
  }

  serialized = applicationSerializer.serialize(object);

  if (serializer) {
    serialized = serializer.serialize(serialized);
  }

  return serialized;
};

SQLMongooseAdapter.prototype.mapWithHash = function (hash, record) {
  for (let key in hash.values) {
    if (!hash.values.hasOwnProperty(key)) {
      continue;
    }

    record[hash.values[key]] = record[key];
    delete record[key];
  }

  return record;
};

SQLMongooseAdapter.prototype.prepareRequest = function (request, hash) {
  let keys = Object.keys(hash),
      values = keys.map(k => `@${k}`);

  forOwn(hash, (value, key) => {
    request.input(key, value);
  });

  return `(${keys.join(', ')}) values (${values.join(', ')})`;
};
