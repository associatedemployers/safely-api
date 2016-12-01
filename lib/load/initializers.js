/*
  Initializer Loader
*/

const winston = require('winston'),
      chalk   = require('chalk'),
      _       = require('lodash');

const globSync     = require('glob').sync,
      initializers = globSync('../initializers/**/*.js', { cwd: __dirname }).map(require);

exports.load = function () {
  require('./mongoose')();
  globSync('../models/**/index.js', { cwd: __dirname }).map(require);

  winston.debug('info', chalk.dim('Initializer :: Init'));

  if( initializers && _.isArray( initializers ) ) {
    winston.debug('info', chalk.dim('Initializer :: Loading server initializers...'));
    initializers.forEach(function ( initializer, index ) {
      winston.debug('info', chalk.dim('Initializer :: Loading initializer', index + 1, 'of', initializers.length));
      initializer.init();
    });
  }
};
