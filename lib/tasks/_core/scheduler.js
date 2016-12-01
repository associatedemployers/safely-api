/*
  Core Task Scheduler
*/

var winston = require('winston'),
    chalk   = require('chalk'),
    task    = require('cron').CronJob,
    Promise = require('bluebird');

/**
 * Scheduler Constructor
 * @param  {Object} options Scheduler options
 * @return {Object} this
 */
function Scheduler ( options ) {
  this.options = {
    pattern:        options.pattern || '* * * * *',                                      // Default: * * * * *
    runOnInit:      options.runOnInit !== undefined ? options.runOnInit : true,          // Default: true
    preventOverlap: options.preventOverlap !== undefined ? options.preventOverlap : true // Default: true
  };

  this.hooks = {
    _task: options.startHook,
    _stop: options.stopHook
  };

  this.name = options.name || 'Unnamed';

  this._doneBinding = this._done.bind(this);

  if ( !this.hooks._task ) {
    throw new Error({
      message: 'Need task hook to schedule task'
    });
  }

  this._register();

  if ( this.options.defer ) {
    this.stop();
  }

  return this;
}

module.exports = Scheduler;

Scheduler.prototype.constructor = Scheduler;

/**
 * Start Task
 * @return {undefined}
 */
Scheduler.prototype.start = function () {
  if ( this.task ) {
    this.task.start();
  }
};

/**
 * Stop Task
 * @return {undefined}
 */
Scheduler.prototype.stop = function () {
  if ( this.task ) {
    this.task.stop();
  }
};

/**
 * Task Registration
 * @private
 * @return {Object} task
 */
Scheduler.prototype._register = function () {
  var fn = {
    _execute: this._execute.bind( this ),
    _stop:    this._stop.bind( this )
  };

  this.task = new task(
    this.options.pattern,  // Cron Pattern
    fn._execute,           // Execution Hook
    fn._stop,              // Task Stop Hook
    this.options.runOnInit // Run this task immediately?
  );

  return this.task;
};

/**
 * Task Execution Handler - Fired on task execution
 * @private
 * @return {undefined}
 */
Scheduler.prototype._execute = function () {
  winston.log('info', chalk.bgBlue( 'Running scheduled task,', this.name + '.' ));

  if ( this.options.preventOverlap && this.running ) {
    return;
  }

  if ( this.options.preventOverlap ) {
    this.running = true;
  }

  var hook = this.hooks._task;

  if ( hook && typeof hook === 'function' ) {
    var running = hook.call(this, this._doneBinding);

    if ( running instanceof Promise && running.then ) {
      running.then(() => this._doneBinding()).catch(this._doneBinding);
    }
  }
};

/**
 * Task Stop Handler - Fired on task stop
 * @private
 * @return {undefined}
 */
Scheduler.prototype._stop = function () {
  winston.log( 'info', chalk.bgYellow( 'Stopped schedule task,', this.name + '.' ) );

  if ( this.options.preventOverlap ) {
    this.running = false;
  }

  var hook = this.hooks._stop;

  if ( hook && typeof hook === 'function' ) {
    hook.call( this, this._doneBinding );
  }
};

/**
 * Task Done Handler
 * @private
 * @param {Object} err Error
 * @return {object} this
 */
Scheduler.prototype._done = function ( err ) {
  this.running = false;
  if ( err ) {
    this._handleError(err);
  }
  return this;
};

/**
 * Task Error Handler
 * @private
 * @param {Object} err Error
 * @return {undefined}
 */
Scheduler.prototype._handleError = function ( err ) {
  winston.error(chalk.bgRed('Failed to run task:', this.name));
  winston.error(chalk.red(err.stack));
};
