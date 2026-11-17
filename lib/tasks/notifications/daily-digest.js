const winston      = require('winston'),
      moment       = require('moment'),
      co           = require('co'),
      mail         = require('../../mail'),
      Registration = require('../../models/registration'),
      { digestTimes } = require('../../models/registration/email-times');

const task = function (done) {
  co(function*() {
    let registrationsToday = yield Registration.find({
      created: {
        $gte: moment().startOf('day'),
        $lte: moment().endOf('day')
      },
      cancelledOn: null,
      creator: {
        $exists: true
      }
    })
    .populate('creator classes trainee')
    .exec();

    let groups = {};

    for (let i = 0; i < registrationsToday.length; i++) {
      let registration = registrationsToday[i];

      if (!registration.creator) {
        continue;
      }

      // startStr and endStr, with the end shown as the time the booking is
      // over (9:30am) rather than the last millisecond the seat is held (9:29am).
      Object.assign(registration, digestTimes(registration));

      let creatorId = registration.creator._id.toString();

      if (!groups[creatorId]) {
        groups[creatorId] = {
          user: registration.creator,
          registrations: []
        };
      }

      groups[creatorId].registrations.push(registration);
    }

    for (let userId in groups) {
      if (!groups.hasOwnProperty(userId)) {
        continue;
      }

      let group = groups[userId];

      yield mail.send('daily-registration-digest', {
        to: group.user.email,
        subject: `Trainings registered on Safely ${moment().format('M/D/YY')}`,
        data: {
          registrations: group.registrations
        }
      });
    }
  })
  .then(() => done())
  .catch(err => {
    winston.error('Error running registration digest:', err);
  });
};

module.exports = {
  name:      'Task :: Notification :: Daily registration digest',
  startHook: task,
  autoInit:  true,
  pattern:   '0 23 * * *'
};
