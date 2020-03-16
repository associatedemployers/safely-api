const { debug }       = require('winston'),
      moment          = require('moment'),
      mail            = require('../../mail'),
      
      HubRegistration = require('../../models/hub-registration');

const task = async function () {

  // Find classes happening in two days, but before 1 day.

  const upcomingClasses = await 

  // => iterate each
  // Find all registrations for them
  // Send roster + link to updated roster

  debug('Processing notifications for class registration digest...');

  if (!registrationsToday.length) {
    debug('No class registrations to process...');
    return;
  }

  await mail.send('hub-admin-roster', {
    to: 'james@aehr.org',
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
