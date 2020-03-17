const { debug }       = require('winston'),
      moment          = require('moment'),
      mail            = require('../../mail'),
      HubRegistration = require('../../models/hub-registration');

const task = async function () {
  debug('Processing notifications for class registration digest...');

  const registrationsToday = await HubRegistration.find({
    created: { $gte: moment().subtract(1, 'day').startOf('day').toDate() }
  }).populate({
    path: 'hubClass',
    populate: { path: 'classInformation' }
  });

  if (!registrationsToday.length) {
    debug('No class registrations to process...');
    return;
  }

  await mail.send('hub-admin-registration-digest', {
    to: 'james@aehr.org',
    subject: `Class registrations since ${moment().subtract(1, 'day').format('M/D/YY')}`,
    data: {
      registrations: registrationsToday
    }
  });
};

module.exports = {
  name:      'Task :: Notification :: Daily class hub digest',
  startHook: task,
  autoInit:  true,
  pattern:   '0 4 * * *'
};
