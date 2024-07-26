exports.withAvailability = async function (n, HubClass, compiledQuery) {
  const moment = require('moment');
  const { recur } = require('moment-recur');
  const winston = require('winston');
  const HubRegistration = require('../../lib/models/hub-registration');
  const { bookedResources } = require('../hub-registrations');

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

  let hubClasses = await HubClass.aggregate([{
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
  const hubClassIds = hubClasses.map(({ _id }) => _id );  
  const registrations = await bookedResources(undefined, HubRegistration, { query: { hubClass: { $in: hubClassIds } } });

  function getGeneratedTimes (cl) {
    const REPEATER = 8;

    let nextDates = [];
    let { dayRef, timeBlock } = cl.generateTimeRef;
    if (dayRef) {
      let today = moment().startOf('day');
      let ref = recur(today).every(dayRef).daysOfWeek();

      nextDates = ref.next(REPEATER).reduce((acc, cur, index) => {
        let startString = `${moment(cur).format('MM DD YYYY')} ${timeBlock.start.hour}:${timeBlock.start.min}`;
        let endString = `${moment(cur).format('MM DD YYYY')} ${timeBlock.end.hour}:${timeBlock.end.min}`;

        let conflictTimes = (registrations || []).filter(registration => {
          const classname = ((registration.hubClassInfo || [])[0] || {}).name || ((registration.classes || [])[0] || {}).name;
          const isEssential = (!!classname.match(/safety essentials/ig) || {}).length;
          const conflictTimeStart = moment(moment(cur).format('MM DD YYYY'), 'MM DD YYYY').hour(timeBlock.start.hour).minute(timeBlock.start.min);
          
          return conflictTimeStart.isSame(moment(registration.start)) && !isEssential;
        });

        const participantCountForTimeblock = conflictTimes.reduce((acc, { participants, trainee }) => {
          let calc = trainee ? trainee.length : (participants || {}).length || 0;
          let updatedCount = calc + acc;
          return updatedCount;
        }, 0);

        if (participantCountForTimeblock >= cl.seats) {
          acc.push({});
          return acc;
        }

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

  hubClasses = hubClasses.map(hbClass => {
    if (!((hbClass || {}).generateTimeRef || {}).dayRef) {
      winston.debug('generateTimes and generateTimeRef must be set before calling generatedTimes');
      return hbClass;
    }

    hbClass.times.push(...getGeneratedTimes(hbClass));
    return hbClass;
  });
 
  return {
    hubClass: hubClasses
  };
};
