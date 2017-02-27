const co      = require('co'),
      moment  = require('moment'),
      mail    = require('../../../../mail');

function middleware (doc) {
  if ( !doc.wasNew ) {
    return;
  }

  co(function*() {
    let record = yield doc.constructor.populate(doc.toObject(), [{
      path: 'company'
    }, {
      path: 'classes'
    }, {
      path: 'trainee'
    }]);

    if (!record.trainee.email) {
      return;
    }

    yield mail.send('trainee-registration', {
      to: record.trainee.email,
      subject: 'Your upcoming safety training',
      data: {
        registration: record,
        multiDay: !moment(record.start).isSame(record.end, 'day'),
        start: moment(record.start).format('dddd, MMM Do, h:mma'),
        end: moment(record.end).format('dddd, MMM Do, h:mma'),
        arriveAt: moment(record.start).subtract(30, 'min').format('M/D/YY at h:mma')
      }
    });
  });
}

module.exports = {
  hook: 'post',
  event: 'save',
  fn: middleware
};
