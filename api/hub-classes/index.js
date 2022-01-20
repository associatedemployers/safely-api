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

exports.bookedResources = async function (n, HubClass, compiledQuery) {
  const {
    query,
    select,
    sort,
    limit
  } = compiledQuery;
  const moment = require('moment');


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

  let startFrom     = moment().startOf('month').startOf('day'),
      lookbackStart = moment(startFrom).startOf('week').toDate(),
      lookbackEnd   = moment(startFrom).endOf('month').endOf('week').toDate();

  let querys = [
    ...optionalStages,
    {
      '$lookup': {
        'from': 'hubregistrations', 
        'let': {
          'hubClass': '$_id'
        }, 
        'as': 'hubRegistrations', 
        'pipeline': [
          {
            '$match': {
              '$or': [
                {
                  'start': {
                    '$gte': lookbackStart, 
                    '$lte': lookbackEnd
                  }
                }, {
                  'end': {
                    '$gte': lookbackStart, 
                    '$lte': lookbackEnd
                  }
                }
              ], 
              '$expr': {
                '$eq': [
                  '$hubClass', '$$hubClass'
                ]
              }
            }
          }, {
            '$project': {
              'start': '$start', 
              'end': '$end', 
              'participantCount': {
                '$sum': {
                  '$size': '$participants'
                }
              }, 
              'participants': '$participants'
            }
          }
        ]
      }
    }, {
      '$lookup': {
        'from': 'registrations', 
        'let': {
          'hubClass': '$_id'
        }, 
        'as': 'registrations', 
        'pipeline': [
          {
            '$match': {
              '$or': [
                {
                  'start': {
                    '$gte': lookbackStart, 
                    '$lte': lookbackEnd
                  }
                }, {
                  'end': {
                    '$gte': lookbackStart, 
                    '$lte': lookbackEnd
                  }
                }
              ]
            }
          }, {
            '$project': {
              'start': '$start', 
              'end': '$end', 
              'trainee': '$trainee'
            }
          }
        ]
      }
    }, {
      '$unwind': {
        'path': '$registrations', 
        'preserveNullAndEmptyArrays': true
      }
    }, {
      '$unwind': {
        'path': '$hubRegistrations', 
        'preserveNullAndEmptyArrays': true
      }
    }, {
      '$addFields': {
        'tempTimesRegs': [
          {
            '$mergeObjects': [
              {
                '$concatArrays': [
                  {
                    '$filter': {
                      'input': '$times', 
                      'as': 'time', 
                      'cond': {
                        '$eq': [
                          '$$time.start', '$registrations.start'
                        ]
                      }
                    }
                  }, [
                    {
                      'trainee': '$registrations.trainee'
                    }
                  ]
                ]
              }
            ]
          }
        ]
      }
    }, {
      '$addFields': {
        'tempHubTimeRegs': [
          {
            '$mergeObjects': [
              {
                '$concatArrays': [
                  {
                    '$filter': {
                      'input': '$times', 
                      'as': 'time', 
                      'cond': {
                        '$eq': [
                          '$$time.start', '$hubRegistrations.start'
                        ]
                      }
                    }
                  }, [
                    {
                      'hubTrainee': '$hubRegistrations.participants'
                    }
                  ]
                ]
              }
            ]
          }
        ]
      }
    }, {
      '$addFields': {
        'timesWithRegs': {
          '$map': {
            'input': '$times', 
            'as': 'm', 
            'in': {
              '$mergeObjects': [
                '$$m', {
                  'trainee': {
                    '$reduce': {
                      'input': '$tempTimesRegs', 
                      'initialValue': '$$m.start', 
                      'in': {
                        '$cond': [
                          {
                            '$eq': [
                              '$$this._id', '$$m._id'
                            ]
                          }, '$$this.trainee', []
                        ]
                      }
                    }
                  }
                }, {
                  'hubTrainee': {
                    '$reduce': {
                      'input': '$tempHubTimeRegs', 
                      'initialValue': '$$m.start', 
                      'in': {
                        '$cond': [
                          {
                            '$eq': [
                              '$$this._id', '$$m._id'
                            ]
                          }, '$$this.hubTrainee', []
                        ]
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    }, {
      '$group': {
        '_id': '$_id', 
        'dupTimesWithTrainee': {
          '$push': '$timesWithRegs'
        }, 
        'newRoot': {
          '$first': '$$ROOT'
        }
      }
    }, {
      '$unwind': {
        'path': '$dupTimesWithTrainee', 
        'preserveNullAndEmptyArrays': true
      }
    }, {
      '$unwind': {
        'path': '$dupTimesWithTrainee', 
        'preserveNullAndEmptyArrays': true
      }
    }, {
      '$group': {
        '_id': '$dupTimesWithTrainee._id', 
        'trainees': {
          '$push': {
            '$cond': [
              {
                '$gt': [
                  {
                    '$size': '$dupTimesWithTrainee.trainee.length'
                  }, 0
                ]
              }, '$dupTimesWithTrainee.trainee', null
            ]
          }
        }, 
        'hubTrainees': {
          '$push': {
            '$cond': [
              {
                '$gt': [
                  {
                    '$size': '$dupTimesWithTrainee.hubTrainee'
                  }, 0
                ]
              }, '$dupTimesWithTrainee.hubTrainee', null
            ]
          }
        }, 
        'newRoot': {
          '$first': '$$ROOT.newRoot'
        }
      }
    }, {
      '$addFields': {
        'timesWithRegs': {
          '$map': {
            'input': '$newRoot.times', 
            'as': 'm', 
            'in': {
              '$cond': [
                {
                  '$eq': [
                    '$$m._id', '$_id'
                  ]
                }, {
                  '$mergeObjects': [
                    '$$m', {
                      'trainee': {
                        '$reduce': {
                          'input': '$trainees', 
                          'initialValue': '$$m.start', 
                          'in': {
                            '$cond': [
                              {
                                '$gt': [
                                  {
                                    '$size': '$trainees'
                                  }, 0
                                ]
                              }, {
                                '$ifNull': [
                                  {
                                    '$first': '$trainees'
                                  }, []
                                ]
                              }, []
                            ]
                          }
                        }
                      }
                    }, {
                      'hubTrainee': {
                        '$reduce': {
                          'input': '$hubTrainees', 
                          'initialValue': '$$m.start', 
                          'in': {
                            '$cond': [
                              {
                                '$gt': [
                                  {
                                    '$size': '$hubTrainees'
                                  }, 0
                                ]
                              }, {
                                '$ifNull': [
                                  {
                                    '$first': '$hubTrainees'
                                  }, []
                                ]
                              }, []
                            ]
                          }
                        }
                      }
                    }
                  ]
                }, null
              ]
            }
          }
        }
      }
    }, {
      '$group': {
        '_id': '$newRoot._id', 
        'newRoot': {
          '$first': '$$ROOT.newRoot'
        }, 
        'timesWithRegs': {
          '$push': '$timesWithRegs'
        }
      }
    }, {
      '$unwind': {
        'path': '$timesWithRegs', 
        'preserveNullAndEmptyArrays': false
      }
    }, {
      '$unwind': {
        'path': '$timesWithRegs', 
        'preserveNullAndEmptyArrays': false
      }
    }, {
      '$group': {
        '_id': '$timesWithRegs._id', 
        'newRoot': {
          '$first': '$$ROOT.newRoot'
        }, 
        'timesWithRegs': {
          '$first': '$timesWithRegs'
        }
      }
    }, {
      '$group': {
        '_id': '$newRoot._id', 
        'newRoot': {
          '$first': '$$ROOT.newRoot'
        }, 
        'timesWithRegsFinal': {
          '$addToSet': '$timesWithRegs'
        }
      }
    }, {
      '$group': {
        '_id': '$_id', 
        'newHubClass': {
          '$first': '$$ROOT'
        }
      }
    }, {
      '$replaceRoot': {
        'newRoot': {
          '$mergeObjects': [
            '$newHubClass'
          ]
        }
      }
    }, {
      '$addFields': {
        'timesOBJ': {
          'times': '$timesWithRegsFinal'
        }
      }
    }, {
      '$replaceRoot': {
        'newRoot': {
          '$mergeObjects': [
            '$newRoot', '$timesOBJ'
          ]
        }
      }
    }, {
      '$unset': [
        'timesWithRegs', 'tempTimesRegs', 'tempTimes', 'registrations'
      ]
    },{$project}
  ];

  const hubClass = await HubClass.aggregate(querys).exec(); 
  
  return {
    hubClass
  };
};
