const moment = require('moment'),
      mail   = new require('../../../../mail').constructor({
        sender: {
          name: 'AE/MSSC Classes',
          email: 'noreply@mssc.org'
        }
      });

const { GOOGLE_MAPS_API_KEY } = process.env;

async function middleware (record) {
  if (!record.wasNew) {
    return;
  }

  const populatedRecord = await record.constructor.populate(record.toObject({ depopulate: true }), [{
    path: 'participants'
  }, {
    path: 'hubClass',
    populate: {
      path: 'classInformation'
    }
  }]);

  // Send confirmation to registrant
  await mail.send('hub-registration', {
    to: populatedRecord.email,
    subject: `Confirmation for your class registration on ${moment(record.created).format('M/D/YY')}`,
    data: {
      registration: populatedRecord,
      total: populatedRecord.total && `$${populatedRecord.total}`.replace(/(\d*)(\d{2})/, '$1.$2')
    }
  });

  console.log(populatedRecord);

  const participantBaseEmail = {
    subject: `Class info for ${populatedRecord.hubClass.classInformation.name} starting on ${moment(populatedRecord.hubClass.times[0].start).format('M/D/YY')}`,
    attachments: [{
      filename: 'event.ics',
      content:  Buffer.from(await populatedRecord.hubClass.createIcs(), 'utf-8')
    }]
  };

  const [ lat, lng ] = (populatedRecord.hubClass.location.geo || {}).coordinates || [],
        { line1, city, state } = (populatedRecord.hubClass.location || {}).address || {},
        mapUri = lat && lng && `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x300&maptype=roadmap&markers=color:red%7Clabel:C%7C${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`,
        mapLink = line1 && city && `https://www.google.com/maps/q=${[ line1, city, state ].join('+').replace(/\s/g, '+')}`;

  const baseData = {
    times: populatedRecord.hubClass.times.map(t => ({
      date: moment(t.start).format('M/D/YY'),
      start: moment(t.start).format('h:mma'),
      end: moment(t.end).format('h:mma')
    })),
    mapUri,
    mapLink,
    registration: populatedRecord
  };      

  // Send class information to participants
  const emails = populatedRecord.participants.filter(participant => participant.email).map(participant => ({
    ...participantBaseEmail,
    to: participant.email,
    data: {
      ...baseData,
      participant
    }
  }));
  console.log('created emails', emails);
  await Promise.all(emails.map(em => mail.send('hub-class-information', em)));
  console.log('done');
}

module.exports = {
  hook: 'post',
  event: 'save',
  fn: middleware
};
