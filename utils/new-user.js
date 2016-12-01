const globSync = require('glob').sync;

require('../lib/load/mongoose')();

globSync('../models/**/index.js', { cwd: __dirname }).map(require);

let User = require('../lib/models/user');
let user = new User({
  name: {
    first: 'Tina',
    middle: 'The',
    last: 'Trainer'
  },
  email: process.argv[2],
  password: process.argv[3]
});
user.save().then(u => {
  console.log('user created', u);
  process.exit(0);
});
