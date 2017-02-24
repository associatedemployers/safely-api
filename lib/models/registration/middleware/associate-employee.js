const co = require('co');

function middleware (doc, next) {
  const Trainee = require('../../trainee');

  co(function*() {
    let registrant = yield Trainee.findById(doc.trainee);

    if ( !registrant || !doc.company ) {
      return;
    }

    if (!registrant.company) {
      registrant.company = [ doc.company ];
    } else {
      registrant.company.addToSet(doc.company);
    }

    yield registrant.save();
  })
  .then(() => next())
  .catch(next);
}

module.exports = {
  hook: 'post',
  event: 'save',
  fn: middleware
};
