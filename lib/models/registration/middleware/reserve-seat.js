function middleware ( next ) {

  next();
}

module.exports = {
  hook: 'pre',
  event: 'save',
  fn: middleware
};
