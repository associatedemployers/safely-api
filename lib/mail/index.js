var winston  = require('winston'),
    chalk    = require('chalk'),
    Promise  = require('bluebird'),
    fs       = require('fs-extra'),
    _        = require('lodash');

var { join }      = require('path'),
    EmailTemplate = require('email-templates').EmailTemplate,
    nodemailer    = require('nodemailer'),
    templatesDir  = join(__dirname, 'templates'),
    partialsDir   = join(__dirname, 'templates/_partials'),
    Handlebars    = require('handlebars');

/**
 * Mailman Constructor
 * @param  {Object} options Mail options
 * @return {Object} Mailman
 */
function Mailman ( options ) {
  var _options = options || {};

  this.sender = {
    from: _options.sender && _options.sender.name && _options.sender.email ? _options.sender.name + ' <' + _options.sender.email + '>' : 'Safety Training Registrations <noreply@mssc.org>'
  };

  this.sender.replyTo = _options.replyTo || this.sender.from;
  this.__templatesDir = _options.templatesDir || templatesDir;
  this.__transportConfig = _options.configuration;
  this.__transport = _options.transport || require(process.env.MAILTRANSPORT || 'nodemailer-sendgrid-transport');
  this.__partials = {};
  this.__templates = {};

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
    let template = fs.readFileSync(join(partialsDir, filename), 'utf8'),
        name     = filename.split('.')[0];

    Handlebars.registerPartial(name, template);
  });

  return this;
}

module.exports = new Mailman();

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

  if ( process.env.ALLOW_EMAILS !== 'true' ) {
    winston.log('Please set env var "allowEmails" to true to send emails.');
    return Promise.resolve();
  }

  winston.log('debug', chalk.dim('Mail :: Rendering content for email with template:', templateName));

  return this.__render(templateName, vars)
  .then(rendered => {
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
 * Mailman __getTemplate
 * @private
 * @param  {String} name Name of template
 * @return {Object} email-templates template class
 */
Mailman.prototype.__getTemplate = function (name) {
  if (this.__templates[name]) {
    return this.__templates[name];
  }


  let template = new EmailTemplate(join(this.__templatesDir, name), {
    partials: this.__partials
  });

  this.__templates[name] = template;
  return template;
};

/**
 * Mailman __render
 * @private
 * @param  {String} templateName Name of template
 * @param  {Object} vars         Template Locals
 * @return {Object}              Containing rendered html & text
 */
Mailman.prototype.__render = function ( templateName, vars ) {
  return this.__getTemplate(templateName).render(vars);
};
