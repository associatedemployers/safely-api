const co      = require('co'),
      moment  = require('moment'),
      mail    = require('../../../../mail');

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
      data: {
        registration: record,
        company: record.company || (record.creator || {}).company,
        multiDay: !moment(record.start).isSame(record.end, 'day'),
        start: moment(record.start).format('dddd, MMM Do, h:mma'),
        end: moment(record.end).format('dddd, MMM Do, h:mma'),
        arriveAt: moment(record.start).subtract(30, 'min').format('M/D/YY [at] h:mma'),
        moveDate: moment(record.start).isSameOrAfter('2020-02-17'),
      }
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
