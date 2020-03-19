const GClient = require('@googlemaps/google-maps-services-js').Client,
      { GOOGLE_MAPS_API_KEY } = process.env;

async function fn () {
  const {
    location: {
      geo,
      address: {
        line1,
        city,
        state
      }
    }
  } = this;

  const addressModified = this.isModified('location.address.line1') || this.isModified('location.address.state') || this.isModified('location.address.city');

  // address isn't modified or no address or geo

  if (((geo || {}).coordinates || []).length && (!addressModified || (!line1 || !city || !state))) {
    return;
  }

  const gmap = new GClient({});

  const response = await gmap.geocode({
    params: {
      address: `${line1}, ${city} ${state}`,
      key: GOOGLE_MAPS_API_KEY
    }
  });

  const result = response.data.results[0];

  if (!result) {
    return;
  }

  this.location.geo = {
    type: 'Point',
    coordinates: [
      result.geometry.location.lat,
      result.geometry.location.lng
    ]
  };
}

module.exports = {
  fn,
  hook: 'pre',
  event: 'save'
};
