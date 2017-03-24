/*
  Session middleware
*/

var Grant = require('../../models/grant'),
    User = require('../../models/user');

/**
 * Generates a session middleware function
 * @param  {Object} options Options
 * @return {Function}       Generated middleware
 */
module.exports = function ( options = {} ) {
  return function *(next) {
    var header = this.request.get('X-API-Token'),
        token = !header && options.allowFromQuery !== false && this.request.body ? this.request.body.token : header;

    if ( process.env.NODE_ENV === 'test' && this.request.get('X-Test-User') ) {
      this.user = yield User.findById(this.request.get('X-Test-User')).populate('company');
      yield next;
      return;
    }

    if ( !token ) {
      this.status = 401;
      this.body = 'This resource requires the "X-API-Token" header with a granted token';
      return;
    }

    let grant = yield Grant.findOne({ token }).exec();

    if ( !grant || grant.isExpired ) {
      this.status = 401;
      this.body = 'Grant is either expired or non-existent';
      return;
    }

    let user = yield grant.retrieveUser();

    if ( options.administrative && !user.administrative ) {
      this.status = 401;
      this.body = 'This resource requires administrative authorization';
      return;
    }

    this.grant = grant;
    this.user = user;
    yield next;
  };
};
