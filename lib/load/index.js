/**
 * Module dependencies
 */

const Resource = require('koa-resource-router'),
      mount = require('koa-mount'),
      methodMixins = require('./method-mixins'),
      inflect = require('i')(),
      compose = require('koa-compose'),
      winston = require('./winston')(),
      debug = winston.debug,
      path = require('path'),
      fs = require('fs'),
      globSync = require('glob').sync,
      auth = require('../security/middleware/session'),
      join = path.resolve,
      readdir = fs.readdirSync;

const opTypes = {
  c: 'create',
  r: [ 'show', 'index' ],
  u: 'update',
  d: 'destroy'
};

function getOpsForString ( str ) {
  return str.split('').reduce((ops, letter) => {
    let op = opTypes[letter],
        opPush = typeof op !== 'string' ? op : [ op ];
    opPush.forEach(o => ops.push(o));
    return ops;
  }, []);
}

/**
 * Define routes in `conf`.
 */

function route(app, conf) {
  debug('routes: %s', conf.name);

  var mod = require(conf.directory);

  for ( var key in conf.routes ) {
    if ( !conf.routes.hasOwnProperty(key) ) {
      continue;
    }

    var prop = conf.routes[key];
    var method = key.split(' ')[0];
    var path = key.split(' ')[1];

    var fn = mod[prop],
        secure = conf.secure;

    if ( typeof prop === 'object' ) {
      fn = mod[prop.middleware];

      if ( !secure ) {
        secure = prop.secure;
      }
    }

    if ( !fn ) {
      throw new Error(conf.name + ': exports.' + prop + ' is not defined');
    }

    debug('%s %s -> %s.%s', method, path, conf.name, typeof prop === 'object' ? prop.middleware : prop);

    app[method.toLowerCase()]('/api/v1' + path, secure ? compose([auth(), fn]) : fn);
  }
}

/**
 * Define resource in `conf`.
 */

function resource(app, conf) {
  if ( !conf.name ) {
    throw new Error('.name in ' + conf.directory + '/config.json is required');
  }

  debug('resource: %s', conf.name);

  var mod = require(conf.directory);
  
  if (conf.ops) {
    mod = methodMixins(mod, conf, getOpsForString(conf.ops));
  }

  if (conf.securedOps) {
    getOpsForString(conf.securedOps).forEach(securedOpType => {
      mod[securedOpType] = [ auth(conf.authorizationOptions), mod[securedOpType] ];
    });
  }

  let opts = {
    id: inflect.underscore(inflect.singularize(conf.name))
  };

  let resource = conf.secure ? Resource(conf.name, auth(conf.authorizationOptions), mod, opts) : Resource(conf.name, mod, opts);

  app.use(mount('/api/v1', resource.middleware()));
}

/**
 * Load resources in `root` directory.
 *
 * TODO: move api.json (change name?)
 * bootstrapping into an npm module.
 *
 * TODO: adding .resources to config is lame,
 * but assuming no routes is also lame, change
 * me
 *
 * @param {Application} app
 * @param {String} root
 * @api private
 */

module.exports = function(app, root){
  globSync('../models/**/index.js', { cwd: __dirname }).map(require);

  app.on('error', err => winston.error(err));

  readdir(root).forEach(function(file){
    var dir = join(root, file);
    var stats = fs.lstatSync(dir);
    if (stats.isDirectory()) {
      let conf;

      try {
        conf = require(`${dir}/config.json`);
      } catch (e) {
        try {
          conf = require(`${dir}/config`);
        } catch (err) {
          winston.error('Could not load config for api resource.', err);
        }
      }

      conf.name = conf.useName ? conf.name : file;
      conf.directory = dir;

      if (conf.routes) {
        route(app, conf);
      } else {
        resource(app, conf);
      }
    }
  });
};
