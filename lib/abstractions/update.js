var inflect = require('i')(),
    removeEmptyStrings = require('../util/payload-empty-to-null'),
    friendlyError = require('../../lib/util/mongoose-friendly-error'),
    _ = require('lodash');

_.mixin(require('lodash-deep'));

module.exports = options => {
  if ( !options || !options.model ) {
    throw new Error('Required options not passed');
  }

  var Model = options.model,
      modelName = inflect.camelize(Model.modelName, false);

  return function* () {
    let id      = this.params[inflect.underscore(Model.modelName).toLowerCase()],
        payload = this.request.body[modelName];

    if ( !payload ) {
      this.throw(400, 'Invalid request. Payload not available.');
    }

    if ( !options.allowemptystrings ) {
      payload = removeEmptyStrings(payload);
    }

    for ( let key in payload ) {
      if ( !payload.hasOwnProperty(key) ) {
        continue;
      }

      let pathType = Model.schema.path(key);

      if ( pathType && pathType.instance === 'Array' && payload[key] === '' ) {
        payload[key] = [];
      }
    }

    let q = { _id: id };

    const hasCompanyKey = !!Model.schema.path('company');

    if (hasCompanyKey && options.forceCompanyQueryMerge !== false && this.user && this.user.administrative !== true) {
      q.company = this.user.company;
    }

    let currentRecord = yield Model.findOne(q).exec();

    if ( !currentRecord ) {
      this.status = 404;
      this.body = 'Could not find ' + modelName + ' with id ' + id;
      return;
    }

    if ( options.reservedKeys ) {
      options.reservedKeys.forEach(key => {
        if ( payload[key] ) {
          delete payload[key];
        }
      });
    }

    if ( this.user ) {
      payload.updater = this.user;
      if (this.user.administrative !== true) {
        payload.company = this.user.company ? this.user.company._id : null;
      }
    }

    _.extend(currentRecord, payload);

    if ( options.explicitKeys && _.isArray(options.explicitKeys) ) {
      options.explicitKeys.forEach(key => _.set(currentRecord, key, _.get(payload, key)));
    }

    try {
      yield currentRecord.validate();
    } catch ( validationError ) {
      var errors = friendlyError(validationError);
      this.status = 400;
      this.body = { errors };
      return;
    }

    let savedRecord = yield currentRecord.save();

    this.body = {};
    this.body[modelName] = savedRecord.toObject(options.toObjectOptions);
  };
};
