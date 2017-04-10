var inflect    = require('i')(),
    winston    = require('winston'),
    chalk      = require('chalk'),
    _          = require('lodash'),
    parseQuery = require('../../lib/util/parse-query');

module.exports = ( options = {} ) => {
  var _populate = options.populate || '';

  return function* () {
    winston.log('debug', chalk.dim(JSON.stringify(this.request.body)));

    const Model = options.model,
          lowerCaseResource = inflect.camelize(inflect.underscore(Model.modelName).toLowerCase(), false);

    let query      = this.request.body ? parseQuery(this.request.body) : {},
        projection = query._projection,
        _count     = query._count,
        limit      = parseFloat(query.limit) || null,
        page       = parseFloat(query.page)  || 0,
        select     = query.select || '',
        skip       = page * limit,
        sort       = query.sort ? query.sort : options.sort ? options.sort : { created: 1 };

    if ( options.forceCompanyQueryMerge !== false && this.user && this.user.company && !this.user.administrative ) {
      query.company = this.user.company;
    }

    if ( options.query ) {
      query = _.assign(query, options.query);
    }

    if ( query._distinct === true ) {
      this.status = 200;
      this.body = yield Model.distinct(select).exec();
      return;
    }

    if ( query.ids ) {
      query._id = {
        $in: query.ids
      };

      delete query.ids;
    }

    if ( query.q && query.qKey ) {
      query[query.qKey] = {
        $regex: query.q,
        $options: 'i'
      };
    }

    var deleteQueryItems = [ 'limit', 'page', 'sort', 'select', '_count', 'q', 'qKey', '_projection' ];

    deleteQueryItems.forEach(key => delete query[key]);

    for ( var key in query ) {
      if ( query.hasOwnProperty(key) ) {
        var v = query[ key ];

        if ( v === 'exists' ) {
          query[key] = {
            $exists: true
          };
        } else if ( v === 'nexists' ) {
          query[key] = {
            $exists: false
          };
        }
      }
    }

    winston.log('debug', chalk.dim(query, select, limit, page, skip, JSON.stringify(sort)), projection);

    if ( _count === true ) {
      let total = yield Model.count({}).exec(),
          count = yield Model.count(query).exec();

      this.status = 200;
      this.body = { total, count };
      return;
    }

    let records = (yield Model.find(query, projection)
      .sort(sort)
      .skip(Math.abs(skip))
      .limit(Math.abs(limit))
      .select(select)
      .populate(_populate)
      .exec()).map(record => record.toObject({ virtuals: true }));

    let totalRecords = yield Model.count(query).exec(),
        body = {
          meta: { totalRecords }
        };

    body[lowerCaseResource] = records;

    this.status = 200;
    this.body = body;
  };
};
