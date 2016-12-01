var inflect = require('i')();

module.exports = options => {
  if ( !options || !options.model ) {
    throw new Error('Required options not passed');
  }

  var Model = options.model,
      modelName = inflect.camelize(Model.modelName, false);

  return function* () {
    let id = this.params[inflect.underscore(Model.modelName).toLowerCase()];

    let q = { _id: id };

    if ( options.forceCompanyQueryMerge !== false && this.user ) {
      q.company = this.user.company;
    }

    let record = yield Model.findOne(q).exec();

    if ( !record ) {
      this.status = 404;
      this.body = 'Could not find ' + modelName + ' with id ' + id;
      return;
    }

    yield record.remove();
    this.status = 204;
  };
};
