const SQLMongooseAdapter = require('./adapter'),
      adapter = new SQLMongooseAdapter();

exports.adapter = adapter;

exports.mongoose = (schema, opts = { ops: [ 'create', 'update', 'remove' ] }) => {
  schema.add({
    sqlIdentifier: String
  });

  schema.pre('save', function () {
    this.wasNew = this.isNew;
  });

  if (opts.ops.indexOf('create') > -1 || opts.ops.indexOf('update') > -1) {
    schema.post('save', function (record) {
      return this.wasNew && opts.ops.indexOf('create') > -1 ?
        adapter.create(record) :
        opts.ops.indexOf('update') > -1 ? adapter.update(record) :
          null;
    });
  }

  if (opts.ops.indexOf('remove') > -1) {
    schema.post('remove', adapter.remove);
  }
};
