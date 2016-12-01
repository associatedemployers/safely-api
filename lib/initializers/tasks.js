/*
  Initializer - Startup Task Registration
*/

var Scheduler = require('../tasks/_core/scheduler'),
    _         = require('lodash');

var globSync = require('glob').sync,
    tasks    = globSync('../tasks/!(_core)/*.js', { cwd: __dirname }).map(require);

var runningTasks = [];

exports.init = function () {
  if ( !process.env.RUN_TASKS ) {
    return;
  }

  if ( tasks && _.isArray( tasks ) ) {
    tasks.forEach(task => {
      if ( task.autoInit ) {
        runningTasks.push(new Scheduler(task));
      }
    });
  }
};
