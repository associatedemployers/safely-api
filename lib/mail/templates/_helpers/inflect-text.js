const {
  singularize, pluralize
} = require('i')();

module.exports = (text, length) =>
  length && length === 1 ? singularize(text) : pluralize(text);

/*
  Usage
  ---
  You have {{employees.length}} {{inflect-text 'Employee' employees.length}}!
    -> Given employees.length is 0 or >1
    "You have 0 Employees!"
    -> Given employees.length is 1
    "You have 1 Employee!"

  Note: Preserves case
 */
