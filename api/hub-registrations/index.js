exports.bookedResources = async function (n, HubRegistration, compiledQuery) {
  const Registration  = require('../../lib/models/registration'),
        moment = require('moment'),
        { query } = compiledQuery;
  var ObjectId = require('mongodb').ObjectId; 

  let startFrom     = moment().startOf('month').startOf('day'),
      lookbackStart = moment(startFrom).startOf('week').toDate(),
      lookbackEnd   = moment(startFrom).endOf('month').endOf('week').toDate();
  let traineeIds = query.traineeIds;
  
  const registrations = await Registration.find({
    trainee: { $in: traineeIds.map(x => ObjectId(x))}
  //TODO:// lookback times as well
  }).populate('trainee');

  const hubRegistrations = await HubRegistration.aggregate([{
    $match: {
    //TODO:// lookback times as well
      participants: { $in: traineeIds.map(x => ObjectId(x)) },
      cancelledOn: {$not:{$type:9}}
    } // get me all the hubRegistrations with the participants I want
  }, {
    $unwind: '$participants'
  }, { // unwind, some participants aren't what I want
    $match: {
      participants:  { $in: traineeIds.map(x => ObjectId(x)) }
    } // filter out unwanted participants
  }, {
    $lookup:
      {
        from: 'trainees',
        localField: 'participants',
        foreignField: '_id',
        as: 'participants'
      }
  }, {
    $project: {
      start:1,
      end:1,
      participants:1,
      hubClass: 1
    }
  }]);

  return [
    ...hubRegistrations,
    ...registrations
  ];
};
