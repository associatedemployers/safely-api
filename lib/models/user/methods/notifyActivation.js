/*
  user.notifyActivation();
*/
const co = require('co'),
      winston = require('winston'),
      mail = require('../../../mail');

module.exports = function () {
  const record = this;

  return co(function*() {
    console.log(process.env.NODE_ENV, process.env.DISABLE_ACTIVATION_NOTIFICATIONS);

    let noNotifyMode = process.env.NODE_ENV !== 'production' || process.env.DISABLE_ACTIVATION_NOTIFICATIONS === 'true';
    console.log(`record.email: ${record.email}, noNotifyMode: ${noNotifyMode}`);
    if (noNotifyMode || !record.email) {
      return;
    }

    yield mail.send('activate-account', {
      to: record.email,
      subject: 'Activate your Safely account',
      data: {
        user: record
      },
      attachments: {   // use URL as an attachment
        filename: 'Safely_Instructions.pdf',
        path: 'https://granite-uploads.s3.amazonaws.com/safley/Safely_Instructions.pdf'
      }
    });
  })
    .catch(winston.error);
};
