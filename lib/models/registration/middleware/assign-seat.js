const moment = require('moment'),
      _ = require('lodash'),
      blocks = [ [ 8, 10 ], [ 10, 12 ], [ 12, 14 ], [ 14, 16 ] ];

let findBlock = time => _.findIndex(blocks, block => time.hour() > block[0] && time.hour() < block[1]);

function middleware (next) {
  const Seat = require('../../seat'),
        Class = require('../../class'),
        Registration = this.constructor;

  Class.find({ _id: { $in: this.classes } }).exec().then(classes => {
    this.hours = classes.reduce((s, c) => s + c, 0);
    let start = moment(this.start),
        startBlock = findBlock(start);

    if ( startBlock < 0 ) {
      throw new Error('Start date is out of range');
    }

    start = moment().hour(blocks[startBlock][0]);

    for (let i = 0; i < this.hours / 2; i++) {


      // if ( start.add(2, 'hours').isBefore() start.add(2, 'hours');
    }
  })
  .then(availableSeat => {
    this.seat = availableSeat._id;
  });
}

module.exports = {
  hook: 'pre',
  event: 'save',
  fn: middleware
};
