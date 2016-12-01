/*
  grant.retrieveUser()
*/

module.exports = function () {
  let data = this.unlock();
  return this.model(data.type).findById(data.user).populate('company').exec();
};
