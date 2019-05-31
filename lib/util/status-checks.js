const seer = require('seer-checks'),
      mongoose = require('mongoose'),
      request = require('request-promise'),
      { debug } = require('winston');

// EXPORT THE SEER OBJECT INSTEAD OF FUNCTION

/* Expose health check at /api/v1/__status__/ */
module.exports = seer(null, {
  framework: 'barebones',
  debounce:  30000, // debounce checks
  checks:    [{
    name:    'mongodb-ping',
    retries: 5, // number of retries allowed
    check:   async () => {
      let ping = await mongoose.connection.db.admin().ping();

      if (!ping) {
        throw new Error('No ping result from mongodb!');
      }
    }
  }, {
    name:    'document-uploading',
    retries: 5,
    check:   async () => {
      const s3 = require('../load/knox')();
      console.log('!! after');
      await s3.listAsync();
    }
  }, {
    name:    'sendgrid',
    retries: 5,
    check:   async () => {
      try {
        var sendgridResponse = await request({
          url:    'https://3tgl2vf85cht.statuspage.io/api/v2/status.json',
          method: 'GET',
          json:   true
        });
      } catch (err) {
        debug('Sendgrid health check request rejected with:', err.message || err);
        throw err;
      }

      if (sendgridResponse.status.description !== 'All Systems Operational') {
        throw new Error('Sendgrid health check failed!');
      }
    }
  }]
});
