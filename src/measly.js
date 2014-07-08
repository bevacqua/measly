'use strict';

var raf = require('raf');
var xhr = require('xhr');
var contra = require('contra');
var cache = require('./cache');
var aggregate = require('./aggregate');
var emitUpstream = require('./emitUpstream');
var methods = ['get', 'post', 'put', 'delete', 'patch'];
var stateEvents = ['create', 'cache', 'request', 'abort', 'error', 'success', 'always'];

function measly (measlyOptions, parent) {
  var context = contra.emitter({
    thinner: thinner,
    parent: parent,
    context: measlyOptions.context,
    children: [],
    requests: [],
    cache: {},
    abort: abort
  });

  methods.forEach(function addMethod (method) {
    context[method] = fire.bind(null, method.toUpperCase());
  });

  function thinner (opt) {
    var child = measly(opt || measlyOptions, context);
    context.children.push(child);
    return child;
  }

  function fire (method, endpoint, opt) {
    var fireOptions = opt || {};
    var url = (fireOptions.base || measlyOptions.base || '') + endpoint;
    var ajaxOptions = {
      url: url,
      method: method,
      json: fireOptions.data,
      headers: { Accept: 'application/json' }
    };
    var req = contra.emitter({
      prevented: false,
      prevent: prevent,
      context: fireOptions.context || measlyOptions.context,
      cache: fireOptions.cache || measlyOptions.cache
    });
    req.abort = abortRequest.bind(null, req);

    emitUpstream(req, context, stateEvents);
    raf(go);

    function go () {
      req.emit('create', req);
      request();
    }

    function prevent (err, body, statusCode) {
      if (req.prevented) {
        return;
      }
      if (req.requested === true) {
        throw new Error('A request has already been made. Prevent synchronously!');
      }
      req.prevented = true;
      raf(prevented);

      function prevented () {
        var xhr = {
          body: body,
          statusCode: statusCode || err ? 500 : 200
        };
        req.emit('cache', err, body);
        done(err, xhr, body);
      }
    }

    function cacheHit () {
      var xhr;
      var entry = cache.find(url, context);
      if (entry) {
        entry.cached = true;
        req.xhr = entry;
        done(entry.error, entry, entry.body);
      }
      return entry;
    }

    function request () {
      if (cacheHit()) {
        return;
      }
      if (req.prevented === false) {
        req.requested = true;
        req.xhr = xhr(ajaxOptions, done);
        req.emit('request', req.xhr);
      }
    }

    function done (err, res, body) {
      req.error = err;
      req.response = body;
      req.done = true;
      if (req.cache && !res.cached) {
        context.cache[url] = {
          expires: cache.expires(req.cache),
          error: err,
          body: body,
          statusCode: res.statusCode
        };
      }
      if (err) {
        req.emit('error', err, body);
        req.emit(err.statusCode, err, body);
      } else {
        req.emit('data', body);
      }
      untrack(req);
    }

    track(req);
    return req;
  }

  function abort () {
    aggregate(context, true).forEach(abortRequest);
  }

  function abortRequest (req) {
    req.prevented = true;
    req.emit('abort', req.xhr);

    if (req.xhr) {
      req.xhr.abort();
    }
    untrack(req);
  }

  function track (req) {
    context.requests.push(req);
  }

  function untrack (req) {
    var i = context.requests.indexOf(req);
    var spliced = context.requests.splice(i, 1);
    if (spliced.length) {
      req.emit('always', req.error, req.response, req);
    }
  }

  return context;
}

module.exports = measly({
  context: global.window
});
