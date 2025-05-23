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
        let startString = `${moment(cur).set('hour', timeBlock.start.hour).set('minute', timeBlock.start.min).format('MM DD YYYY HH:m')}`;
        let endString = `${moment(cur).set('hour', timeBlock.end.hour).set('minute', timeBlock.end.min).format('MM DD YYYY HH:m')}`;
        let participantsInTimeBlock = [];

        let conflictTimes = (registrations || []).filter(registration => {
          const className = ((registration.hubClassInfo || [])[0] || {}).name || ((registration.classes || [])[0] || {}).name;
          const isEssential = (!!className.match(/safety essentials/ig) || {}).length;
          const conflictTimeStart = moment(moment(cur).format('MM DD YYYY'), 'MM DD YYYY').hour(timeBlock.start.hour).minute(timeBlock.start.min);
          
          return conflictTimeStart.isSame(moment(registration.start)) && !isEssential;
        });

        conflictTimes.forEach(conflictTime => {
          let conflictParticipants = conflictTime.trainee ? [ conflictTime.trainee ] : (conflictTime || {}).participants || [];

          participantsInTimeBlock.push(...conflictParticipants);
        });

        if (participantsInTimeBlock.length >= cl.seats) {
          return acc;
        }

        acc.push({
          seatsRemaining: cl.seats - participantsInTimeBlock.length || 0,
          start: moment.utc(startString).format('MM/DD/YYYY, HH:mm A'),
          end:   moment.utc(endString).format('MM/DD/YYYY, HH:mm A'),
          _id:   index
        });
        return acc;
      }, []);
    }
    return nextDates;
  }

  hubClasses = hubClasses.map(hbClass => {
    if (!hbClass.generateTimeRef || !hbClass.generateTimeRef.dayRef) {
      winston.debug('generateTimes and generateTimeRef must be set before calling generatedTimes');
      return hbClass;
    }

    const generatedTimes = getGeneratedTimes(hbClass);
    hbClass.times = generatedTimes;
    return hbClass;
  });
 
  return {
    hubClass: hubClasses
  };
};
