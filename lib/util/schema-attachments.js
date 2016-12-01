const globSync = require('glob').sync,
      path = require('path');

/**
 * Loads schema methods statics and middleware from respective folders
 * @param  {Object} schema Mongoose schema
 * @param  {String} cwd    Schema directory
 * @return {Object}        Schema
 */
module.exports = function loadAttachments ( schema, cwd ) {
  globSync('./+(statics|methods)/**/*.js', { cwd })
  .forEach(localPath => {
    let mod = require(path.join(cwd, localPath)),
        methodName = localPath.split('/').pop().split('.').shift(),
        type = localPath.indexOf('/methods/') > -1 ? 'methods' : 'statics';

    schema[type][methodName] = mod;
  });

  globSync('./middleware/**/*.js', { cwd })
  .map(localPath => require(path.join(cwd, localPath)))
  .forEach(m => schema[m.hook](m.event, m.fn));

  return schema;
};
