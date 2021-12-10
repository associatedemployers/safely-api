const { debug }       = require('winston'),
      moment          = require('moment'),
      mail            = require('../../mail'),
      HubClass        = require('../../models/hub-class'),
      HubRegistration = require('../../models/hub-registration');

const { ADMIN_EMAIL } = process.env;

const task = async function () {
  let hubClassesNoInstructor = [];
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
        from:         'hubparticipants',
        localField:   'participants',
        foreignField: '_id',
        as:           'participant'
      }
    }]);
    
    if (( hubClass.instructor || {} ).email ) {
      await mail.send('hub-admin-roster', {
        to:      [ ADMIN_EMAIL, hubClass.instructor.email ],
        subject: `Current roster for ${hubClass.classInformation.name}`,
        data:    {
          hubClass,
          registrations: registrations.map(reg => {
            reg.participant = reg.participant[0];
            return reg;
          })
        }
      });
    } else if (registrations.length) {
      hubClassesNoInstructor.push(hubClass);
    }
  }

  if (hubClassesNoInstructor.length) {
    await mail.send('hub-admin-instructor-tba', { 
      to:      ADMIN_EMAIL,
      subject: 'These classes do not have instructors',
      data:    { hubClassesNoInstructor }
    });
  }
};

module.exports = {
  name:      'Task :: Notification :: Instructor rosters',
  startHook: task,
  autoInit:  true,
  pattern:   '0 4 * * *'
};
