const co   = require('co'),
      mail = require('../../../../mail');

function middleware (record) {
  if (!record.administrative && process.env.NODE_ENV !== 'production' || !record.wasNew || !record.email || record.activatedOn) {
    return;
  }

  co(function*() {
    yield mail.send('activate-account', {
      to: record.email,
      subject: 'Activate your Safely account',
      data: {
        user: record
      }
    });
  });
}

module.exports = {
  hook: 'post',
  event: 'save',
  fn: middleware
};
