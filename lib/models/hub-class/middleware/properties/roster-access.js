const keygen = require('keygenerator');

async function fn () {
  if (this.rosterAccessKey) {
    return;
  }

  this.rosterAccessKey = keygen._();
}

module.exports = {
  fn,
  hook: 'pre',
  event: 'save'
};
