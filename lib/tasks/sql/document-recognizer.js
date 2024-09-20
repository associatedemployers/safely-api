const Promise = require('bluebird'),
      winston = require('winston'),
      { flatten } = require('lodash'),
      globSync = require('glob').sync;

const models = globSync('../../models/**/index.js', { cwd: __dirname })
  .map(require)
  .filter(Model => !!Model.importFromSql);

const task = function (done) {
  if (process.env.DISABLE_SQL_DISCOVERY === 'true') {
    return done();
  }

  const adapter = require('../../adapters/sql').adapter;

  return Promise.reduce(models, (results, Model) => {
    winston.debug(`Importing ${Model.name}`);
    return Model.importFromSql()
    .then(result =>
      Model.getUpdates()
      .then(r => results.concat(result, r))
    );
  }, [])
  .then(allRelationships => flatten(allRelationships))
  .then(adapter.establishRelationships)
  .then(() => done())
  .catch(err => {
    winston.error('Error syncing documents:', err);
  });
};

module.exports = {
  name:      'Task :: SQL Sync',
  startHook: task,
  autoInit:  true,
  pattern:   '1 * * * * *'
};
