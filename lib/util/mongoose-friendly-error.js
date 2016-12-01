module.exports = function ( err ) {
  let errors = [];

  for ( var field in err.errors ) {
    if ( !err.errors.hasOwnProperty(field) ) {
      continue;
    }

    errors.push({
      status: 400,
      title: 'Validation Error',
      detail: err.errors[field].message
    });
  }

  return errors;
};
