exports.assortment = async function (n, HubBanner, compiledQuery) {
  return {
    hubBanner: await HubBanner.aggregate([{
      $sample: {
        size: compiledQuery.nDocuments || 10
      }
    }])
  };
};
