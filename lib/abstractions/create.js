const inflect = require('i')(),
      winston = require('winston'),
      removeEmptyStrings = require('../util/payload-empty-to-null'),
      friendlyError = require('../../lib/util/mongoose-friendly-error');

module.exports = options => {
  if ( !options || !options.model ) {
    throw new Error('Required options not passed');
  }

  var Model = options.model,
      modelName = inflect.camelize(Model.modelName, false);

  return function* () {
    var payload = this.request.body[modelName] || this.request.body;

    this.modelName = modelName;

    if ( !payload ) {
      this.throw(400, 'Invalid request. Payload not available.');
    }

    if ( !options.allowEmptyStrings ) {
      payload = removeEmptyStrings(payload);
    }

    if ( this.user ) {
      payload.creator = this.user;
    }

    const hasCompanyKey = !!Model.schema.path('company');

    if (hasCompanyKey && options.forceCompanyQueryMerge !== false && this.user && this.user.company) {
      payload.company = this.user.company;
    }

    var data = payload,
        pendingRecord = new Model(data);

    try {
      yield pendingRecord.validate();
    } catch ( validationError ) {
      var errors = friendlyError(validationError);
      this.status = 400;
      this.body = { errors };
      return;
    }

    let savedRecord;

    try {
      savedRecord = yield pendingRecord.save();
    } catch (e) {
      if (e.message && e.message.indexOf('dup key') > -1) {
        this.status = 400;
        this.body = { errors: [{ status: 400, message: `Duplicate key: ${/index: ([a-z])*/i.exec(e.message)[1]}` }] };
        return;
      }

      if (e.status) {
        this.status = e.status;
        this.body = {
          errors: [{ status: e.status, message: e.message }]
        };
      }

      winston.error('Error occurred in mongo write:', e);
      this.status = 500;
      return;
    }

    let body = {};
    body[modelName] = savedRecord.toObject(options.toObjectOptions);

    this.status = 201;
    this.body = body;
  };
};
