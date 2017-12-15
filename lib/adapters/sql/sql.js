const { forOwn, get, set, assign, isArray, toString, uniqBy } = require('lodash'),
      { dasherize, underscore } = require('i')();

const co                    = require('co'),
      moment                = require('moment'),
      mongoose              = require('mongoose'),
      sql                   = require('co-mssql'),
      winston               = require('winston'),
      Op                    = require('../../models/op'),
      makeSqlConnection     = require('../../load/sql'),
      applicationSerializer = require('../../serializers/application');

function SQLMongooseAdapter () {
  this.sql = sql;

  ['createRecord', 'updateRecord', 'removeRecord'].map(op => {
    this[op] = function (record) {
      if (process.env.DISABLE_SQL_OPS === 'true') {
        return;
      }

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
  let _op = op.replace('Record', '');

  return co(require(`./methods/${_op}`).bind({
    record,
    adapter: this,
    op: _op
  }))
  .catch(err => {
    winston.error(`Error running "${_op}" op on record:`, err);
  });
};

SQLMongooseAdapter.prototype.configFor = function (record) {
  try {
    var config = require(`../../serializers/${this.modelNameFor(record).dasherized}/config`);
  } catch (e) {
    winston.debug(`SQL Adapter :: Couldn't find hash map for: ${this.modelNameFor(record).camelized}`);
  }

  return config;
};

SQLMongooseAdapter.prototype.adapterOverrideFor = function (record, op) {
  try {
    var config = require(`../../models/${this.modelNameFor(record).dasherized}/adapter`)[op];
  } catch (e) {
    // We don't care.
    return false;
  }

  return config;
};

SQLMongooseAdapter.prototype.modelNameFor = function (record) {
  let camelized = typeof record === 'string' ? record : record.modelName || record.constructor.modelName;

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

  if (hashMap.onlyInclude) {
    let originalObject = serialized;
    serialized = {};

    hashMap.onlyInclude.forEach(key => {
      serialized[key] = originalObject[key];
    });
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
    let sqlId = record[hash.primaryKey];
    record.sqlIdentifier = sqlId && typeof sqlId === 'object' ? sqlId[0] : sqlId;
    delete record[hash.primaryKey];
  }

  return record;
};

SQLMongooseAdapter.prototype.prepareRequest = function (request, hash, isUpdate) {
  let keys = Object.keys(hash),
      values = keys.map(k => `@${k}`);

  forOwn(hash, (value, key) => {
    request.input(key, value);
  });

  return isUpdate ?
    keys.map((k, i) => `${k}=${values[i]}`).join(',') :
    `(${keys.join(', ')}) values (${values.join(', ')})`;
};

SQLMongooseAdapter.prototype.extractRelationships = function (record, relationships, schema) {
  let relationshipCollection = [];

  forOwn(relationships, (value, key) => {
    let toConfig = this.configFor(value);

    if (!toConfig) {
      return;
    }

    let fromId = get(record, toConfig.primaryKey);

    fromId = isArray(fromId) ? fromId[0] : fromId;

    relationshipCollection.push({
      toModel: this.modelNameFor(schema).camelized,
      toId: record._id,
      toKey: key,
      fromModel: value,
      fromId
    });
  });

  return relationshipCollection;
};

/**
 * SQLMongooseAdapter#importNewRecords
 * @param  {Object} schema Mongoose schema object
 * @return {Promise}       Resolves to an array of relationship primitives
 */
SQLMongooseAdapter.prototype.importNewRecords = function (schema) {
  let adapter = this;

  return co(function*() {
    let connection = adapter.getConnection(),
        relationships = [],
        failed = [];

    yield connection.connect();

    let config = adapter.configFor(schema);
    winston.debug(`SQL Document Recognizer :: Got config for ${schema.modelName}:`, config);

    // Run discovery
    let request = new adapter.sql.Request(connection),
        q = config.discoveryQuery || `select * from ${config.table} where SafelyID is null`;

    request.verbose = true;
    let records = yield request.query(q);

    winston.debug(`SQL Document Recognizer :: Found ${records.length} to be imported.`);

    // Iterate through new documents
    for (let i = 0; i < records.length; i++) {
      winston.debug(`SQL Document Recognizer :: ${i + 1}/${records.length} Importing...`);

      let record = records[i],
          data = assign({}, adapter.deserialize(record, schema), {
            _id: mongoose.Types.ObjectId(),
            _import: true
          }),
          document;

      if (config.relationships) {
        relationships = relationships.concat(adapter.extractRelationships(data, config.relationships, schema));
      }

      // Save our new document in mongo
      if (!process.env.SQL_DRYRUN) {
        try {
          document = yield (new schema(data)).save();
        } catch (e) {
          failed.push(e);
          continue;
        }
      } else {
        document = data;
        document._id = mongoose.Types.ObjectId();
        winston.debug('Dry run mode, document would be:');
        winston.debug(data);
      }

      winston.debug(`SQL Document Recognizer :: ${i + 1}/${records.length} Saving...`);
      winston.debug(data);

      // Update our SQL db so discovery doesn't pick it up again
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

    if (failed && failed.length > 0) {
      winston.debug(`SQL Document Recognizer :: Failed to import ${failed.length} records. Errors were:`);
      uniqBy(failed, 'message').forEach(winston.error);
    }

    winston.debug('SQL Document Recognizer :: Imported records.');
    yield connection.close();
    return relationships;
  });
};

/**
 * SQLMongooseAdapter#getUpdates
 * @param  {Object} schema Mongoose schema object
 * @return {Promise}       Resolves to an array of relationship primitives
 */
SQLMongooseAdapter.prototype.getUpdates = function (schema) {
  let adapter = this;

  return co(function*() {
    const lastOp = (yield Op.find({
      name: 'collect_sql_updates',
      model: schema.modelName,
      completed: { $exists: true }
    })
    .sort({ completed: -1 })
    .limit(1)
    .select('created')
    .exec())[0] || {};

    let connection = adapter.getConnection(),
        relationships = [],
        config = adapter.configFor(schema);

    if (!config || !config.twoWaySync) {
      return relationships;
    }

    yield connection.connect();

    winston.debug(`SQL Document Updates :: Got config for ${schema.modelName}:`, config);

    // Run discovery
    let request = new adapter.sql.Request(connection);
    request.input('LASTOP', lastOp.created || new Date());
    let q = config.updateDiscoveryQuery ||
          `select * from ${config.table} where SafelyID is not null and UpdatedOn > @LASTOP`;

    request.verbose = true;
    let records = yield request.query(q);

    const operationRecord = yield (new Op({
      name: 'collect_sql_updates',
      model: schema.modelName
    })).save();

    winston.debug(
      `SQL Document Updates :: Found ${records.length} to be imported.`,
      `(Updated since ${moment(lastOp.created || undefined).format('M/D/YY h:mma')})`
    );

    // Iterate through new documents
    for (let i = 0; i < records.length; i++) {
      winston.debug(`SQL Document Updates :: ${i + 1}/${records.length} Syncing updates...`);

      let record = records[i],
          data = assign({}, adapter.deserialize(record, schema)),
          document;

      let currentRecord = yield schema.findById(data.SafelyID);

      if (!currentRecord) {
        continue;
      }

      const changedKeys = Object.keys(data).filter(key => toString(data[key]) !== toString(currentRecord[key]));

      if (changedKeys.length < 1) {
        continue;
      }

      Object.assign(currentRecord, data);

      if (config.relationships) {
        relationships = relationships.concat(adapter.extractRelationships(data, config.relationships, schema));
      }

      // Save these updates in mongo
      if (!process.env.SQL_DRYRUN) {
        try {
          currentRecord.skipSQLOps = true;
          currentRecord.__v++;
          yield currentRecord.save();
          document = yield schema.findById(data.SafelyID);
        } catch (e) {
          winston.error('Could not save document updates:', e);
          continue;
        }
      } else {
        document = data;
        winston.debug('Dry run mode, updated document would be:');
        winston.debug(currentRecord);
      }

      winston.debug(`SQL Document Updates :: ${i + 1}/${records.length} Saving...`);

      // Update SQL db
      let update = new adapter.sql.Request(connection),
          q = `
            update ${config.table}
            set Version='${document.__v}'
            where ${config.primaryKey}='${document.sqlIdentifier}'`;
      update.verbose = true;

      winston.debug(`SQL Document Updates :: ${i + 1}/${records.length} Updating remote version for record...`);
      if (!process.env.SQL_DRYRUN) {
        yield update.query(q);
      } else {
        winston.debug(`Dry run mode, query would be: ${q}`);
      }
      winston.debug(`SQL Document Updates :: ${i + 1}/${records.length} Saved version.`);
    }

    winston.debug('SQL Document Updates :: Done with updates.');
    operationRecord.completed = new Date();
    yield operationRecord.save();
    yield connection.close();
    return relationships;
  });
};

/**
 * SQLMongooseAdapter#establishRelationships
 * Establishes mongo relationships from extrapolated sql records
 *
 * Uses [{
 *   toModel: 'User',
 *   toId: 'userid123',
 *   toKey: 'company',
 *   fromModel: 'Company',
 *   fromId: 'companyid123'
 * }]
 *
 * @param  {Array} relationships Array of primitive relationship references
 * @return {Promise}             Promise
 */
SQLMongooseAdapter.prototype.establishRelationships = function (relationships) {
  winston.debug('Establishing relationships');

  return co(function*() {
    for (let i = 0; i < relationships.length; i++) {
      let relationship = relationships[i],
          RelationshipTarget = mongoose.model(relationship.toModel),
          RelationshipSource = mongoose.model(relationship.fromModel);

      winston.debug(`SQLMongooseAdapter :: Establishing relationship for ${relationship.toModel}`);
      let source = yield RelationshipSource.findOne({
        sqlIdentifier: relationship.fromId
      });

      if (!source) {
        winston.debug(`SQLMongooseAdapter :: Could not find source record for ${relationship.fromModel}.`);
        continue;
      }

      let updateOperation = { $set: {} };
      updateOperation.$set[relationship.toKey] = source._id;

      winston.debug(`SQLMongooseAdapter :: Updating ${relationship.toId.toString()}`);

      yield RelationshipTarget.update({
        _id: relationship.toId
      }, updateOperation);
    }
  });
};
