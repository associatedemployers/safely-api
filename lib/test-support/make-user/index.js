const User = require('../../models/user');

module.exports = () => {
  // let company = new Company({
  //   name: 'Mocha Company',
  //   email: 'lattesonus@aehr.org',
  //   contact: {
  //     name: {
  //       first: 'Test',
  //       last: 'Person'
  //     }
  //   }
  // });
  //
  // return company.save()
  // .then(companyRecord => {
    let user = new User({
      email: 'test@aehr.org',
      password: '1234',
      name: {
        first: 'Morgan',
        last: 'Freeman'
      }//,

      // company: companyRecord
    });

    return user.save();
  // });
};
