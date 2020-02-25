const inflect = require('i')();

module.exports = options => {
  if ( !options || !options.model ) {
    throw new Error('Required options not passed');
  }
  var Model = options.model,
      modelName = inflect.underscore(Model.modelName).toLowerCase();

  return function* () {
    console.log(options);

    let id = this.params[modelName],
        q = { _id: id };

    const hasCompanyKey = !!Model.schema.path('company');

    if (hasCompanyKey && options.forceCompanyQueryMerge !== false && this.user && this.user.company) {
      q[options.companyMergeKey || 'company'] = this.user.company;
    }

    let queryPromise = Model.findOne(q);

    if ( options.populate ) {
      queryPromise.populate(options.populate);
    }

    if ( options.select ) {
      queryPromise.select(options.select);
    }

    let record = yield queryPromise.exec();

    if ( !record ) {
      this.status = 404;
      this.body = 'Could not find ' + modelName + ' with id ' + id;
      return;
    }

    this.status = 200;
    this.body = {};
    this.body[inflect.camelize(modelName, false)] = record.toObject({ virtuals: true });
  };
};
