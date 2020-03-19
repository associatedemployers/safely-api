exports.withAvailability = async function (n, HubClass, compiledQuery) {
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
      ...query || {},
      'times.0.start': { $gte: new Date() }
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

  return {
    hubClass
  };
};
