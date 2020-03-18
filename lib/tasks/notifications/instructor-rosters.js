const { debug }       = require('winston'),
      moment          = require('moment'),
      mail            = require('../../mail'),
      HubClass        = require('../../models/hub-class'),
      HubRegistration = require('../../models/hub-registration');

const task = async function () {
  debug('Processing notifications for class rosters...');

  // Find classes happening in two days
  const upcomingClasses = await HubClass.find({
    'times.start': {
      $gte: moment().add(2, 'days').startOf('day'),
      $lte: moment().add(2, 'days').endOf('day')
    }
  }).populate('instructor classInformation');

  if (!upcomingClasses.length) {
    debug('No notifications to process for class rosters');
    return;
  }

  // => iterate each
  for (let i = 0; i < upcomingClasses.length; i++) {
    const hubClass = upcomingClasses[i];
    const registrations = await HubRegistration.aggregate([{
      $match: { hubClass: hubClass._id }
    }, {
      $unwind: '$participants'
    }, {
      $lookup: {
        from: 'hubparticipants',
        localField: 'participants',
        foreignField: '_id',
        as: 'participant'
      }
    }]);

    await mail.send('hub-admin-roster', {
      to: [ 'james@aehr.org', hubClass.instructor.email ],
      subject: `Current roster for ${hubClass.classInformation.name}`,
      data: {
        hubClass,
        registrations: registrations.map(reg => {
          reg.participant = reg.participant[0];
          return reg;
        })
      }
    });
  }
};

module.exports = {
  name:      'Task :: Notification :: Instructor rosters',
  startHook: task,
  autoInit:  true,
  pattern:   '* * * * *'
};
