exports.withAvailability = async function (n, HubClass, compiledQuery) {
  const moment = require('moment');
  const { recur } = require('moment-recur');
  const winston = require('winston');

  const {
    query,
    select,
    sort,
    limit
  } = compiledQuery;

  let $project = {
    registrations: 0,
    rosterAccessKey: 0
  };

  if (select && select.length) {
    $project = select.split(' ').reduce((projectionObj, selectKey) => ({
      ...projectionObj,
      [selectKey.replace('-', '')]: selectKey.charAt(0) === '-' ? 0 : 1
    }), { ...$project });
  }

  let optionalStages = [];

  if (sort) {
    optionalStages.push({
      $sort: {
        ...sort || {}
      }
    });
  }

  if (limit) {
    optionalStages.push({
      $limit: limit
    });
  }

  const hubClass = await HubClass.aggregate([{
    $match: {
      ...query || {'times.0.start': { $gte: new Date() } }
    }
  },
  ...optionalStages,
  {
    $lookup: {
      from: 'hubregistrations',
      let: { hubClass: '$_id' },
      as: 'registrations',
      pipeline: [{
        $match: {
          $expr: { $eq: [ '$hubClass', '$$hubClass' ] }
        }
      }, {
        $project: {
          participantCount: { $sum: { $size: '$participants' } }
        }
      }, {
        $group: {
          _id: null,
          totalParticipants: { $sum: '$participantCount' }
        }
      }]
    }
  }, {
    $replaceRoot: {
      newRoot: {
        $mergeObjects: [{ $arrayElemAt: [ '$registrations', 0 ] }, '$$ROOT' ]
      }
    }
  }, {
    $addFields: {
      seatsRemaining: { $cond: [ '$totalParticipants', { $subtract: [ '$seats', '$totalParticipants' ] }, '$seats' ] }
    }
  }, {
    $project
  }]);

  function getGeneratedTimes (cl) {
    const REPEATER = 8;

    if (!((cl || {}).generateTimeRef || {}).dayRef) {
      winston.debug('generateTimes and generateTimeRef must be set before calling generatedTimes');
      return [];
    }

    let nextDates = [];
    let { dayRef, timeBlock } = cl.generateTimeRef;
    if (dayRef) {
      let today = moment().startOf('day');
      let ref = recur(today).every(dayRef).daysOfWeek();

      // Front-End Registrations Code Example
      // Do not create a timeblock if there hub-class is full
      nextDates = ref.next(REPEATER).reduce((acc, cur, index) => {
        let startString = `${moment(cur).format('MM DD YYYY')} ${timeBlock.start.hour}:${timeBlock.start.min}`;
        let endString = `${moment(cur).format('MM DD YYYY')} ${timeBlock.end.hour}:${timeBlock.end.min}`;

        acc.push({
          start: new Date(startString).toLocaleString('en', { timeZone: 'America/Denver' }),
          end:   new Date(endString).toLocaleString('en', { timeZone: 'America/Denver' }),
          _id:   index
        });
        return acc;
      }, []);
    }
    return nextDates;
  }

  const hubClasses = hubClass.map(hbClass => {
    hbClass.times.push(...getGeneratedTimes(hbClass));
    return hbClass;
  });
 
  return {
    hubClass: hubClasses
  };
};
