module.exports = function*() {
  let connection = this.adapter.getConnection();
  yield connection.connect();

  let hash = this.adapter.serialize(this.record),
      transaction = new this.adapter.sql.Transaction(connection);

  yield transaction.begin();

  let request = new this.adapter.sql.Request(connection);
  request.verbose = true;

  let adapterOverride = this.adapter.adapterOverrideFor(this.record, this.op);

  if (adapterOverride) {
    yield adapterOverride.call(this, request, hash);
  } else {
    let values = this.adapter.prepareRequest(request, hash, true),
        config = this.adapter.configFor(this.record);

    yield request.query(`update ${config.table} set ${values} where ${config.primaryKey}='${this.record.sqlIdentifier}'`);
  }

  yield transaction.commit();
};
