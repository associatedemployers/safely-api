module.exports = function(hash, keys) {
  let retHash = {};

  keys.forEach(key => {
    retHash[key] = hash[key];
  });

  return retHash;
};
