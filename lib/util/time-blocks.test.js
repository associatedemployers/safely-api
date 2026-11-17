const expect = require('chai').expect,
      moment = require('moment');

const {
  blockEndHour,
  blockLength,
  blockStart,
  blockEnd,
  fractionalHour,
  normalizeBlocks,
  findBlockStartingAt,
  blocksOverlap,
  formatHour
} = require('./time-blocks');

describe('Unit :: Util :: time-blocks', () => {
  const tuesday = moment('2026-03-03', 'YYYY-MM-DD');

  describe('blockEndHour', () => {
    it('returns the end hour of a normal block', () => {
      expect(blockEndHour([ 7.5, 9.5 ])).to.equal(9.5);
    });

    it('treats an end of 0 as midnight (24)', () => {
      expect(blockEndHour([ 22, 0 ])).to.equal(24);
    });
  });

  describe('blockLength', () => {
    it('measures a two hour block', () => {
      expect(blockLength([ 8, 10 ])).to.equal(2);
    });

    it('measures a half-hour-aligned block', () => {
      expect(blockLength([ 11.5, 13 ])).to.equal(1.5);
    });

    it('measures a block that ends at midnight', () => {
      expect(blockLength([ 22, 0 ])).to.equal(2);
    });
  });

  describe('blockStart', () => {
    it('gives the wall-clock start of a whole-hour block', () => {
      const start = moment(blockStart(tuesday, [ 8, 10 ]));

      expect(start.format('YYYY-MM-DD HH:mm:ss.SSS')).to.equal('2026-03-03 08:00:00.000');
    });

    it('keeps the half hour (moment().hour(7.5) would drop it)', () => {
      const start = moment(blockStart(tuesday, [ 7.5, 9.5 ]));

      expect(start.format('YYYY-MM-DD HH:mm:ss.SSS')).to.equal('2026-03-03 07:30:00.000');
    });

    it('ignores the time of day on the date it is given', () => {
      const lateInTheDay = moment(tuesday).hour(15).minute(42).second(17);
      const start = moment(blockStart(lateInTheDay, [ 9.5, 11.5 ]));

      expect(start.format('YYYY-MM-DD HH:mm:ss.SSS')).to.equal('2026-03-03 09:30:00.000');
    });

    it('does not change the date it is given', () => {
      const day = moment(tuesday).hour(15);

      blockStart(day, [ 9.5, 11.5 ]);

      expect(day.hour()).to.equal(15);
    });

    it('accepts a plain Date', () => {
      const start = moment(blockStart(tuesday.toDate(), [ 11.5, 13 ]));

      expect(start.format('HH:mm')).to.equal('11:30');
    });

    it('lands on 7:30 on every day of the year, daylight saving changes included', () => {
      const day = moment('2026-01-01', 'YYYY-MM-DD');

      for (let i = 0; i < 365; i++) {
        const start = moment(blockStart(day, [ 7.5, 9.5 ]));

        expect(start.format('YYYY-MM-DD HH:mm'), day.format('YYYY-MM-DD')).to.equal(`${day.format('YYYY-MM-DD')} 07:30`);
        day.add(1, 'day');
      }
    });
  });

  describe('blockEnd', () => {
    it('gives the moment the block is over', () => {
      const end = moment(blockEnd(tuesday, [ 11.5, 13 ]));

      expect(end.format('YYYY-MM-DD HH:mm:ss.SSS')).to.equal('2026-03-03 13:00:00.000');
    });

    it('rolls a midnight end over to the start of the next day', () => {
      const end = moment(blockEnd(tuesday, [ 22, 0 ]));

      expect(end.format('YYYY-MM-DD HH:mm')).to.equal('2026-03-04 00:00');
    });
  });

  describe('fractionalHour', () => {
    it('turns 9:30 into 9.5', () => {
      expect(fractionalHour(moment(tuesday).hour(9).minute(30))).to.equal(9.5);
    });

    it('turns 8:00 into 8', () => {
      expect(fractionalHour(moment(tuesday).hour(8))).to.equal(8);
    });

    it('turns midnight into 0', () => {
      expect(fractionalHour(moment(tuesday).startOf('day'))).to.equal(0);
    });

    it('ignores seconds and milliseconds', () => {
      const time = moment(tuesday).hour(9).minute(30).second(59).millisecond(999);

      expect(fractionalHour(time)).to.equal(9.5);
    });
  });

  describe('normalizeBlocks', () => {
    it('sorts blocks by start time', () => {
      expect(normalizeBlocks([ [ 11.5, 13 ], [ 7.5, 9.5 ], [ 9.5, 11.5 ] ]))
        .to.deep.equal([ [ 7.5, 9.5 ], [ 9.5, 11.5 ], [ 11.5, 13 ] ]);
    });

    it('removes duplicate blocks', () => {
      expect(normalizeBlocks([ [ 8, 10 ], [ 10, 12 ], [ 8, 10 ] ]))
        .to.deep.equal([ [ 8, 10 ], [ 10, 12 ] ]);
    });

    it('turns number-like strings into numbers', () => {
      expect(normalizeBlocks([ [ '12', '14' ], [ '7.5', '9.5' ] ]))
        .to.deep.equal([ [ 7.5, 9.5 ], [ 12, 14 ] ]);
    });

    it('treats "8" and 8 as the same block', () => {
      expect(normalizeBlocks([ [ '8', '10' ], [ 8, 10 ] ])).to.deep.equal([ [ 8, 10 ] ]);
    });

    it('drops blocks that are not a pair of numbers', () => {
      expect(normalizeBlocks([ [ 8 ], [], [ 'abc', 10 ], null, undefined, [ 10, 12 ] ]))
        .to.deep.equal([ [ 10, 12 ] ]);
    });

    it('returns an empty list for nothing', () => {
      expect(normalizeBlocks()).to.deep.equal([]);
      expect(normalizeBlocks(null)).to.deep.equal([]);
      expect(normalizeBlocks([])).to.deep.equal([]);
    });

    it('does not change the list it is given', () => {
      const original = [ [ 10, 12 ], [ 8, 10 ] ];

      normalizeBlocks(original);

      expect(original).to.deep.equal([ [ 10, 12 ], [ 8, 10 ] ]);
    });
  });

  describe('findBlockStartingAt', () => {
    const blocks = [ [ 7.5, 9.5 ], [ 9.5, 11.5 ], [ 11.5, 13 ] ];

    it('finds the block that starts at the given time', () => {
      const time = moment(tuesday).hour(9).minute(30);

      expect(findBlockStartingAt(blocks, time)).to.deep.equal([ 9.5, 11.5 ]);
    });

    it('finds nothing for a time in the middle of a block', () => {
      const time = moment(tuesday).hour(9).minute(0);

      expect(findBlockStartingAt(blocks, time)).to.equal(undefined);
    });

    it('finds nothing for the closing time of the last block', () => {
      const time = moment(tuesday).hour(13).minute(0);

      expect(findBlockStartingAt(blocks, time)).to.equal(undefined);
    });

    it('finds nothing when there are no blocks', () => {
      expect(findBlockStartingAt([], moment(tuesday).hour(8))).to.equal(undefined);
    });
  });

  describe('blocksOverlap', () => {
    it('is true for the same block', () => {
      expect(blocksOverlap([ 8, 10 ], [ 8, 10 ])).to.equal(true);
    });

    it('is true when one block starts inside the other', () => {
      expect(blocksOverlap([ 9.5, 11.5 ], [ 10, 12 ])).to.equal(true);
      expect(blocksOverlap([ 10, 12 ], [ 9.5, 11.5 ])).to.equal(true);
    });

    it('is true when one block contains the other', () => {
      expect(blocksOverlap([ 8, 16 ], [ 9.5, 11.5 ])).to.equal(true);
    });

    it('is false for blocks that only touch', () => {
      expect(blocksOverlap([ 7.5, 9.5 ], [ 9.5, 11.5 ])).to.equal(false);
      expect(blocksOverlap([ 9.5, 11.5 ], [ 7.5, 9.5 ])).to.equal(false);
    });

    it('is false for blocks that are apart', () => {
      expect(blocksOverlap([ 8, 10 ], [ 12, 14 ])).to.equal(false);
    });

    it('understands a block that ends at midnight', () => {
      expect(blocksOverlap([ 22, 0 ], [ 23, 24 ])).to.equal(true);
      expect(blocksOverlap([ 22, 0 ], [ 20, 22 ])).to.equal(false);
    });
  });

  describe('formatHour', () => {
    it('formats a half hour', () => {
      expect(formatHour(7.5)).to.equal('7:30am');
    });

    it('formats an afternoon hour', () => {
      expect(formatHour(13)).to.equal('1:00pm');
    });

    it('formats noon', () => {
      expect(formatHour(12)).to.equal('12:00pm');
    });
  });
});
