module.exports = function*() {
  let connection = this.adapter.getConnection();
  yield connection.connect();

  let hash = this.adapter.serialize(this.record),
      transaction = new this.adapter.sql.Transaction(connection);

  yield transaction.begin();

  let request = new this.adapter.sql.Request(connection),
      values = this.adapter.prepareRequest(request, hash);

  yield request.query(`insert into ${this.configFor(this.record).table} ${values}`);
  yield transaction.commit();
};
