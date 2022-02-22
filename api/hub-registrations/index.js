exports.bookedResources = async function (n, HubRegistration, compiledQuery) {
  const Registration  = require('../../lib/models/registration'),
        moment = require('moment'),
        { query } = compiledQuery;
  var ObjectId = require('mongodb').ObjectId; 

  let startFrom     = moment().startOf('month').startOf('day'),
      lookbackStart = moment(startFrom).startOf('week').toDate(),
      lookbackEnd   = moment(startFrom).endOf('month').endOf('week').toDate();
  let traineeIds = query.traineeIds;

  let $match = { participants: query.traineeIds && !query.getSeats ? { $in: traineeIds.map(x => ObjectId(x)) } : { $exists: true } };
  let participants = {$in: (traineeIds || []).map(x => ObjectId(x))};
  let hubClass = query.getSeats && query.hubClass ? {$in: (query.hubClass || []).map(x => ObjectId(x))} : { $exists: true };
  
  let registrations = [];
  if (!query.getSeats){
    registrations = await Registration.find({
      $or: [{
        trainee: { $in: (traineeIds || []).map(x => ObjectId(x))}
      }, {
        trainee: { $type: 7 }
      }, {
        start: {
          $gte: lookbackStart, 
          $lte: lookbackEnd
        }
      }, {
        end: {
          '$gte': lookbackStart, 
          '$lte': lookbackEnd
        }
      }]
    }).populate('classes').populate('trainee');
  }
  
  const hubRegistrations = await HubRegistration.aggregate([{
    $match: {
      $or:[{
        participants
      }, {
        participants: { $type: 4 }
      }, {
        start: {
          $gte: lookbackStart, 
          $lte: lookbackEnd
        }
      }, {
        end: {
          $gte: lookbackStart, 
          $lte: lookbackEnd
        }
      }],
      cancelledOn: { $not: { $type: 9 } },
      hubClass
    }
  }, {
    $lookup:
      {
        from: 'hubclasses',
        localField: 'hubClass',
        foreignField: '_id',
        as: 'hubClass'
      }
  }, { $addFields: {
    seatsLeft: {$subtract: [{$first:'$hubClass.seats'}, {$size:'$participants'}]}
  }
  }, {
    $unwind: '$participants'
  }, {
    $match //filtering out participants we dont want
  }, {
    $lookup:
      {
        from: 'trainees',
        localField: 'participants',
        foreignField: '_id',
        as: 'participants'
      }
  },
  {$lookup:
    {
      from: 'hubclassinformations',
      localField: 'hubClass.classInformation',
      foreignField: '_id',
      as: 'hubClass'
    }
  },{
    $project: {
      start:1,
      end:1,
      participants:1,
      hubClass: 1,
      seatsLeft: 1
    }
  }]);

  return [
    ...hubRegistrations,
    ...registrations
  ];
};
