/*
  HubCompany.searchForMember('test@aehr.org');
*/

const mysql = require('mysql2/promise'),
      { debug, error } = require('winston'),
      {
        AE_SQL_USER,
        AE_SQL_PASS,
        AE_SQL_ADDRESS,
        AE_SQL_PORT,
        AE_SQL_DB,
        MSSC_SQL_USER,
        MSSC_SQL_PASS,
        MSSC_SQL_ADDRESS,
        MSSC_SQL_PORT,
        MSSC_SQL_DB
      } = process.env;

const dbs = [{
  tag: 'AE',
  sql: {
    host:     AE_SQL_ADDRESS,
    port:     AE_SQL_PORT || 3306,
    user:     AE_SQL_USER,
    password: AE_SQL_PASS,
    database: AE_SQL_DB || 'ae_wp_db',
    connectTimeout: 3000
  },
  companyTable: 'ae_company',
  userTable: 'ae_user'
}, {
  tag: 'MSSC',
  sql: {
    host:     MSSC_SQL_ADDRESS,
    port:     MSSC_SQL_PORT || 3306,
    user:     MSSC_SQL_USER,
    password: MSSC_SQL_PASS,
    database: MSSC_SQL_DB || 'mssc_wp_db',
    connectTimeout: 3000
  },
  companyTable: 'mssc_company',
  userTable: 'mssc_user'
}];

/**
 * HubCompany#searchForMember
 * @async
 * Searches for member status in member dbs
 * @param {String} emailStr String representing the searching email
 * @returns {Promise} Promise resolving to an Array of statuses
 */
module.exports = async function searchForMember (emailStr) {
  return await Promise.all(dbs.map(async (opt) => {
    const {
      tag,
      sql,
      companyTable,
      userTable
    } = opt;

    debug(`Locating ${tag} member for ${emailStr}...`);

    try {
      var sqlClient = await mysql.createConnection(sql);
    } catch (err) {
      error(`Error connecting to ${tag} db: ${err}`);
      throw new Error(`Unable to connect to ${tag} member database: ${err.message}`);
    }

    try {
      var [ [ companyRecord ] ] = await sqlClient.query(`SELECT company, address, email, address2, city, state, zip, phone FROM ${companyTable} WHERE active=TRUE AND email = ? LIMIT 1`, [ emailStr ]);

      if (!companyRecord) {
        [ [ companyRecord ] ] = await sqlClient.query(`SELECT c.company, c.address, u.email, c.address2, c.city, c.state, c.zip, u.phone FROM ${userTable} u, ${companyTable} c WHERE u.active=TRUE AND u.email = ? AND u.company_id = c.id LIMIT 1`, [ emailStr ]);
      }
    } catch (err) {
      error(`Fetching row for ${tag} db: ${err}`);
      sqlClient.end();
      throw new Error(`Unable to query ${tag} member database: ${err.message}`);
    }

    sqlClient.end();

    return {
      org: tag,
      company: companyRecord,
      isMember: !!companyRecord
    };
  }));
};
