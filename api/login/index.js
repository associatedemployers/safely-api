const Grant = require('../../lib/models/grant'),
      UserModel = require('../../lib/models/user');

exports.login = function* () {
  let payload  = this.request.body,
      email    = payload.email,
      password = payload.password;

  if ( !password || !email ) {
    this.status = 400;
    this.body = 'Authentication requires an email and password';
    return;
  }

  let user = yield UserModel.findOne({ email }).exec();

  if ( !user ) {
    this.status = 404;
    this.body = 'User not found';
    return;
  }

  if ( yield user.compareHash(password) ) {
    let grant = yield Grant.grant(user);
    this.status = 200;
    this.body = {
      expires: grant.expires,
      token: grant.token,
      user: user._id.toString(),
      id: grant._id
    };
  } else {
    this.status = 400;
    this.body = 'Password does not match.';
  }
};

exports.refreshGrant = function* () {
  let grantId = this.params.id,
      grant = yield Grant.findById(grantId);

  if ( !grant ) {
    this.status = 404;
    this.body = 'A grant could not be found';
    return;
  }

  // TODO (james): Check session user against grant

  try {
    var freshGrant = yield grant.refresh();
  } catch ( err ) {
    this.status = 400;
    this.body = err.message;
    return;
  }

  this.status = 200;
  this.body = {
    id: freshGrant._id,
    expires: freshGrant.expires
  };
};
