const checks = require('../../lib/util/status-checks');

exports.getHealth = function*() {
  let result = yield checks();
  this.body = result;
};
