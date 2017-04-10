/*
  user.notifyActivation();
*/
const co = require('co'),
      mail = require('../../../mail');

module.exports = function () {
  const record = this;

  return co(function*() {
    console.log(process.env.NODE_ENV, process.env.DISABLE_ACTIVATION_NOTIFICATIONS);

    let noNotifyMode = process.env.NODE_ENV !== 'production' || process.env.DISABLE_ACTIVATION_NOTIFICATIONS === 'true';

    if (noNotifyMode || !record.email) {
      return;
    }

    yield mail.send('activate-account', {
      to: record.email,
      subject: 'Activate your Safely account',
      data: {
        user: record
      }
    });
  });
};
