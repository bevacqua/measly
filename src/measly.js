'use strict';

var _find = require('lodash.find');
var raf = require('raf');
var xhr = require('xhr');
var contra = require('contra');
var cache = require('./cache');
var aggregate = require('./aggregate');
var emitUpstream = require('./emitUpstream');
var methods = ['get', 'post', 'put', 'delete', 'patch'];
var stateEvents = ['create', 'cache', 'request', 'abort', 'error', 'data', 'always'];
var core;

function measly (measlyOptions, parent) {
  var layer = find(measlyOptions.context, true);
  if (layer) {
    return layer;
  }

  layer = contra.emitter({
    layer: thinner,
    parent: parent,
    context: measlyOptions.context,
    children: [],
    requests: [],
    cache: {},
    abort: abort,
    request: request
  }, { throws: false });

  methods.forEach(function addMethod (method) {
    layer[method] = fire.bind(null, method);
  });

  function request (url, opt) {
    var method = opt.method;
    if (opt && opt.xhr && opt.xhr.method) {
      method = opt.xhr.method;
    }
    if (!method) {
      throw new Error('A request method must be specified.');
    }
    return fire(method, url, opt);
  }

  function thinner (opt) {
    var child = measly(opt || measlyOptions, layer);
    layer.children.push(child);
    return child;
  }

  function fire (method, url, opt) {
    var fireOptions = opt || {};
    fireOptions.url = url;
    fireOptions.method = method.toUpperCase();

    var req = contra.emitter({
      done: false,
      requested: false,
      prevented: false,
      prevent: prevent,
      layer: layer,
      context: fireOptions.context || measlyOptions.context,
      cache: fireOptions.cache || measlyOptions.cache,
      url: url,
      method: method
    }, { throws: false });
    req.abort = abortRequest.bind(null, req);

    emitUpstream(req, layer, stateEvents);
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
      var entry = cache.find(url, layer);
      if (entry) {
        entry.cached = true;
        req.xhr = entry;
        req.prevented = true;
        req.emit('cache', entry.error, entry.body);
        done(entry.error, entry, entry.body);
      }
    }

    function request () {
      if (method === 'GET') {
        cacheHit();
      }
      if (req.prevented) {
        return;
      }
      req.requested = true;
      req.xhr = xhr(fireOptions, done);
      req.emit('request', req.xhr);
    }

    function done (err, res, body) {
      req.error = err;
      req.response = body;
      req.done = true;
      if (req.cache && !res.cached) {
        layer.cache[url] = {
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
    aggregate.requests(layer, true).forEach(abortRequest);
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
    layer.requests.push(req);
  }

  function untrack (req) {
    var i = layer.requests.indexOf(req);
    var spliced = layer.requests.splice(i, 1);
    if (spliced.length) {
      req.emit('always', req.error, req.response, req);
    }
  }

  return layer;
}

function find (context, shallow) {
  if (core === void 0) {
    return;
  }
  var layers = aggregate.contexts(core);
  while (context && !shallow) {
    var needle = _find(layers, { context: context });
    if (needle) {
      return needle.layer;
    }
    context = context.parentNode;
    shallow = true;
  }
}

module.exports = core = measly({
  context: global.document.body,
  base: ''
});

core.find = find;
