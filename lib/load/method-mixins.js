var inflect = require('i')(),
    _ = require('lodash');

module.exports = function ( mod, conf, types = [ 'create', 'show', 'index', 'update', 'destroy' ] ) {
  var mixins = {},
      modelName = inflect.camelize(inflect.singularize(conf.name)),
      model = require('../models/' + modelName.toLowerCase());

  // TODO: Compose middleware for session auth if the abstraction is flagged as secured
  // in the mod's config pojo
  types.forEach(type => {
    let options = { model },
        confOpts = conf.crudOptions;

    if ( confOpts && confOpts[type] ) {
      _.assign(options, conf.crudOptions[type]);
    }

    if ( confOpts && confOpts.all ) {
      _.assign(options, confOpts.all);
    }

    mixins[type] = require('../abstractions/' + type)(options);
  });

  return _.assign(mixins, mod);
};
