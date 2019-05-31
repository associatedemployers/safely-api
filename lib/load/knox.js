// const Promise = require('bluebird'),
//       knox = require('knox');
//
// module.exports = ( _bucket, config ) => {
//   let bucket = _bucket || process.env.AWS_BUCKET || (process.env.NODE_ENV === 'test' ? 'granitehr-test' : 'granite-uploads');
//   // Initialize a connection to S3
//   // while promisifying the entire knox lib
//   return Promise.promisifyAll(knox.createClient({
//     bucket,
//     key: config ? config.key : process.env.AWS_KEY || require('../config/aws').key,
//     secret: config ? config.secret : process.env.AWS_SECRET || require('../../config/aws').secret
//   }));
// };

const Promise = require('bluebird'),
      knox = require('knox');

module.exports = (_bucket, config) => {
  let bucket = _bucket || process.env.AWS_BUCKET || (process.env.NODE_ENV === 'test' ? 'granitehr-test' : 'granite-uploads'),
      jsonConfig;

  try {
    jsonConfig = require('../../config/aws');
    //WHY DOESNT THIS EXIST?!
  } catch (e) {
    jsonConfig = {};
    // this could happen, it doesn't matter
  }

  console.log('here');

  // Initialize a connection to S3
  // while promisifying the entire knox lib
  let x;
  try {
    x = Promise.promisifyAll(knox.createClient({
      bucket,
      key:    config ? config.key : process.env.AWS_KEY || jsonConfig.key,
      secret: config ? config.secret : process.env.AWS_SECRET || jsonConfig.secret
    }));

  } catch (err) {
    console.log('err:', err);
  }

  return x;
};
