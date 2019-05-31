const checks = require('../../lib/util/status-checks');

exports.getHealth = function*() {
  console.log('!! inside get health');
  let result = yield checks();
  //CALL STATUS-CHECKS.JS IMPORT, SET BODY ON "THIS"
  console.log('!! result:', result);
  this.body = result;
  // do something with it
};
