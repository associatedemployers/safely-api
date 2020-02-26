var inflect = require('i')();

/*
  This function hooks up "abstractions" from api/config files
*/
module.exports = function (mod, conf, types = [ 'create', 'show', 'index', 'update', 'destroy' ]) {
  var mixins = {},
      modelName = inflect.camelize(inflect.singularize(conf.name)),
      model = require('../models/' + modelName.toLowerCase());

  types.forEach(type => {
    let options = { model },
        confOpts = conf.crudOptions;

    // read group config
    if (confOpts && confOpts.read && [ 'index', 'show' ].includes(type)) {
      Object.assign(options, confOpts.read);
    }

    // type specific config
    if (confOpts && confOpts[type]) {
      Object.assign(options, conf.crudOptions[type]);
    }

    // all config
    if (confOpts && confOpts.all) {
      Object.assign(options, confOpts.all);
    }

    if (conf.reports) {
      Object.assign(options, {
        reports: conf.reports.reduce((reports, report) => {
          if (report.type === type) {
            reports[report.name] = {
              ...report,
              method: mod[report.name]
            };
          }
          return reports;
        }, {})
      });
    }

    mixins[type] = require('../abstractions/' + type)(options);
  });

  return Object.assign(mixins, mod);
};
