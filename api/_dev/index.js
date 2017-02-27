/*
  Dev resource
 */
const mail = require('../../lib/mail'),
      _ = require('lodash');

exports.testEmail = function*() {
  this.body = (yield mail.__render(this.params.name, _.assign({}, this.request.body))).html;
  this.status = 200;
};
