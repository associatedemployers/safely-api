const keygen = require('keygenerator');

async function fn () {
  if (this.rosterAccessKey) {
    return;
  }

  this.rosterAccessKey = keygen();
}

module.exports = {
  fn,
  hook: 'pre',
  event: 'save'
};
