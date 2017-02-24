const Promise = require('bluebird'),
      winston = require('winston'),
      { flatten } = require('lodash'),
      globSync = require('glob').sync;

const models = globSync('../../models/**/index.js', { cwd: __dirname })
  .map(require)
  .filter(Model => !!Model.importFromSql);

const task = function (done) {
  const adapter = require('../../adapters/sql').adapter;

  return Promise.reduce( models, (results, Model) => {
    return Model.importFromSql()
    .then(result => results.concat(result));
  }, [])
  .then(allRelationships => flatten(allRelationships))
  .then(adapter.establishRelationships)
  .then(() => done())
  .catch(err => {
    winston.error('Error importing new documents:', err);
  });
};

module.exports = {
  name:      'Task :: SQL Document Recognizer',
  startHook: task,
  autoInit:  true,
  pattern:   '1 * * * * *'
};
