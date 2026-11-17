const co      = require('co'),
      mail    = require('../../../../mail'),
      { traineeEmailTimes } = require('../../email-times');

const { ADMIN_EMAIL } = process.env;

function middleware (doc) {
  if (!doc.wasNew) {
    return;
  }

  co(function*() {
    let record = yield doc.constructor.populate(doc.toObject({
      depopulate: true}), [{
      path: 'company'
    }, {
      path: 'classes'
    }, {
      path: 'trainee'
    }]);

    let mailOpts = {
      to: record.trainee.email,
      bcc: ADMIN_EMAIL,
      subject: 'Your upcoming safety training',
      data: Object.assign({
        registration: record,
        company: record.company || (record.creator || {}).company
      }, traineeEmailTimes(record))
    };

    if (!record.trainee.email) {
      if (!ADMIN_EMAIL) {
        return;
      }

      mailOpts.to = ADMIN_EMAIL;
      delete mailOpts.bcc;
    }

    yield mail.send('trainee-registration', mailOpts);
  });
}

module.exports = {
  hook: 'post',
  event: 'save',
  fn: middleware
};
