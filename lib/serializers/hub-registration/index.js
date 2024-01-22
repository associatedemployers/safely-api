exports.serialize = function (record) {
  if (record.hubClass) {
    record.hubClass = record.hubClass._id;
  }
  if (record.company){
    record.company = record.company._id;
  }
  if (record.participants){
    let pars = [];
    record.participants.forEach((participant, i) => {
      pars.push(participant._id);
    });
    record.participants = pars;
  }
  if (record.creator){
    record.creator = record.creator._id;
  }

  if (record.participants) {
    record.trainees = record.participants;
  }

  return record;
};

exports.deserialize = function (record) {
  if (record.participants) {
    record.trainees = record.participants;
  }

  return record;
};
