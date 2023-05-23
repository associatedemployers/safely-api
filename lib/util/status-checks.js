const seer = require('seer-checks'),
      mongoose = require('mongoose');
      // request = require('request-promise'),
      // { debug } = require('winston');

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
  }
  /*, {
    name:    'sendgrid',
    retries: 5,
    check:   async () => {
      try {
        var sendgridResponse = await request({
          url:    'https://status.sendgrid.com',
          method: 'GET',
          json:   true
        });
      } catch (err) {
        debug('Sendgrid health check request rejected with:', err.message || err);
        throw err;
      }

      let mailStatus = sendgridResponse.components.find(component => component.name === 'Mail Sending').status;

      if (mailStatus !== 'operational') {
        throw new Error('Sendgrid health check failed!');
      }
    }
  }
  */, {
    name: 'sql server',
    retries: 5,
    check: async () => {
      const adapter = require('../../lib/load/sql')();

      try {
        let connection = await adapter.connect();
        let connected = await connection();

        connected.close();

      } catch (err) {
        throw new Error(err);
      }
    }
  }]
});
