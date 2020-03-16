function middleware (next) {
  this.wasNew = this.isNew;
  next();
}

module.exports = {
  hook: 'pre',
  event: 'save',
  fn: middleware
};
