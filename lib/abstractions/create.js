var inflect = require('i')(),
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
      payload.company = this.user.company._id;
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

    var savedRecord = yield pendingRecord.save(),
        body = {};

    body[modelName] = savedRecord.toObject(options.toObjectOptions);

    this.status = 201;
    this.body = body;
  };
};
