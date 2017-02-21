const Promise = require('bluebird'),
      globSync = require('glob').sync;

const models = globSync('../../models/**/index.js', { cwd: __dirname })
  .map(require)
  .filter(Model => !!Model.importFromSql);

const task = function () {
  return Promise.all(models.map(Model => Model.importFromSql()));
};

module.exports = {
  name:      'Task :: SQL Document Recognizer',
  startHook: task,
  autoInit:  true,
  pattern:   '1 * * * * *'
};
