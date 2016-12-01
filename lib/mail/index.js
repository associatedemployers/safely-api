var winston = require('winston').loggers.get('default'),
    chalk   = require('chalk'),
    Promise = require('bluebird'),
    fs      = require('fs-extra'),
    _       = require('lodash');

var path           = require('path'),
    emailTemplates = require('email-templates'),
    nodemailer     = require('nodemailer'),
    templatesDir   = path.resolve(__dirname, 'templates'),
    partialsDir    = path.resolve(__dirname, 'templates/_partials'),
    Handlebars     = require('handlebars');

/**
 * Mailman Constructor
 * @param  {Object} options Mail options
 * @return {Object} Mailman
 */
function Mailman ( options ) {
  var _options = options || {};

  this.sender = {
    from: _options.sender && _options.sender.name && _options.sender.email ? _options.sender.name + ' <' + _options.sender.email + '>' : 'Granite HR <noreply@granitehr.com>'
  };

  this.sender.replyTo = _options.replyTo || this.sender.from;
  this.__templatesDir = _options.templatesDir || templatesDir;
  this.__transportConfig = _options.configuration;
  this.__transport = _options.transport || require(process.env.MAILTRANSPORT || 'nodemailer-sendgrid-transport');
  this.__partials = {};

  if ( process.env.MAILAPIKEY ) {
    if ( !_.isObject(this.__transportConfig) ) {
      this.__transportConfig = {
        auth: {}
      };
    }

    if ( !_.isObject(this.__transportConfig.auth) ) {
      this.__transportConfig.auth = {};
    }

    this.__transportConfig.auth.api_key = process.env.MAILAPIKEY; // eslint-disable-line
  }

  var partials = fs.readdirSync(partialsDir);

  partials.forEach(filename => {
    let template = fs.readFileSync(path.resolve(partialsDir, filename), 'utf8'),
        name     = filename.split('.')[0];

    Handlebars.registerPartial(name, template);
  });

  return this;
}

module.exports = function ( options ) {
  return new Mailman(options);
};

/**
 * Mailman Send
 * @param  {String} templateName Name of template in mail-templates directory
 * @param  {Object} options      Options for mail
 * @return {Promise}             Resolves to Mailer Response
 */
Mailman.prototype.send = function ( templateName, options ) {
  let to      = options.to,
      subject = options.subject,
      vars    = options.data;

  if ( process.env.allowEmails !== 'true' ) {
    winston.log('Please set env var "allowEmails" to true to send emails.');
    return Promise.resolve();
  }

  winston.log('debug', chalk.dim('Mail :: Rendering content for email with template:', templateName));

  return this.__render(templateName, vars).then(rendered => {
    winston.debug(chalk.dim('Mail :: Rendered content. Sending mail...'));
    winston.debug(chalk.dim('Mail :: Using auth', this.__transportConfig ? JSON.stringify(this.__transportConfig.auth) : 'None'));

    var postalService = nodemailer.createTransport(this.__transport(this.__transportConfig));

    postalService.on('log', msg => {
      if ( process.env.debug === true ) {
        winston.debug(msg);
      }
    });

    return postalService.sendMail({
      from: this.sender.from,
      to: to,
      subject: subject,
      html: rendered.html,
      text: rendered.text
    });
  })
  .then(res => {
    winston.debug(chalk.dim('Mail :: Sent mail!'));
    return res;
  });
};

/**
 * Mailman __getTemplates
 * @private
 * @return {Object} email-templates template class
 */
Mailman.prototype.__getTemplates = function () {
  if ( this.__templates ) {
    return Promise.resolve( this.__templates );
  }

  return new Promise(resolve => {
    emailTemplates(this.__templatesDir, {
      partials: this.__partials
    }, (err, templates) => {
      this.__templates = templates;
      resolve(templates);
    });
  });
};

/**
 * Mailman __render
 * @private
 * @param  {String} templateName Name of template
 * @param  {Object} vars         Template Locals
 * @return {Object}              Containing rendered html & text
 */
Mailman.prototype.__render = function ( templateName, vars ) {
  return this.__getTemplates()
  .then(templates => new Promise((resolve, reject) => {
    templates(templateName, vars, (err, html, text) => err ? reject(err) : resolve({ html, text }));
  }));
};
