module.exports = function*() {
  let hash = this.adapter.serialize(this.record),
      transaction = new this.adapter.sql.Transaction(this.adapter.connection);

  yield transaction.begin();

  let request = new this.adapter.sql.Request(this.adapter.connection),
      values = this.adapter.prepareRequest(request, hash);

  yield request.query(`insert into ${this.adapter.table} ${values}`);
  yield transaction.commit();
};
