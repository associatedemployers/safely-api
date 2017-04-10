function middleware (record) {
  let noNotifyMode = process.env.NODE_ENV !== 'production' || process.env.DISABLE_ACTIVATION_NOTIFICATIONS === 'true';

  if (noNotifyMode || !record.wasNew || !record.email || record.activatedOn) {
    return;
  }

  this.notifyActivation();
}

module.exports = {
  hook: 'post',
  event: 'save',
  fn: middleware
};
