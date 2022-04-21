exports.bookedResources = async function (n, HubRegistration, compiledQuery) {
  const Registration  = require('../../lib/models/registration'),
        moment = require('moment'),
        { query } = compiledQuery;
  var ObjectId = require('mongodb').ObjectId; 

  let startFrom     = query.startFrom ? moment(query.startFrom).toDate() : moment().startOf('month').startOf('day'),
      lookbackStart = query.lookbackStart ? moment(query.lookbackStart).toDate() : moment(startFrom).startOf('week').toDate(),
      lookbackEnd   = query.lookbackEnd ? moment(query.lookbackEnd).toDate() : moment(startFrom).add(6,'months').endOf('month').endOf('week').toDate();
  let traineeIds = query.traineeIds;

  let $match = { participants: query.traineeIds && !query.getSeats ? { $in: traineeIds.map(x => ObjectId(x)) } : { $exists: true } };
  let participants = {$in: (traineeIds || []).map(x => ObjectId(x))};
  let hubClass = query.getSeats && query.hubClass ? {$in: (query.hubClass || []).map(x => ObjectId(x))} : { $exists: true };

  let registrations = [];
  if (!query.getSeats){
    registrations = await Registration.find({
      $or: [{
        trainee: { $in: (traineeIds || []).map(x => ObjectId(x)) }
      }, {
        trainee: { $type: 7 }
      }],
      start: {
        $gte: lookbackStart, 
        $lte: lookbackEnd
      },
      end: {
        $gte: lookbackStart, 
        $lte: lookbackEnd
      }
    }).populate('classes').populate('trainee');
  }

  let cancelledOn = query.showCancellations ? { $type: 9 } :  { $not: { $type: 9 } };
  const hubRegistrations = await HubRegistration.aggregate([ {
    $match: {
      $or:[ {
        participants
      }, {
        participants: { $type: 4 }
      }],
      start: {
        $gte: lookbackStart, 
        $lte: lookbackEnd
      },
      end: {
        $gte: lookbackStart, 
        $lte: lookbackEnd
      },
      cancelledOn,
      hubClass
    }
  }, {
    $lookup:
      {
        from:         'hubclasses',
        localField:   'hubClass',
        foreignField: '_id',
        as:           'hubClass'
      }
  },  {
    $unwind: '$participants'
  }, {
    $match //filtering out participants we dont want
  }, { 
    $group:
    {
      _id: {start:'$start',classId:{$first:'$hubClass._id'}},
      registrationIds:{$push:'$_id'},
      participants:{$push:'$participants'},
      firstName:{$first:'$firstName'},
      lastName:{$first:'$lastName'},
      companyName:{$first:'$companyName'},
      cancelledOn:{$first:'$cancelledOn'},
      hubClass:{$first:'$hubClass'},
      start:{$first:'$start'},
      end:{$first:'$end'},
      address:{$first:'$address'},
      total:{$sum: '$total'},
      isClassMember:{$first:'$isClassMember'},
      po:{$push: {$ifNull:[null,'$po']}}
    }},{
    $addFields: {
      seatsLeft: { $subtract: [{ $first:'$hubClass.seats' }, { $size:'$participants' }] }
    } 
  },  {
    $unwind: '$participants'
  }, {
    $lookup:
      {
        from:         'trainees',
        localField:   'participants',
        foreignField: '_id',
        as:           'participants'
      }
  },
  { $lookup:
    {
      from:         'hubclassinformations',
      localField:   'hubClass.classInformation',
      foreignField: '_id',
      as:           'hubClassInfo'
    }
  },{
    $project: {
      hubClassInfo: 1,
      start:        1,
      end:          1,
      participants: 1,
      hubClass:     1,
      seatsLeft:    1,
      address:      1,
      companyName:  1,
      firstName:    1,
      lastName:     1,
      email:        1,
      po:           1,
      total:        1,
      created:      1,
      cancelledOn:  1
    }
  } ]);

  return [
    ...hubRegistrations,
    ...registrations
  ];
};
