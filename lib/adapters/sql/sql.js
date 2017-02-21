const { forOwn, set, assign } = require('lodash'),
      co = require('co'),
      sql = require('co-mssql'),
      winston = require('winston'),
      { dasherize, underscore } = require('i')(),
      // { join } = require('path'),
      makeSqlConnection = require('../../load/sql'),
      applicationSerializer = require('../../serializers/application');

function SQLMongooseAdapter () {
  this.sql = sql;

  ['createRecord', 'updateRecord', 'removeRecord'].map(op => {
    this[op] = function (record) {
      return this._runOp(op, record);
    };
  });

  return this;
}

module.exports = SQLMongooseAdapter;

SQLMongooseAdapter.prototype.getConnection = function () {
  return makeSqlConnection();
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
    winston.debug(`SQL Adapter :: Couldn't find hash map for: ${record.modelName || record.constructor.modelName}`);
  }

  return config;
};

SQLMongooseAdapter.prototype.modelNameFor = function (record) {
  let camelized = record.modelName || record.constructor.modelName;

  return {
    camelized,
    dasherized: dasherize(underscore(camelized))
  };
};

SQLMongooseAdapter.prototype.serialize = function (record) {
  let modelName = this.modelNameFor(record),
      serializerPath = `../../serializers/${modelName.dasherized}`;

  try {
    var serializer = require(serializerPath);
  } catch (e) {
    winston.debug(`SQL Adapter :: Couldn't find serializer for: ${modelName.camelized}`);
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

SQLMongooseAdapter.prototype.deserialize = function (record, schema) {
  let modelName = this.modelNameFor(schema),
      serializerPath = `../../serializers/${modelName.dasherized}`;

  try {
    var serializer = require(serializerPath);
  } catch (e) {
    winston.debug(`SQL Adapter :: Couldn't find serializer for: ${modelName.camelized}`);
  }

  let object = assign({}, record),
      hashMap = this.configFor(schema),
      deserialized;

  if (hashMap) {
    deserialized = this.unmapWithHash(hashMap, object);
  }

  deserialized = applicationSerializer.deserialize(object);

  if (serializer) {
    deserialized = serializer.deserialize(deserialized);
  }

  return deserialized;
};

SQLMongooseAdapter.prototype.mapWithHash = function (hash, record) {
  for (let key in hash.values) {
    if (!hash.values.hasOwnProperty(key)) {
      continue;
    }

    set(record, hash.values[key], record[key]);
    delete record[key];
  }

  return record;
};

SQLMongooseAdapter.prototype.unmapWithHash = function (hash, record) {
  for (let key in hash.values) {
    if (!hash.values.hasOwnProperty(key)) {
      continue;
    }

    let sqlKey = hash.values[key];

    set(record, key, record[sqlKey]);
    delete record[sqlKey];
  }

  if (hash.primaryKey) {
    record.sqlIdentifier = record[hash.primaryKey];
    delete record[hash.primaryKey];
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

SQLMongooseAdapter.prototype.importNewRecords = function (schema) {
  let adapter = this;

  return co(function*() {
    let connection = adapter.getConnection();
    yield connection.connect();

    let config = adapter.configFor(schema);
    winston.debug(`SQL Document Recognizer :: Got config for ${schema.modelName}:`, config);

    let request = new adapter.sql.Request(connection),
        q = `select * from ${config.table} where SafelyID is null`;
    request.verbose = true;

    let records = yield request.query(q);

    winston.debug(`SQL Document Recognizer :: Found ${records.length} to be imported.`);

    for (let i = 0; i < records.length; i++) {
      winston.debug(`SQL Document Recognizer :: ${i + 1}/${records.length} Importing...`);

      let record = records[i],
          data = assign({}, adapter.deserialize(record, schema), { _import: true }),
          document;

      if (!process.env.SQL_DRYRUN) {
        document = yield (new schema(data)).save();
      } else {
        document = data;
        document._id = require('mongoose').Types.ObjectId();
        winston.debug('Dry run mode, document would be:');
        winston.debug(data);
      }

      winston.debug(`SQL Document Recognizer :: ${i + 1}/${records.length} Saving...`);
      winston.debug(data);

      let update = new adapter.sql.Request(connection),
          q = `
            update ${config.table}
            set SafelyID='${document._id.toString()}'
            where ${config.primaryKey}='${document.sqlIdentifier}'`;
      update.verbose = true;

      winston.debug(`SQL Document Recognizer :: ${i + 1}/${records.length} Updating SQL ref for record...`);
      if (!process.env.SQL_DRYRUN) {
        yield update.query(q);
      } else {
        winston.debug(`Dry run mode, query would be: ${q}`);
      }
      winston.debug(`SQL Document Recognizer :: ${i + 1}/${records.length} Saved ref.`);
    }

    winston.debug('SQL Document Recognizer :: Imported records.');
    yield connection.close();
  });
};
