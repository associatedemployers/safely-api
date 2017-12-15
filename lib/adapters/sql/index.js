const SQLMongooseAdapter = require('./sql'),
      adapter = new SQLMongooseAdapter();

exports.adapter = adapter;

exports.mongoose = (schema, opts = { ops: [ 'create', 'update', 'remove' ] }) => {
  schema.add({
    sqlIdentifier: String,
    _import: Boolean
  });

  if (process.env.NODE_ENV === 'test') {
    return;
  }

  schema.pre('save', function (next) {
    this.wasNew = this.isNew;
    this.skipSQLOps = this.skipSQLOps || this.isNew && this._import;
    next();
  });

  if (opts.ops.indexOf('create') > -1 || opts.ops.indexOf('update') > -1) {
    schema.post('save', function (record) {
      if (record.skipSQLOps) {
        return;
      }

      return !record._import && record.wasNew && opts.ops.indexOf('create') > -1 ?
        adapter.createRecord(record) :
        opts.ops.indexOf('update') > -1 ? adapter.updateRecord(record) :
          null;
    });
  }

  if (opts.ops.indexOf('remove') > -1) {
    schema.post('remove', adapter.removeRecord);
  }

  if (!opts.documentRecognizer) {
    return;
  }

  schema.statics.importFromSql = function () {
    return adapter.importNewRecords(this);
  };

  schema.statics.getUpdates = function () {
    return adapter.getUpdates(this);
  };
};
