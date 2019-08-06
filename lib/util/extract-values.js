module.exports = function(hash, keys) {
  let retHash = {};

  keys.forEach(key => {
    if (hash[key]) {
      retHash[key] = hash[key];
    }
  });

  return retHash;
};
