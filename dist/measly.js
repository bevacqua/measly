/**
 * measly - A measly wrapper around XHR to help you contain your requests
 * @version v1.3.8
 * @link https://github.com/bevacqua/measly
 * @license MIT
 */
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.measly=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
'use strict';

var raf = require('raf');
var xhr = require('xhr');
var emitter = require('contra/emitter');
var cache = require('./cache');
var aggregate = require('./aggregate');
var emitCascade = require('./emitCascade');
var methods = ['get', 'post', 'put', 'delete', 'patch'];
var core;
var all = [];

function measly (measlyOptions, parent) {
  var layer = find(measlyOptions.context, true);
  if (layer) {
    return layer;
  }

  layer = emitter({
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

  all.push(layer);

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
    var existing = find(opt.context || measlyOptions.context, true);
    if (existing) {
      return existing;
    }
    var child = measly(opt || measlyOptions, layer);
    layer.children.push(child);
    return child;
  }

  function fire (method, url, opt) {
    var fireOptions = opt || {};
    fireOptions.json = 'json' in fireOptions ? fireOptions.json : {};
    fireOptions.url = url;
    fireOptions.method = method.toUpperCase();

    var req = emitter({
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

    raf(go);

    function go () {
      emitCascade(req, 'create', req);
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
        emitCascade(req, 'cache', err, body);
        done(err, xhr, body);
      }
    }

    function cacheHit () {
      var entry = cache.find(url, layer);
      if (entry) {
        entry.cached = true;
        req.xhr = entry;
        req.prevented = true;
        emitCascade(req, 'cache', entry.error, entry.body);
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
      emitCascade(req, 'request', req.xhr);
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
        emitCascade(req, 'error', err, body);
        emitCascade(req, err.statusCode, err, body);
      } else {
        emitCascade(req, 'data', body);
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
    req.aborted = true;
    req.prevented = true;
    emitCascade(req, 'abort', req.xhr);

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
      emitCascade(req, 'always', req.error, req.response, req);
    }
  }

  return layer;
}

function find (context, shallow) {
  if (core === void 0) {
    return;
  }
  var depleted;
  var layers = aggregate.contexts(core);
  while (context && !depleted) {
    var needle = sameContext(layers);
    if (needle) {
      return needle.layer;
    }
    context = context.parentNode;
    depleted = shallow === true;
  }
  function sameContext (layers) {
    var i;
    var len = layers.length;
    for (i = 0; i < len; i++) {
      var layer = layers[i];
      if (layer.context === context) {
        return layer;
      }
    }
  }
}

module.exports = core = measly({
  context: global.document.body,
  base: ''
});

core.find = find;
core.all = all;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9tZWFzbHkuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciByYWYgPSByZXF1aXJlKCdyYWYnKTtcbnZhciB4aHIgPSByZXF1aXJlKCd4aHInKTtcbnZhciBlbWl0dGVyID0gcmVxdWlyZSgnY29udHJhL2VtaXR0ZXInKTtcbnZhciBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcbnZhciBhZ2dyZWdhdGUgPSByZXF1aXJlKCcuL2FnZ3JlZ2F0ZScpO1xudmFyIGVtaXRDYXNjYWRlID0gcmVxdWlyZSgnLi9lbWl0Q2FzY2FkZScpO1xudmFyIG1ldGhvZHMgPSBbJ2dldCcsICdwb3N0JywgJ3B1dCcsICdkZWxldGUnLCAncGF0Y2gnXTtcbnZhciBjb3JlO1xudmFyIGFsbCA9IFtdO1xuXG5mdW5jdGlvbiBtZWFzbHkgKG1lYXNseU9wdGlvbnMsIHBhcmVudCkge1xuICB2YXIgbGF5ZXIgPSBmaW5kKG1lYXNseU9wdGlvbnMuY29udGV4dCwgdHJ1ZSk7XG4gIGlmIChsYXllcikge1xuICAgIHJldHVybiBsYXllcjtcbiAgfVxuXG4gIGxheWVyID0gZW1pdHRlcih7XG4gICAgbGF5ZXI6IHRoaW5uZXIsXG4gICAgcGFyZW50OiBwYXJlbnQsXG4gICAgY29udGV4dDogbWVhc2x5T3B0aW9ucy5jb250ZXh0LFxuICAgIGNoaWxkcmVuOiBbXSxcbiAgICByZXF1ZXN0czogW10sXG4gICAgY2FjaGU6IHt9LFxuICAgIGFib3J0OiBhYm9ydCxcbiAgICByZXF1ZXN0OiByZXF1ZXN0XG4gIH0sIHsgdGhyb3dzOiBmYWxzZSB9KTtcblxuICBtZXRob2RzLmZvckVhY2goZnVuY3Rpb24gYWRkTWV0aG9kIChtZXRob2QpIHtcbiAgICBsYXllclttZXRob2RdID0gZmlyZS5iaW5kKG51bGwsIG1ldGhvZCk7XG4gIH0pO1xuXG4gIGFsbC5wdXNoKGxheWVyKTtcblxuICBmdW5jdGlvbiByZXF1ZXN0ICh1cmwsIG9wdCkge1xuICAgIHZhciBtZXRob2QgPSBvcHQubWV0aG9kO1xuICAgIGlmIChvcHQgJiYgb3B0LnhociAmJiBvcHQueGhyLm1ldGhvZCkge1xuICAgICAgbWV0aG9kID0gb3B0Lnhoci5tZXRob2Q7XG4gICAgfVxuICAgIGlmICghbWV0aG9kKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0EgcmVxdWVzdCBtZXRob2QgbXVzdCBiZSBzcGVjaWZpZWQuJyk7XG4gICAgfVxuICAgIHJldHVybiBmaXJlKG1ldGhvZCwgdXJsLCBvcHQpO1xuICB9XG5cbiAgZnVuY3Rpb24gdGhpbm5lciAob3B0KSB7XG4gICAgdmFyIGV4aXN0aW5nID0gZmluZChvcHQuY29udGV4dCB8fCBtZWFzbHlPcHRpb25zLmNvbnRleHQsIHRydWUpO1xuICAgIGlmIChleGlzdGluZykge1xuICAgICAgcmV0dXJuIGV4aXN0aW5nO1xuICAgIH1cbiAgICB2YXIgY2hpbGQgPSBtZWFzbHkob3B0IHx8IG1lYXNseU9wdGlvbnMsIGxheWVyKTtcbiAgICBsYXllci5jaGlsZHJlbi5wdXNoKGNoaWxkKTtcbiAgICByZXR1cm4gY2hpbGQ7XG4gIH1cblxuICBmdW5jdGlvbiBmaXJlIChtZXRob2QsIHVybCwgb3B0KSB7XG4gICAgdmFyIGZpcmVPcHRpb25zID0gb3B0IHx8IHt9O1xuICAgIGZpcmVPcHRpb25zLmpzb24gPSAnanNvbicgaW4gZmlyZU9wdGlvbnMgPyBmaXJlT3B0aW9ucy5qc29uIDoge307XG4gICAgZmlyZU9wdGlvbnMudXJsID0gdXJsO1xuICAgIGZpcmVPcHRpb25zLm1ldGhvZCA9IG1ldGhvZC50b1VwcGVyQ2FzZSgpO1xuXG4gICAgdmFyIHJlcSA9IGVtaXR0ZXIoe1xuICAgICAgZG9uZTogZmFsc2UsXG4gICAgICByZXF1ZXN0ZWQ6IGZhbHNlLFxuICAgICAgcHJldmVudGVkOiBmYWxzZSxcbiAgICAgIHByZXZlbnQ6IHByZXZlbnQsXG4gICAgICBsYXllcjogbGF5ZXIsXG4gICAgICBjb250ZXh0OiBmaXJlT3B0aW9ucy5jb250ZXh0IHx8IG1lYXNseU9wdGlvbnMuY29udGV4dCxcbiAgICAgIGNhY2hlOiBmaXJlT3B0aW9ucy5jYWNoZSB8fCBtZWFzbHlPcHRpb25zLmNhY2hlLFxuICAgICAgdXJsOiB1cmwsXG4gICAgICBtZXRob2Q6IG1ldGhvZFxuICAgIH0sIHsgdGhyb3dzOiBmYWxzZSB9KTtcbiAgICByZXEuYWJvcnQgPSBhYm9ydFJlcXVlc3QuYmluZChudWxsLCByZXEpO1xuXG4gICAgcmFmKGdvKTtcblxuICAgIGZ1bmN0aW9uIGdvICgpIHtcbiAgICAgIGVtaXRDYXNjYWRlKHJlcSwgJ2NyZWF0ZScsIHJlcSk7XG4gICAgICByZXF1ZXN0KCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcHJldmVudCAoZXJyLCBib2R5LCBzdGF0dXNDb2RlKSB7XG4gICAgICBpZiAocmVxLnByZXZlbnRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAocmVxLnJlcXVlc3RlZCA9PT0gdHJ1ZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0EgcmVxdWVzdCBoYXMgYWxyZWFkeSBiZWVuIG1hZGUuIFByZXZlbnQgc3luY2hyb25vdXNseSEnKTtcbiAgICAgIH1cbiAgICAgIHJlcS5wcmV2ZW50ZWQgPSB0cnVlO1xuICAgICAgcmFmKHByZXZlbnRlZCk7XG5cbiAgICAgIGZ1bmN0aW9uIHByZXZlbnRlZCAoKSB7XG4gICAgICAgIHZhciB4aHIgPSB7XG4gICAgICAgICAgYm9keTogYm9keSxcbiAgICAgICAgICBzdGF0dXNDb2RlOiBzdGF0dXNDb2RlIHx8IGVyciA/IDUwMCA6IDIwMFxuICAgICAgICB9O1xuICAgICAgICBlbWl0Q2FzY2FkZShyZXEsICdjYWNoZScsIGVyciwgYm9keSk7XG4gICAgICAgIGRvbmUoZXJyLCB4aHIsIGJvZHkpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNhY2hlSGl0ICgpIHtcbiAgICAgIHZhciBlbnRyeSA9IGNhY2hlLmZpbmQodXJsLCBsYXllcik7XG4gICAgICBpZiAoZW50cnkpIHtcbiAgICAgICAgZW50cnkuY2FjaGVkID0gdHJ1ZTtcbiAgICAgICAgcmVxLnhociA9IGVudHJ5O1xuICAgICAgICByZXEucHJldmVudGVkID0gdHJ1ZTtcbiAgICAgICAgZW1pdENhc2NhZGUocmVxLCAnY2FjaGUnLCBlbnRyeS5lcnJvciwgZW50cnkuYm9keSk7XG4gICAgICAgIGRvbmUoZW50cnkuZXJyb3IsIGVudHJ5LCBlbnRyeS5ib2R5KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXF1ZXN0ICgpIHtcbiAgICAgIGlmIChtZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICAgIGNhY2hlSGl0KCk7XG4gICAgICB9XG4gICAgICBpZiAocmVxLnByZXZlbnRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByZXEucmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgIHJlcS54aHIgPSB4aHIoZmlyZU9wdGlvbnMsIGRvbmUpO1xuICAgICAgZW1pdENhc2NhZGUocmVxLCAncmVxdWVzdCcsIHJlcS54aHIpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRvbmUgKGVyciwgcmVzLCBib2R5KSB7XG4gICAgICByZXEuZXJyb3IgPSBlcnI7XG4gICAgICByZXEucmVzcG9uc2UgPSBib2R5O1xuICAgICAgcmVxLmRvbmUgPSB0cnVlO1xuICAgICAgaWYgKHJlcS5jYWNoZSAmJiAhcmVzLmNhY2hlZCkge1xuICAgICAgICBsYXllci5jYWNoZVt1cmxdID0ge1xuICAgICAgICAgIGV4cGlyZXM6IGNhY2hlLmV4cGlyZXMocmVxLmNhY2hlKSxcbiAgICAgICAgICBlcnJvcjogZXJyLFxuICAgICAgICAgIGJvZHk6IGJvZHksXG4gICAgICAgICAgc3RhdHVzQ29kZTogcmVzLnN0YXR1c0NvZGVcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgZW1pdENhc2NhZGUocmVxLCAnZXJyb3InLCBlcnIsIGJvZHkpO1xuICAgICAgICBlbWl0Q2FzY2FkZShyZXEsIGVyci5zdGF0dXNDb2RlLCBlcnIsIGJvZHkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZW1pdENhc2NhZGUocmVxLCAnZGF0YScsIGJvZHkpO1xuICAgICAgfVxuICAgICAgdW50cmFjayhyZXEpO1xuICAgIH1cblxuICAgIHRyYWNrKHJlcSk7XG4gICAgcmV0dXJuIHJlcTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFib3J0ICgpIHtcbiAgICBhZ2dyZWdhdGUucmVxdWVzdHMobGF5ZXIsIHRydWUpLmZvckVhY2goYWJvcnRSZXF1ZXN0KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFib3J0UmVxdWVzdCAocmVxKSB7XG4gICAgcmVxLmFib3J0ZWQgPSB0cnVlO1xuICAgIHJlcS5wcmV2ZW50ZWQgPSB0cnVlO1xuICAgIGVtaXRDYXNjYWRlKHJlcSwgJ2Fib3J0JywgcmVxLnhocik7XG5cbiAgICBpZiAocmVxLnhocikge1xuICAgICAgcmVxLnhoci5hYm9ydCgpO1xuICAgIH1cbiAgICB1bnRyYWNrKHJlcSk7XG4gIH1cblxuICBmdW5jdGlvbiB0cmFjayAocmVxKSB7XG4gICAgbGF5ZXIucmVxdWVzdHMucHVzaChyZXEpO1xuICB9XG5cbiAgZnVuY3Rpb24gdW50cmFjayAocmVxKSB7XG4gICAgdmFyIGkgPSBsYXllci5yZXF1ZXN0cy5pbmRleE9mKHJlcSk7XG4gICAgdmFyIHNwbGljZWQgPSBsYXllci5yZXF1ZXN0cy5zcGxpY2UoaSwgMSk7XG4gICAgaWYgKHNwbGljZWQubGVuZ3RoKSB7XG4gICAgICBlbWl0Q2FzY2FkZShyZXEsICdhbHdheXMnLCByZXEuZXJyb3IsIHJlcS5yZXNwb25zZSwgcmVxKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbGF5ZXI7XG59XG5cbmZ1bmN0aW9uIGZpbmQgKGNvbnRleHQsIHNoYWxsb3cpIHtcbiAgaWYgKGNvcmUgPT09IHZvaWQgMCkge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgZGVwbGV0ZWQ7XG4gIHZhciBsYXllcnMgPSBhZ2dyZWdhdGUuY29udGV4dHMoY29yZSk7XG4gIHdoaWxlIChjb250ZXh0ICYmICFkZXBsZXRlZCkge1xuICAgIHZhciBuZWVkbGUgPSBzYW1lQ29udGV4dChsYXllcnMpO1xuICAgIGlmIChuZWVkbGUpIHtcbiAgICAgIHJldHVybiBuZWVkbGUubGF5ZXI7XG4gICAgfVxuICAgIGNvbnRleHQgPSBjb250ZXh0LnBhcmVudE5vZGU7XG4gICAgZGVwbGV0ZWQgPSBzaGFsbG93ID09PSB0cnVlO1xuICB9XG4gIGZ1bmN0aW9uIHNhbWVDb250ZXh0IChsYXllcnMpIHtcbiAgICB2YXIgaTtcbiAgICB2YXIgbGVuID0gbGF5ZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHZhciBsYXllciA9IGxheWVyc1tpXTtcbiAgICAgIGlmIChsYXllci5jb250ZXh0ID09PSBjb250ZXh0KSB7XG4gICAgICAgIHJldHVybiBsYXllcjtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjb3JlID0gbWVhc2x5KHtcbiAgY29udGV4dDogZ2xvYmFsLmRvY3VtZW50LmJvZHksXG4gIGJhc2U6ICcnXG59KTtcblxuY29yZS5maW5kID0gZmluZDtcbmNvcmUuYWxsID0gYWxsO1xuIl19
},{"./aggregate":16,"./cache":17,"./emitCascade":18,"contra/emitter":5,"raf":11,"xhr":14}],2:[function(require,module,exports){
module.exports = function atoa (a, n) { return Array.prototype.slice.call(a, n); }

},{}],3:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],4:[function(require,module,exports){
'use strict';

var ticky = require('ticky');

module.exports = function debounce (fn, args, ctx) {
  if (!fn) { return; }
  ticky(function run () {
    fn.apply(ctx || null, args || []);
  });
};

},{"ticky":12}],5:[function(require,module,exports){
'use strict';

var atoa = require('atoa');
var debounce = require('./debounce');

module.exports = function emitter (thing, options) {
  var opts = options || {};
  var evt = {};
  if (thing === undefined) { thing = {}; }
  thing.on = function (type, fn) {
    if (!evt[type]) {
      evt[type] = [fn];
    } else {
      evt[type].push(fn);
    }
    return thing;
  };
  thing.once = function (type, fn) {
    fn._once = true; // thing.off(fn) still works!
    thing.on(type, fn);
    return thing;
  };
  thing.off = function (type, fn) {
    var c = arguments.length;
    if (c === 1) {
      delete evt[type];
    } else if (c === 0) {
      evt = {};
    } else {
      var et = evt[type];
      if (!et) { return thing; }
      et.splice(et.indexOf(fn), 1);
    }
    return thing;
  };
  thing.emit = function () {
    var args = atoa(arguments);
    return thing.emitterSnapshot(args.shift()).apply(this, args);
  };
  thing.emitterSnapshot = function (type) {
    var et = (evt[type] || []).slice(0);
    return function () {
      var args = atoa(arguments);
      var ctx = this || thing;
      if (type === 'error' && opts.throws !== false && !et.length) { throw args.length === 1 ? args[0] : args; }
      et.forEach(function emitter (listen) {
        if (opts.async) { debounce(listen, args, ctx); } else { listen.apply(ctx, args); }
        if (listen._once) { thing.off(type, listen); }
      });
      return thing;
    };
  };
  return thing;
};

},{"./debounce":4,"atoa":2}],6:[function(require,module,exports){
var isFunction = require('is-function')

module.exports = forEach

var toString = Object.prototype.toString
var hasOwnProperty = Object.prototype.hasOwnProperty

function forEach(list, iterator, context) {
    if (!isFunction(iterator)) {
        throw new TypeError('iterator must be a function')
    }

    if (arguments.length < 3) {
        context = this
    }
    
    if (toString.call(list) === '[object Array]')
        forEachArray(list, iterator, context)
    else if (typeof list === 'string')
        forEachString(list, iterator, context)
    else
        forEachObject(list, iterator, context)
}

function forEachArray(array, iterator, context) {
    for (var i = 0, len = array.length; i < len; i++) {
        if (hasOwnProperty.call(array, i)) {
            iterator.call(context, array[i], i, array)
        }
    }
}

function forEachString(string, iterator, context) {
    for (var i = 0, len = string.length; i < len; i++) {
        // no such thing as a sparse string.
        iterator.call(context, string.charAt(i), i, string)
    }
}

function forEachObject(object, iterator, context) {
    for (var k in object) {
        if (hasOwnProperty.call(object, k)) {
            iterator.call(context, object[k], k, object)
        }
    }
}

},{"is-function":8}],7:[function(require,module,exports){
(function (global){
if (typeof window !== "undefined") {
    module.exports = window;
} else if (typeof global !== "undefined") {
    module.exports = global;
} else if (typeof self !== "undefined"){
    module.exports = self;
} else {
    module.exports = {};
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9nbG9iYWwvd2luZG93LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiaWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHdpbmRvdztcbn0gZWxzZSBpZiAodHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZ2xvYmFsO1xufSBlbHNlIGlmICh0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIil7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBzZWxmO1xufSBlbHNlIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHt9O1xufVxuIl19
},{}],8:[function(require,module,exports){
module.exports = isFunction

var toString = Object.prototype.toString

function isFunction (fn) {
  var string = toString.call(fn)
  return string === '[object Function]' ||
    (typeof fn === 'function' && string !== '[object RegExp]') ||
    (typeof window !== 'undefined' &&
     // IE8 and below
     (fn === window.setTimeout ||
      fn === window.alert ||
      fn === window.confirm ||
      fn === window.prompt))
};

},{}],9:[function(require,module,exports){
var trim = require('trim')
  , forEach = require('for-each')
  , isArray = function(arg) {
      return Object.prototype.toString.call(arg) === '[object Array]';
    }

module.exports = function (headers) {
  if (!headers)
    return {}

  var result = {}

  forEach(
      trim(headers).split('\n')
    , function (row) {
        var index = row.indexOf(':')
          , key = trim(row.slice(0, index)).toLowerCase()
          , value = trim(row.slice(index + 1))

        if (typeof(result[key]) === 'undefined') {
          result[key] = value
        } else if (isArray(result[key])) {
          result[key].push(value)
        } else {
          result[key] = [ result[key], value ]
        }
      }
  )

  return result
}
},{"for-each":6,"trim":13}],10:[function(require,module,exports){
(function (process){
// Generated by CoffeeScript 1.6.3
(function() {
  var getNanoSeconds, hrtime, loadTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - loadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    loadTime = getNanoSeconds();
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(this);

/*

*/

}).call(this,require('_process'))
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9wZXJmb3JtYW5jZS1ub3cvbGliL3BlcmZvcm1hbmNlLW5vdy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS42LjNcbihmdW5jdGlvbigpIHtcbiAgdmFyIGdldE5hbm9TZWNvbmRzLCBocnRpbWUsIGxvYWRUaW1lO1xuXG4gIGlmICgodHlwZW9mIHBlcmZvcm1hbmNlICE9PSBcInVuZGVmaW5lZFwiICYmIHBlcmZvcm1hbmNlICE9PSBudWxsKSAmJiBwZXJmb3JtYW5jZS5ub3cpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIH07XG4gIH0gZWxzZSBpZiAoKHR5cGVvZiBwcm9jZXNzICE9PSBcInVuZGVmaW5lZFwiICYmIHByb2Nlc3MgIT09IG51bGwpICYmIHByb2Nlc3MuaHJ0aW1lKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiAoZ2V0TmFub1NlY29uZHMoKSAtIGxvYWRUaW1lKSAvIDFlNjtcbiAgICB9O1xuICAgIGhydGltZSA9IHByb2Nlc3MuaHJ0aW1lO1xuICAgIGdldE5hbm9TZWNvbmRzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaHI7XG4gICAgICBociA9IGhydGltZSgpO1xuICAgICAgcmV0dXJuIGhyWzBdICogMWU5ICsgaHJbMV07XG4gICAgfTtcbiAgICBsb2FkVGltZSA9IGdldE5hbm9TZWNvbmRzKCk7XG4gIH0gZWxzZSBpZiAoRGF0ZS5ub3cpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIERhdGUubm93KCkgLSBsb2FkVGltZTtcbiAgICB9O1xuICAgIGxvYWRUaW1lID0gRGF0ZS5ub3coKTtcbiAgfSBlbHNlIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gbG9hZFRpbWU7XG4gICAgfTtcbiAgICBsb2FkVGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICB9XG5cbn0pLmNhbGwodGhpcyk7XG5cbi8qXG4vL0Agc291cmNlTWFwcGluZ1VSTD1wZXJmb3JtYW5jZS1ub3cubWFwXG4qL1xuIl19
},{"_process":3}],11:[function(require,module,exports){
var now = require('performance-now')
  , global = typeof window === 'undefined' ? {} : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = global['request' + suffix]
  , caf = global['cancel' + suffix] || global['cancelRequest' + suffix]
  , isNative = true

for(var i = 0; i < vendors.length && !raf; i++) {
  raf = global[vendors[i] + 'Request' + suffix]
  caf = global[vendors[i] + 'Cancel' + suffix]
      || global[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  isNative = false

  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next))
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  if(!isNative) {
    return raf.call(global, fn)
  }
  return raf.call(global, function() {
    try{
      fn.apply(this, arguments)
    } catch(e) {
      setTimeout(function() { throw e }, 0)
    }
  })
}
module.exports.cancel = function() {
  caf.apply(global, arguments)
}

},{"performance-now":10}],12:[function(require,module,exports){
var si = typeof setImmediate === 'function', tick;
if (si) {
  tick = function (fn) { setImmediate(fn); };
} else {
  tick = function (fn) { setTimeout(fn, 0); };
}

module.exports = tick;
},{}],13:[function(require,module,exports){

exports = module.exports = trim;

function trim(str){
  return str.replace(/^\s*|\s*$/g, '');
}

exports.left = function(str){
  return str.replace(/^\s*/, '');
};

exports.right = function(str){
  return str.replace(/\s*$/, '');
};

},{}],14:[function(require,module,exports){
"use strict";
var window = require("global/window")
var isFunction = require("is-function")
var parseHeaders = require("parse-headers")
var xtend = require("xtend")

module.exports = createXHR
createXHR.XMLHttpRequest = window.XMLHttpRequest || noop
createXHR.XDomainRequest = "withCredentials" in (new createXHR.XMLHttpRequest()) ? createXHR.XMLHttpRequest : window.XDomainRequest

forEachArray(["get", "put", "post", "patch", "head", "delete"], function(method) {
    createXHR[method === "delete" ? "del" : method] = function(uri, options, callback) {
        options = initParams(uri, options, callback)
        options.method = method.toUpperCase()
        return _createXHR(options)
    }
})

function forEachArray(array, iterator) {
    for (var i = 0; i < array.length; i++) {
        iterator(array[i])
    }
}

function isEmpty(obj){
    for(var i in obj){
        if(obj.hasOwnProperty(i)) return false
    }
    return true
}

function initParams(uri, options, callback) {
    var params = uri

    if (isFunction(options)) {
        callback = options
        if (typeof uri === "string") {
            params = {uri:uri}
        }
    } else {
        params = xtend(options, {uri: uri})
    }

    params.callback = callback
    return params
}

function createXHR(uri, options, callback) {
    options = initParams(uri, options, callback)
    return _createXHR(options)
}

function _createXHR(options) {
    if(typeof options.callback === "undefined"){
        throw new Error("callback argument missing")
    }

    var called = false
    var callback = function cbOnce(err, response, body){
        if(!called){
            called = true
            options.callback(err, response, body)
        }
    }

    function readystatechange() {
        if (xhr.readyState === 4) {
            loadFunc()
        }
    }

    function getBody() {
        // Chrome with requestType=blob throws errors arround when even testing access to responseText
        var body = undefined

        if (xhr.response) {
            body = xhr.response
        } else {
            body = xhr.responseText || getXml(xhr)
        }

        if (isJson) {
            try {
                body = JSON.parse(body)
            } catch (e) {}
        }

        return body
    }

    var failureResponse = {
                body: undefined,
                headers: {},
                statusCode: 0,
                method: method,
                url: uri,
                rawRequest: xhr
            }

    function errorFunc(evt) {
        clearTimeout(timeoutTimer)
        if(!(evt instanceof Error)){
            evt = new Error("" + (evt || "Unknown XMLHttpRequest Error") )
        }
        evt.statusCode = 0
        return callback(evt, failureResponse)
    }

    // will load the data & process the response in a special response object
    function loadFunc() {
        if (aborted) return
        var status
        clearTimeout(timeoutTimer)
        if(options.useXDR && xhr.status===undefined) {
            //IE8 CORS GET successful response doesn't have a status field, but body is fine
            status = 200
        } else {
            status = (xhr.status === 1223 ? 204 : xhr.status)
        }
        var response = failureResponse
        var err = null

        if (status !== 0){
            response = {
                body: getBody(),
                statusCode: status,
                method: method,
                headers: {},
                url: uri,
                rawRequest: xhr
            }
            if(xhr.getAllResponseHeaders){ //remember xhr can in fact be XDR for CORS in IE
                response.headers = parseHeaders(xhr.getAllResponseHeaders())
            }
        } else {
            err = new Error("Internal XMLHttpRequest Error")
        }
        return callback(err, response, response.body)
    }

    var xhr = options.xhr || null

    if (!xhr) {
        if (options.cors || options.useXDR) {
            xhr = new createXHR.XDomainRequest()
        }else{
            xhr = new createXHR.XMLHttpRequest()
        }
    }

    var key
    var aborted
    var uri = xhr.url = options.uri || options.url
    var method = xhr.method = options.method || "GET"
    var body = options.body || options.data || null
    var headers = xhr.headers = options.headers || {}
    var sync = !!options.sync
    var isJson = false
    var timeoutTimer

    if ("json" in options) {
        isJson = true
        headers["accept"] || headers["Accept"] || (headers["Accept"] = "application/json") //Don't override existing accept header declared by user
        if (method !== "GET" && method !== "HEAD") {
            headers["content-type"] || headers["Content-Type"] || (headers["Content-Type"] = "application/json") //Don't override existing accept header declared by user
            body = JSON.stringify(options.json)
        }
    }

    xhr.onreadystatechange = readystatechange
    xhr.onload = loadFunc
    xhr.onerror = errorFunc
    // IE9 must have onprogress be set to a unique function.
    xhr.onprogress = function () {
        // IE must die
    }
    xhr.ontimeout = errorFunc
    xhr.open(method, uri, !sync, options.username, options.password)
    //has to be after open
    if(!sync) {
        xhr.withCredentials = !!options.withCredentials
    }
    // Cannot set timeout with sync request
    // not setting timeout on the xhr object, because of old webkits etc. not handling that correctly
    // both npm's request and jquery 1.x use this kind of timeout, so this is being consistent
    if (!sync && options.timeout > 0 ) {
        timeoutTimer = setTimeout(function(){
            aborted=true//IE9 may still call readystatechange
            xhr.abort("timeout")
            var e = new Error("XMLHttpRequest timeout")
            e.code = "ETIMEDOUT"
            errorFunc(e)
        }, options.timeout )
    }

    if (xhr.setRequestHeader) {
        for(key in headers){
            if(headers.hasOwnProperty(key)){
                xhr.setRequestHeader(key, headers[key])
            }
        }
    } else if (options.headers && !isEmpty(options.headers)) {
        throw new Error("Headers cannot be set on an XDomainRequest object")
    }

    if ("responseType" in options) {
        xhr.responseType = options.responseType
    }

    if ("beforeSend" in options &&
        typeof options.beforeSend === "function"
    ) {
        options.beforeSend(xhr)
    }

    xhr.send(body)

    return xhr


}

function getXml(xhr) {
    if (xhr.responseType === "document") {
        return xhr.responseXML
    }
    var firefoxBugTakenEffect = xhr.status === 204 && xhr.responseXML && xhr.responseXML.documentElement.nodeName === "parsererror"
    if (xhr.responseType === "" && !firefoxBugTakenEffect) {
        return xhr.responseXML
    }

    return null
}

function noop() {}

},{"global/window":7,"is-function":8,"parse-headers":9,"xtend":15}],15:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],16:[function(require,module,exports){
'use strict';

function expand (fn) {
  return function expansion (accumulator, child) {
    accumulator.push.apply(accumulator, fn(child));
    return accumulator;
  };
}

function requests (layer, clear) {
  var result = layer.requests.concat(layer.children.reduce(expand(requests), []));
  if (clear) {
    layer.requests = [];
  }
  return result;
}

function contexts (layer) {
  var self = [{
    context: layer.context,
    layer: layer
  }];
  return self.concat(layer.children.reduce(expand(contexts), []));
}

module.exports = {
  requests: requests,
  contexts: contexts
};

},{}],17:[function(require,module,exports){
'use strict';

function find (url, context) {
  var ctx = context;
  var cache;
  while (ctx) {
    cache = ctx.cache;
    if (url in cache) {
      if (isFresh(cache[url])) {
        return cache[url];
      }
      delete cache[url];
    }
    ctx = ctx.parent;
  }
}

function isFresh (entry) {
  return entry.expires - new Date() > 0;
}

function expires (duration) {
  return Date.now() + duration;
}

module.exports = {
  find: find,
  expires: expires
};

},{}],18:[function(require,module,exports){
'use strict';

function emitCascade () {
  var args = Array.prototype.slice.call(arguments);
  var req = args.shift();
  var targets = [req];
  var layer = req.layer;

  while (layer) {
    targets.push(layer);
    layer = layer.parent;
  }

  targets.reverse().forEach(function emitInContext (target) {
    target.emit.apply(req, args);
  });
}

module.exports = emitCascade;

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIuL3NyYy9tZWFzbHkuanMiLCIvVXNlcnMvYmV2YWNxdWEvZGV2L21lYXNseS9ub2RlX21vZHVsZXMvYXRvYS9hdG9hLmpzIiwiL1VzZXJzL2JldmFjcXVhL2Rldi9tZWFzbHkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIi9Vc2Vycy9iZXZhY3F1YS9kZXYvbWVhc2x5L25vZGVfbW9kdWxlcy9jb250cmEvZGVib3VuY2UuanMiLCIvVXNlcnMvYmV2YWNxdWEvZGV2L21lYXNseS9ub2RlX21vZHVsZXMvY29udHJhL2VtaXR0ZXIuanMiLCIvVXNlcnMvYmV2YWNxdWEvZGV2L21lYXNseS9ub2RlX21vZHVsZXMvZm9yLWVhY2gvaW5kZXguanMiLCIvVXNlcnMvYmV2YWNxdWEvZGV2L21lYXNseS9ub2RlX21vZHVsZXMvZ2xvYmFsL3dpbmRvdy5qcyIsIi9Vc2Vycy9iZXZhY3F1YS9kZXYvbWVhc2x5L25vZGVfbW9kdWxlcy9pcy1mdW5jdGlvbi9pbmRleC5qcyIsIi9Vc2Vycy9iZXZhY3F1YS9kZXYvbWVhc2x5L25vZGVfbW9kdWxlcy9wYXJzZS1oZWFkZXJzL3BhcnNlLWhlYWRlcnMuanMiLCIvVXNlcnMvYmV2YWNxdWEvZGV2L21lYXNseS9ub2RlX21vZHVsZXMvcGVyZm9ybWFuY2Utbm93L2xpYi9wZXJmb3JtYW5jZS1ub3cuanMiLCIvVXNlcnMvYmV2YWNxdWEvZGV2L21lYXNseS9ub2RlX21vZHVsZXMvcmFmL2luZGV4LmpzIiwiL1VzZXJzL2JldmFjcXVhL2Rldi9tZWFzbHkvbm9kZV9tb2R1bGVzL3RpY2t5L3RpY2t5LWJyb3dzZXIuanMiLCIvVXNlcnMvYmV2YWNxdWEvZGV2L21lYXNseS9ub2RlX21vZHVsZXMvdHJpbS9pbmRleC5qcyIsIi9Vc2Vycy9iZXZhY3F1YS9kZXYvbWVhc2x5L25vZGVfbW9kdWxlcy94aHIvaW5kZXguanMiLCIvVXNlcnMvYmV2YWNxdWEvZGV2L21lYXNseS9ub2RlX21vZHVsZXMveHRlbmQvaW1tdXRhYmxlLmpzIiwiL1VzZXJzL2JldmFjcXVhL2Rldi9tZWFzbHkvc3JjL2FnZ3JlZ2F0ZS5qcyIsIi9Vc2Vycy9iZXZhY3F1YS9kZXYvbWVhc2x5L3NyYy9jYWNoZS5qcyIsIi9Vc2Vycy9iZXZhY3F1YS9kZXYvbWVhc2x5L3NyYy9lbWl0Q2FzY2FkZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hOQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzT0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmFmID0gcmVxdWlyZSgncmFmJyk7XG52YXIgeGhyID0gcmVxdWlyZSgneGhyJyk7XG52YXIgZW1pdHRlciA9IHJlcXVpcmUoJ2NvbnRyYS9lbWl0dGVyJyk7XG52YXIgY2FjaGUgPSByZXF1aXJlKCcuL2NhY2hlJyk7XG52YXIgYWdncmVnYXRlID0gcmVxdWlyZSgnLi9hZ2dyZWdhdGUnKTtcbnZhciBlbWl0Q2FzY2FkZSA9IHJlcXVpcmUoJy4vZW1pdENhc2NhZGUnKTtcbnZhciBtZXRob2RzID0gWydnZXQnLCAncG9zdCcsICdwdXQnLCAnZGVsZXRlJywgJ3BhdGNoJ107XG52YXIgY29yZTtcbnZhciBhbGwgPSBbXTtcblxuZnVuY3Rpb24gbWVhc2x5IChtZWFzbHlPcHRpb25zLCBwYXJlbnQpIHtcbiAgdmFyIGxheWVyID0gZmluZChtZWFzbHlPcHRpb25zLmNvbnRleHQsIHRydWUpO1xuICBpZiAobGF5ZXIpIHtcbiAgICByZXR1cm4gbGF5ZXI7XG4gIH1cblxuICBsYXllciA9IGVtaXR0ZXIoe1xuICAgIGxheWVyOiB0aGlubmVyLFxuICAgIHBhcmVudDogcGFyZW50LFxuICAgIGNvbnRleHQ6IG1lYXNseU9wdGlvbnMuY29udGV4dCxcbiAgICBjaGlsZHJlbjogW10sXG4gICAgcmVxdWVzdHM6IFtdLFxuICAgIGNhY2hlOiB7fSxcbiAgICBhYm9ydDogYWJvcnQsXG4gICAgcmVxdWVzdDogcmVxdWVzdFxuICB9LCB7IHRocm93czogZmFsc2UgfSk7XG5cbiAgbWV0aG9kcy5mb3JFYWNoKGZ1bmN0aW9uIGFkZE1ldGhvZCAobWV0aG9kKSB7XG4gICAgbGF5ZXJbbWV0aG9kXSA9IGZpcmUuYmluZChudWxsLCBtZXRob2QpO1xuICB9KTtcblxuICBhbGwucHVzaChsYXllcik7XG5cbiAgZnVuY3Rpb24gcmVxdWVzdCAodXJsLCBvcHQpIHtcbiAgICB2YXIgbWV0aG9kID0gb3B0Lm1ldGhvZDtcbiAgICBpZiAob3B0ICYmIG9wdC54aHIgJiYgb3B0Lnhoci5tZXRob2QpIHtcbiAgICAgIG1ldGhvZCA9IG9wdC54aHIubWV0aG9kO1xuICAgIH1cbiAgICBpZiAoIW1ldGhvZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBIHJlcXVlc3QgbWV0aG9kIG11c3QgYmUgc3BlY2lmaWVkLicpO1xuICAgIH1cbiAgICByZXR1cm4gZmlyZShtZXRob2QsIHVybCwgb3B0KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRoaW5uZXIgKG9wdCkge1xuICAgIHZhciBleGlzdGluZyA9IGZpbmQob3B0LmNvbnRleHQgfHwgbWVhc2x5T3B0aW9ucy5jb250ZXh0LCB0cnVlKTtcbiAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgIHJldHVybiBleGlzdGluZztcbiAgICB9XG4gICAgdmFyIGNoaWxkID0gbWVhc2x5KG9wdCB8fCBtZWFzbHlPcHRpb25zLCBsYXllcik7XG4gICAgbGF5ZXIuY2hpbGRyZW4ucHVzaChjaGlsZCk7XG4gICAgcmV0dXJuIGNoaWxkO1xuICB9XG5cbiAgZnVuY3Rpb24gZmlyZSAobWV0aG9kLCB1cmwsIG9wdCkge1xuICAgIHZhciBmaXJlT3B0aW9ucyA9IG9wdCB8fCB7fTtcbiAgICBmaXJlT3B0aW9ucy5qc29uID0gJ2pzb24nIGluIGZpcmVPcHRpb25zID8gZmlyZU9wdGlvbnMuanNvbiA6IHt9O1xuICAgIGZpcmVPcHRpb25zLnVybCA9IHVybDtcbiAgICBmaXJlT3B0aW9ucy5tZXRob2QgPSBtZXRob2QudG9VcHBlckNhc2UoKTtcblxuICAgIHZhciByZXEgPSBlbWl0dGVyKHtcbiAgICAgIGRvbmU6IGZhbHNlLFxuICAgICAgcmVxdWVzdGVkOiBmYWxzZSxcbiAgICAgIHByZXZlbnRlZDogZmFsc2UsXG4gICAgICBwcmV2ZW50OiBwcmV2ZW50LFxuICAgICAgbGF5ZXI6IGxheWVyLFxuICAgICAgY29udGV4dDogZmlyZU9wdGlvbnMuY29udGV4dCB8fCBtZWFzbHlPcHRpb25zLmNvbnRleHQsXG4gICAgICBjYWNoZTogZmlyZU9wdGlvbnMuY2FjaGUgfHwgbWVhc2x5T3B0aW9ucy5jYWNoZSxcbiAgICAgIHVybDogdXJsLFxuICAgICAgbWV0aG9kOiBtZXRob2RcbiAgICB9LCB7IHRocm93czogZmFsc2UgfSk7XG4gICAgcmVxLmFib3J0ID0gYWJvcnRSZXF1ZXN0LmJpbmQobnVsbCwgcmVxKTtcblxuICAgIHJhZihnbyk7XG5cbiAgICBmdW5jdGlvbiBnbyAoKSB7XG4gICAgICBlbWl0Q2FzY2FkZShyZXEsICdjcmVhdGUnLCByZXEpO1xuICAgICAgcmVxdWVzdCgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByZXZlbnQgKGVyciwgYm9keSwgc3RhdHVzQ29kZSkge1xuICAgICAgaWYgKHJlcS5wcmV2ZW50ZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKHJlcS5yZXF1ZXN0ZWQgPT09IHRydWUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBIHJlcXVlc3QgaGFzIGFscmVhZHkgYmVlbiBtYWRlLiBQcmV2ZW50IHN5bmNocm9ub3VzbHkhJyk7XG4gICAgICB9XG4gICAgICByZXEucHJldmVudGVkID0gdHJ1ZTtcbiAgICAgIHJhZihwcmV2ZW50ZWQpO1xuXG4gICAgICBmdW5jdGlvbiBwcmV2ZW50ZWQgKCkge1xuICAgICAgICB2YXIgeGhyID0ge1xuICAgICAgICAgIGJvZHk6IGJvZHksXG4gICAgICAgICAgc3RhdHVzQ29kZTogc3RhdHVzQ29kZSB8fCBlcnIgPyA1MDAgOiAyMDBcbiAgICAgICAgfTtcbiAgICAgICAgZW1pdENhc2NhZGUocmVxLCAnY2FjaGUnLCBlcnIsIGJvZHkpO1xuICAgICAgICBkb25lKGVyciwgeGhyLCBib2R5KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjYWNoZUhpdCAoKSB7XG4gICAgICB2YXIgZW50cnkgPSBjYWNoZS5maW5kKHVybCwgbGF5ZXIpO1xuICAgICAgaWYgKGVudHJ5KSB7XG4gICAgICAgIGVudHJ5LmNhY2hlZCA9IHRydWU7XG4gICAgICAgIHJlcS54aHIgPSBlbnRyeTtcbiAgICAgICAgcmVxLnByZXZlbnRlZCA9IHRydWU7XG4gICAgICAgIGVtaXRDYXNjYWRlKHJlcSwgJ2NhY2hlJywgZW50cnkuZXJyb3IsIGVudHJ5LmJvZHkpO1xuICAgICAgICBkb25lKGVudHJ5LmVycm9yLCBlbnRyeSwgZW50cnkuYm9keSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVxdWVzdCAoKSB7XG4gICAgICBpZiAobWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICBjYWNoZUhpdCgpO1xuICAgICAgfVxuICAgICAgaWYgKHJlcS5wcmV2ZW50ZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcmVxLnJlcXVlc3RlZCA9IHRydWU7XG4gICAgICByZXEueGhyID0geGhyKGZpcmVPcHRpb25zLCBkb25lKTtcbiAgICAgIGVtaXRDYXNjYWRlKHJlcSwgJ3JlcXVlc3QnLCByZXEueGhyKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkb25lIChlcnIsIHJlcywgYm9keSkge1xuICAgICAgcmVxLmVycm9yID0gZXJyO1xuICAgICAgcmVxLnJlc3BvbnNlID0gYm9keTtcbiAgICAgIHJlcS5kb25lID0gdHJ1ZTtcbiAgICAgIGlmIChyZXEuY2FjaGUgJiYgIXJlcy5jYWNoZWQpIHtcbiAgICAgICAgbGF5ZXIuY2FjaGVbdXJsXSA9IHtcbiAgICAgICAgICBleHBpcmVzOiBjYWNoZS5leHBpcmVzKHJlcS5jYWNoZSksXG4gICAgICAgICAgZXJyb3I6IGVycixcbiAgICAgICAgICBib2R5OiBib2R5LFxuICAgICAgICAgIHN0YXR1c0NvZGU6IHJlcy5zdGF0dXNDb2RlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIGVtaXRDYXNjYWRlKHJlcSwgJ2Vycm9yJywgZXJyLCBib2R5KTtcbiAgICAgICAgZW1pdENhc2NhZGUocmVxLCBlcnIuc3RhdHVzQ29kZSwgZXJyLCBib2R5KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVtaXRDYXNjYWRlKHJlcSwgJ2RhdGEnLCBib2R5KTtcbiAgICAgIH1cbiAgICAgIHVudHJhY2socmVxKTtcbiAgICB9XG5cbiAgICB0cmFjayhyZXEpO1xuICAgIHJldHVybiByZXE7XG4gIH1cblxuICBmdW5jdGlvbiBhYm9ydCAoKSB7XG4gICAgYWdncmVnYXRlLnJlcXVlc3RzKGxheWVyLCB0cnVlKS5mb3JFYWNoKGFib3J0UmVxdWVzdCk7XG4gIH1cblxuICBmdW5jdGlvbiBhYm9ydFJlcXVlc3QgKHJlcSkge1xuICAgIHJlcS5hYm9ydGVkID0gdHJ1ZTtcbiAgICByZXEucHJldmVudGVkID0gdHJ1ZTtcbiAgICBlbWl0Q2FzY2FkZShyZXEsICdhYm9ydCcsIHJlcS54aHIpO1xuXG4gICAgaWYgKHJlcS54aHIpIHtcbiAgICAgIHJlcS54aHIuYWJvcnQoKTtcbiAgICB9XG4gICAgdW50cmFjayhyZXEpO1xuICB9XG5cbiAgZnVuY3Rpb24gdHJhY2sgKHJlcSkge1xuICAgIGxheWVyLnJlcXVlc3RzLnB1c2gocmVxKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVudHJhY2sgKHJlcSkge1xuICAgIHZhciBpID0gbGF5ZXIucmVxdWVzdHMuaW5kZXhPZihyZXEpO1xuICAgIHZhciBzcGxpY2VkID0gbGF5ZXIucmVxdWVzdHMuc3BsaWNlKGksIDEpO1xuICAgIGlmIChzcGxpY2VkLmxlbmd0aCkge1xuICAgICAgZW1pdENhc2NhZGUocmVxLCAnYWx3YXlzJywgcmVxLmVycm9yLCByZXEucmVzcG9uc2UsIHJlcSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGxheWVyO1xufVxuXG5mdW5jdGlvbiBmaW5kIChjb250ZXh0LCBzaGFsbG93KSB7XG4gIGlmIChjb3JlID09PSB2b2lkIDApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGRlcGxldGVkO1xuICB2YXIgbGF5ZXJzID0gYWdncmVnYXRlLmNvbnRleHRzKGNvcmUpO1xuICB3aGlsZSAoY29udGV4dCAmJiAhZGVwbGV0ZWQpIHtcbiAgICB2YXIgbmVlZGxlID0gc2FtZUNvbnRleHQobGF5ZXJzKTtcbiAgICBpZiAobmVlZGxlKSB7XG4gICAgICByZXR1cm4gbmVlZGxlLmxheWVyO1xuICAgIH1cbiAgICBjb250ZXh0ID0gY29udGV4dC5wYXJlbnROb2RlO1xuICAgIGRlcGxldGVkID0gc2hhbGxvdyA9PT0gdHJ1ZTtcbiAgfVxuICBmdW5jdGlvbiBzYW1lQ29udGV4dCAobGF5ZXJzKSB7XG4gICAgdmFyIGk7XG4gICAgdmFyIGxlbiA9IGxheWVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB2YXIgbGF5ZXIgPSBsYXllcnNbaV07XG4gICAgICBpZiAobGF5ZXIuY29udGV4dCA9PT0gY29udGV4dCkge1xuICAgICAgICByZXR1cm4gbGF5ZXI7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY29yZSA9IG1lYXNseSh7XG4gIGNvbnRleHQ6IGdsb2JhbC5kb2N1bWVudC5ib2R5LFxuICBiYXNlOiAnJ1xufSk7XG5cbmNvcmUuZmluZCA9IGZpbmQ7XG5jb3JlLmFsbCA9IGFsbDtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbk55WXk5dFpXRnpiSGt1YW5NaVhTd2libUZ0WlhNaU9sdGRMQ0p0WVhCd2FXNW5jeUk2SWp0QlFVRkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CSWl3aVptbHNaU0k2SW1kbGJtVnlZWFJsWkM1cWN5SXNJbk52ZFhKalpWSnZiM1FpT2lJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJ5WVdZZ1BTQnlaWEYxYVhKbEtDZHlZV1luS1R0Y2JuWmhjaUI0YUhJZ1BTQnlaWEYxYVhKbEtDZDRhSEluS1R0Y2JuWmhjaUJsYldsMGRHVnlJRDBnY21WeGRXbHlaU2duWTI5dWRISmhMMlZ0YVhSMFpYSW5LVHRjYm5aaGNpQmpZV05vWlNBOUlISmxjWFZwY21Vb0p5NHZZMkZqYUdVbktUdGNiblpoY2lCaFoyZHlaV2RoZEdVZ1BTQnlaWEYxYVhKbEtDY3VMMkZuWjNKbFoyRjBaU2NwTzF4dWRtRnlJR1Z0YVhSRFlYTmpZV1JsSUQwZ2NtVnhkV2x5WlNnbkxpOWxiV2wwUTJGelkyRmtaU2NwTzF4dWRtRnlJRzFsZEdodlpITWdQU0JiSjJkbGRDY3NJQ2R3YjNOMEp5d2dKM0IxZENjc0lDZGtaV3hsZEdVbkxDQW5jR0YwWTJnblhUdGNiblpoY2lCamIzSmxPMXh1ZG1GeUlHRnNiQ0E5SUZ0ZE8xeHVYRzVtZFc1amRHbHZiaUJ0WldGemJIa2dLRzFsWVhOc2VVOXdkR2x2Ym5Nc0lIQmhjbVZ1ZENrZ2UxeHVJQ0IyWVhJZ2JHRjVaWElnUFNCbWFXNWtLRzFsWVhOc2VVOXdkR2x2Ym5NdVkyOXVkR1Y0ZEN3Z2RISjFaU2s3WEc0Z0lHbG1JQ2hzWVhsbGNpa2dlMXh1SUNBZ0lISmxkSFZ5YmlCc1lYbGxjanRjYmlBZ2ZWeHVYRzRnSUd4aGVXVnlJRDBnWlcxcGRIUmxjaWg3WEc0Z0lDQWdiR0Y1WlhJNklIUm9hVzV1WlhJc1hHNGdJQ0FnY0dGeVpXNTBPaUJ3WVhKbGJuUXNYRzRnSUNBZ1kyOXVkR1Y0ZERvZ2JXVmhjMng1VDNCMGFXOXVjeTVqYjI1MFpYaDBMRnh1SUNBZ0lHTm9hV3hrY21WdU9pQmJYU3hjYmlBZ0lDQnlaWEYxWlhOMGN6b2dXMTBzWEc0Z0lDQWdZMkZqYUdVNklIdDlMRnh1SUNBZ0lHRmliM0owT2lCaFltOXlkQ3hjYmlBZ0lDQnlaWEYxWlhOME9pQnlaWEYxWlhOMFhHNGdJSDBzSUhzZ2RHaHliM2R6T2lCbVlXeHpaU0I5S1R0Y2JseHVJQ0J0WlhSb2IyUnpMbVp2Y2tWaFkyZ29ablZ1WTNScGIyNGdZV1JrVFdWMGFHOWtJQ2h0WlhSb2IyUXBJSHRjYmlBZ0lDQnNZWGxsY2x0dFpYUm9iMlJkSUQwZ1ptbHlaUzVpYVc1a0tHNTFiR3dzSUcxbGRHaHZaQ2s3WEc0Z0lIMHBPMXh1WEc0Z0lHRnNiQzV3ZFhOb0tHeGhlV1Z5S1R0Y2JseHVJQ0JtZFc1amRHbHZiaUJ5WlhGMVpYTjBJQ2gxY213c0lHOXdkQ2tnZTF4dUlDQWdJSFpoY2lCdFpYUm9iMlFnUFNCdmNIUXViV1YwYUc5a08xeHVJQ0FnSUdsbUlDaHZjSFFnSmlZZ2IzQjBMbmhvY2lBbUppQnZjSFF1ZUdoeUxtMWxkR2h2WkNrZ2UxeHVJQ0FnSUNBZ2JXVjBhRzlrSUQwZ2IzQjBMbmhvY2k1dFpYUm9iMlE3WEc0Z0lDQWdmVnh1SUNBZ0lHbG1JQ2doYldWMGFHOWtLU0I3WEc0Z0lDQWdJQ0IwYUhKdmR5QnVaWGNnUlhKeWIzSW9KMEVnY21WeGRXVnpkQ0J0WlhSb2IyUWdiWFZ6ZENCaVpTQnpjR1ZqYVdacFpXUXVKeWs3WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCbWFYSmxLRzFsZEdodlpDd2dkWEpzTENCdmNIUXBPMXh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnZEdocGJtNWxjaUFvYjNCMEtTQjdYRzRnSUNBZ2RtRnlJR1Y0YVhOMGFXNW5JRDBnWm1sdVpDaHZjSFF1WTI5dWRHVjRkQ0I4ZkNCdFpXRnpiSGxQY0hScGIyNXpMbU52Ym5SbGVIUXNJSFJ5ZFdVcE8xeHVJQ0FnSUdsbUlDaGxlR2x6ZEdsdVp5a2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHVjRhWE4wYVc1bk8xeHVJQ0FnSUgxY2JpQWdJQ0IyWVhJZ1kyaHBiR1FnUFNCdFpXRnpiSGtvYjNCMElIeDhJRzFsWVhOc2VVOXdkR2x2Ym5Nc0lHeGhlV1Z5S1R0Y2JpQWdJQ0JzWVhsbGNpNWphR2xzWkhKbGJpNXdkWE5vS0dOb2FXeGtLVHRjYmlBZ0lDQnlaWFIxY200Z1kyaHBiR1E3WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCbWFYSmxJQ2h0WlhSb2IyUXNJSFZ5YkN3Z2IzQjBLU0I3WEc0Z0lDQWdkbUZ5SUdacGNtVlBjSFJwYjI1eklEMGdiM0IwSUh4OElIdDlPMXh1SUNBZ0lHWnBjbVZQY0hScGIyNXpMbXB6YjI0Z1BTQW5hbk52YmljZ2FXNGdabWx5WlU5d2RHbHZibk1nUHlCbWFYSmxUM0IwYVc5dWN5NXFjMjl1SURvZ2UzMDdYRzRnSUNBZ1ptbHlaVTl3ZEdsdmJuTXVkWEpzSUQwZ2RYSnNPMXh1SUNBZ0lHWnBjbVZQY0hScGIyNXpMbTFsZEdodlpDQTlJRzFsZEdodlpDNTBiMVZ3Y0dWeVEyRnpaU2dwTzF4dVhHNGdJQ0FnZG1GeUlISmxjU0E5SUdWdGFYUjBaWElvZTF4dUlDQWdJQ0FnWkc5dVpUb2dabUZzYzJVc1hHNGdJQ0FnSUNCeVpYRjFaWE4wWldRNklHWmhiSE5sTEZ4dUlDQWdJQ0FnY0hKbGRtVnVkR1ZrT2lCbVlXeHpaU3hjYmlBZ0lDQWdJSEJ5WlhabGJuUTZJSEJ5WlhabGJuUXNYRzRnSUNBZ0lDQnNZWGxsY2pvZ2JHRjVaWElzWEc0Z0lDQWdJQ0JqYjI1MFpYaDBPaUJtYVhKbFQzQjBhVzl1Y3k1amIyNTBaWGgwSUh4OElHMWxZWE5zZVU5d2RHbHZibk11WTI5dWRHVjRkQ3hjYmlBZ0lDQWdJR05oWTJobE9pQm1hWEpsVDNCMGFXOXVjeTVqWVdOb1pTQjhmQ0J0WldGemJIbFBjSFJwYjI1ekxtTmhZMmhsTEZ4dUlDQWdJQ0FnZFhKc09pQjFjbXdzWEc0Z0lDQWdJQ0J0WlhSb2IyUTZJRzFsZEdodlpGeHVJQ0FnSUgwc0lIc2dkR2h5YjNkek9pQm1ZV3h6WlNCOUtUdGNiaUFnSUNCeVpYRXVZV0p2Y25RZ1BTQmhZbTl5ZEZKbGNYVmxjM1F1WW1sdVpDaHVkV3hzTENCeVpYRXBPMXh1WEc0Z0lDQWdjbUZtS0dkdktUdGNibHh1SUNBZ0lHWjFibU4wYVc5dUlHZHZJQ2dwSUh0Y2JpQWdJQ0FnSUdWdGFYUkRZWE5qWVdSbEtISmxjU3dnSjJOeVpXRjBaU2NzSUhKbGNTazdYRzRnSUNBZ0lDQnlaWEYxWlhOMEtDazdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ1puVnVZM1JwYjI0Z2NISmxkbVZ1ZENBb1pYSnlMQ0JpYjJSNUxDQnpkR0YwZFhORGIyUmxLU0I3WEc0Z0lDQWdJQ0JwWmlBb2NtVnhMbkJ5WlhabGJuUmxaQ2tnZTF4dUlDQWdJQ0FnSUNCeVpYUjFjbTQ3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0JwWmlBb2NtVnhMbkpsY1hWbGMzUmxaQ0E5UFQwZ2RISjFaU2tnZTF4dUlDQWdJQ0FnSUNCMGFISnZkeUJ1WlhjZ1JYSnliM0lvSjBFZ2NtVnhkV1Z6ZENCb1lYTWdZV3h5WldGa2VTQmlaV1Z1SUcxaFpHVXVJRkJ5WlhabGJuUWdjM2x1WTJoeWIyNXZkWE5zZVNFbktUdGNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lISmxjUzV3Y21WMlpXNTBaV1FnUFNCMGNuVmxPMXh1SUNBZ0lDQWdjbUZtS0hCeVpYWmxiblJsWkNrN1hHNWNiaUFnSUNBZ0lHWjFibU4wYVc5dUlIQnlaWFpsYm5SbFpDQW9LU0I3WEc0Z0lDQWdJQ0FnSUhaaGNpQjRhSElnUFNCN1hHNGdJQ0FnSUNBZ0lDQWdZbTlrZVRvZ1ltOWtlU3hjYmlBZ0lDQWdJQ0FnSUNCemRHRjBkWE5EYjJSbE9pQnpkR0YwZFhORGIyUmxJSHg4SUdWeWNpQS9JRFV3TUNBNklESXdNRnh1SUNBZ0lDQWdJQ0I5TzF4dUlDQWdJQ0FnSUNCbGJXbDBRMkZ6WTJGa1pTaHlaWEVzSUNkallXTm9aU2NzSUdWeWNpd2dZbTlrZVNrN1hHNGdJQ0FnSUNBZ0lHUnZibVVvWlhKeUxDQjRhSElzSUdKdlpIa3BPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNibHh1SUNBZ0lHWjFibU4wYVc5dUlHTmhZMmhsU0dsMElDZ3BJSHRjYmlBZ0lDQWdJSFpoY2lCbGJuUnllU0E5SUdOaFkyaGxMbVpwYm1Rb2RYSnNMQ0JzWVhsbGNpazdYRzRnSUNBZ0lDQnBaaUFvWlc1MGNua3BJSHRjYmlBZ0lDQWdJQ0FnWlc1MGNua3VZMkZqYUdWa0lEMGdkSEoxWlR0Y2JpQWdJQ0FnSUNBZ2NtVnhMbmhvY2lBOUlHVnVkSEo1TzF4dUlDQWdJQ0FnSUNCeVpYRXVjSEpsZG1WdWRHVmtJRDBnZEhKMVpUdGNiaUFnSUNBZ0lDQWdaVzFwZEVOaGMyTmhaR1VvY21WeExDQW5ZMkZqYUdVbkxDQmxiblJ5ZVM1bGNuSnZjaXdnWlc1MGNua3VZbTlrZVNrN1hHNGdJQ0FnSUNBZ0lHUnZibVVvWlc1MGNua3VaWEp5YjNJc0lHVnVkSEo1TENCbGJuUnllUzVpYjJSNUtUdGNiaUFnSUNBZ0lIMWNiaUFnSUNCOVhHNWNiaUFnSUNCbWRXNWpkR2x2YmlCeVpYRjFaWE4wSUNncElIdGNiaUFnSUNBZ0lHbG1JQ2h0WlhSb2IyUWdQVDA5SUNkSFJWUW5LU0I3WEc0Z0lDQWdJQ0FnSUdOaFkyaGxTR2wwS0NrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCcFppQW9jbVZ4TG5CeVpYWmxiblJsWkNrZ2UxeHVJQ0FnSUNBZ0lDQnlaWFIxY200N1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCeVpYRXVjbVZ4ZFdWemRHVmtJRDBnZEhKMVpUdGNiaUFnSUNBZ0lISmxjUzU0YUhJZ1BTQjRhSElvWm1seVpVOXdkR2x2Ym5Nc0lHUnZibVVwTzF4dUlDQWdJQ0FnWlcxcGRFTmhjMk5oWkdVb2NtVnhMQ0FuY21WeGRXVnpkQ2NzSUhKbGNTNTRhSElwTzF4dUlDQWdJSDFjYmx4dUlDQWdJR1oxYm1OMGFXOXVJR1J2Ym1VZ0tHVnljaXdnY21WekxDQmliMlI1S1NCN1hHNGdJQ0FnSUNCeVpYRXVaWEp5YjNJZ1BTQmxjbkk3WEc0Z0lDQWdJQ0J5WlhFdWNtVnpjRzl1YzJVZ1BTQmliMlI1TzF4dUlDQWdJQ0FnY21WeExtUnZibVVnUFNCMGNuVmxPMXh1SUNBZ0lDQWdhV1lnS0hKbGNTNWpZV05vWlNBbUppQWhjbVZ6TG1OaFkyaGxaQ2tnZTF4dUlDQWdJQ0FnSUNCc1lYbGxjaTVqWVdOb1pWdDFjbXhkSUQwZ2UxeHVJQ0FnSUNBZ0lDQWdJR1Y0Y0dseVpYTTZJR05oWTJobExtVjRjR2x5WlhNb2NtVnhMbU5oWTJobEtTeGNiaUFnSUNBZ0lDQWdJQ0JsY25KdmNqb2daWEp5TEZ4dUlDQWdJQ0FnSUNBZ0lHSnZaSGs2SUdKdlpIa3NYRzRnSUNBZ0lDQWdJQ0FnYzNSaGRIVnpRMjlrWlRvZ2NtVnpMbk4wWVhSMWMwTnZaR1ZjYmlBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUdsbUlDaGxjbklwSUh0Y2JpQWdJQ0FnSUNBZ1pXMXBkRU5oYzJOaFpHVW9jbVZ4TENBblpYSnliM0luTENCbGNuSXNJR0p2WkhrcE8xeHVJQ0FnSUNBZ0lDQmxiV2wwUTJGelkyRmtaU2h5WlhFc0lHVnljaTV6ZEdGMGRYTkRiMlJsTENCbGNuSXNJR0p2WkhrcE8xeHVJQ0FnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUNBZ1pXMXBkRU5oYzJOaFpHVW9jbVZ4TENBblpHRjBZU2NzSUdKdlpIa3BPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lDQWdkVzUwY21GamF5aHlaWEVwTzF4dUlDQWdJSDFjYmx4dUlDQWdJSFJ5WVdOcktISmxjU2s3WEc0Z0lDQWdjbVYwZFhKdUlISmxjVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUdGaWIzSjBJQ2dwSUh0Y2JpQWdJQ0JoWjJkeVpXZGhkR1V1Y21WeGRXVnpkSE1vYkdGNVpYSXNJSFJ5ZFdVcExtWnZja1ZoWTJnb1lXSnZjblJTWlhGMVpYTjBLVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUdGaWIzSjBVbVZ4ZFdWemRDQW9jbVZ4S1NCN1hHNGdJQ0FnY21WeExtRmliM0owWldRZ1BTQjBjblZsTzF4dUlDQWdJSEpsY1M1d2NtVjJaVzUwWldRZ1BTQjBjblZsTzF4dUlDQWdJR1Z0YVhSRFlYTmpZV1JsS0hKbGNTd2dKMkZpYjNKMEp5d2djbVZ4TG5ob2NpazdYRzVjYmlBZ0lDQnBaaUFvY21WeExuaG9jaWtnZTF4dUlDQWdJQ0FnY21WeExuaG9jaTVoWW05eWRDZ3BPMXh1SUNBZ0lIMWNiaUFnSUNCMWJuUnlZV05yS0hKbGNTazdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUIwY21GamF5QW9jbVZ4S1NCN1hHNGdJQ0FnYkdGNVpYSXVjbVZ4ZFdWemRITXVjSFZ6YUNoeVpYRXBPMXh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnZFc1MGNtRmpheUFvY21WeEtTQjdYRzRnSUNBZ2RtRnlJR2tnUFNCc1lYbGxjaTV5WlhGMVpYTjBjeTVwYm1SbGVFOW1LSEpsY1NrN1hHNGdJQ0FnZG1GeUlITndiR2xqWldRZ1BTQnNZWGxsY2k1eVpYRjFaWE4wY3k1emNHeHBZMlVvYVN3Z01TazdYRzRnSUNBZ2FXWWdLSE53YkdsalpXUXViR1Z1WjNSb0tTQjdYRzRnSUNBZ0lDQmxiV2wwUTJGelkyRmtaU2h5WlhFc0lDZGhiSGRoZVhNbkxDQnlaWEV1WlhKeWIzSXNJSEpsY1M1eVpYTndiMjV6WlN3Z2NtVnhLVHRjYmlBZ0lDQjlYRzRnSUgxY2JseHVJQ0J5WlhSMWNtNGdiR0Y1WlhJN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUdacGJtUWdLR052Ym5SbGVIUXNJSE5vWVd4c2IzY3BJSHRjYmlBZ2FXWWdLR052Y21VZ1BUMDlJSFp2YVdRZ01Da2dlMXh1SUNBZ0lISmxkSFZ5Ymp0Y2JpQWdmVnh1SUNCMllYSWdaR1Z3YkdWMFpXUTdYRzRnSUhaaGNpQnNZWGxsY25NZ1BTQmhaMmR5WldkaGRHVXVZMjl1ZEdWNGRITW9ZMjl5WlNrN1hHNGdJSGRvYVd4bElDaGpiMjUwWlhoMElDWW1JQ0ZrWlhCc1pYUmxaQ2tnZTF4dUlDQWdJSFpoY2lCdVpXVmtiR1VnUFNCellXMWxRMjl1ZEdWNGRDaHNZWGxsY25NcE8xeHVJQ0FnSUdsbUlDaHVaV1ZrYkdVcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCdVpXVmtiR1V1YkdGNVpYSTdYRzRnSUNBZ2ZWeHVJQ0FnSUdOdmJuUmxlSFFnUFNCamIyNTBaWGgwTG5CaGNtVnVkRTV2WkdVN1hHNGdJQ0FnWkdWd2JHVjBaV1FnUFNCemFHRnNiRzkzSUQwOVBTQjBjblZsTzF4dUlDQjlYRzRnSUdaMWJtTjBhVzl1SUhOaGJXVkRiMjUwWlhoMElDaHNZWGxsY25NcElIdGNiaUFnSUNCMllYSWdhVHRjYmlBZ0lDQjJZWElnYkdWdUlEMGdiR0Y1WlhKekxteGxibWQwYUR0Y2JpQWdJQ0JtYjNJZ0tHa2dQU0F3T3lCcElEd2diR1Z1T3lCcEt5c3BJSHRjYmlBZ0lDQWdJSFpoY2lCc1lYbGxjaUE5SUd4aGVXVnljMXRwWFR0Y2JpQWdJQ0FnSUdsbUlDaHNZWGxsY2k1amIyNTBaWGgwSUQwOVBTQmpiMjUwWlhoMEtTQjdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJpQnNZWGxsY2p0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0I5WEc0Z0lIMWNibjFjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCamIzSmxJRDBnYldWaGMyeDVLSHRjYmlBZ1kyOXVkR1Y0ZERvZ1oyeHZZbUZzTG1SdlkzVnRaVzUwTG1KdlpIa3NYRzRnSUdKaGMyVTZJQ2NuWEc1OUtUdGNibHh1WTI5eVpTNW1hVzVrSUQwZ1ptbHVaRHRjYm1OdmNtVXVZV3hzSUQwZ1lXeHNPMXh1SWwxOSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYXRvYSAoYSwgbikgeyByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYSwgbik7IH1cbiIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhblBvc3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5wb3N0TWVzc2FnZSAmJiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lclxuICAgIDtcblxuICAgIGlmIChjYW5TZXRJbW1lZGlhdGUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmKSB7IHJldHVybiB3aW5kb3cuc2V0SW1tZWRpYXRlKGYpIH07XG4gICAgfVxuXG4gICAgaWYgKGNhblBvc3QpIHtcbiAgICAgICAgdmFyIHF1ZXVlID0gW107XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICB2YXIgc291cmNlID0gZXYuc291cmNlO1xuICAgICAgICAgICAgaWYgKChzb3VyY2UgPT09IHdpbmRvdyB8fCBzb3VyY2UgPT09IG51bGwpICYmIGV2LmRhdGEgPT09ICdwcm9jZXNzLXRpY2snKSB7XG4gICAgICAgICAgICAgICAgZXYuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZuID0gcXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgZm4oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2UoJ3Byb2Nlc3MtdGljaycsICcqJyk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZm4sIDApO1xuICAgIH07XG59KSgpO1xuXG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn1cblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdGlja3kgPSByZXF1aXJlKCd0aWNreScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlYm91bmNlIChmbiwgYXJncywgY3R4KSB7XG4gIGlmICghZm4pIHsgcmV0dXJuOyB9XG4gIHRpY2t5KGZ1bmN0aW9uIHJ1biAoKSB7XG4gICAgZm4uYXBwbHkoY3R4IHx8IG51bGwsIGFyZ3MgfHwgW10pO1xuICB9KTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBhdG9hID0gcmVxdWlyZSgnYXRvYScpO1xudmFyIGRlYm91bmNlID0gcmVxdWlyZSgnLi9kZWJvdW5jZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGVtaXR0ZXIgKHRoaW5nLCBvcHRpb25zKSB7XG4gIHZhciBvcHRzID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIGV2dCA9IHt9O1xuICBpZiAodGhpbmcgPT09IHVuZGVmaW5lZCkgeyB0aGluZyA9IHt9OyB9XG4gIHRoaW5nLm9uID0gZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgaWYgKCFldnRbdHlwZV0pIHtcbiAgICAgIGV2dFt0eXBlXSA9IFtmbl07XG4gICAgfSBlbHNlIHtcbiAgICAgIGV2dFt0eXBlXS5wdXNoKGZuKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaW5nO1xuICB9O1xuICB0aGluZy5vbmNlID0gZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgZm4uX29uY2UgPSB0cnVlOyAvLyB0aGluZy5vZmYoZm4pIHN0aWxsIHdvcmtzIVxuICAgIHRoaW5nLm9uKHR5cGUsIGZuKTtcbiAgICByZXR1cm4gdGhpbmc7XG4gIH07XG4gIHRoaW5nLm9mZiA9IGZ1bmN0aW9uICh0eXBlLCBmbikge1xuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBpZiAoYyA9PT0gMSkge1xuICAgICAgZGVsZXRlIGV2dFt0eXBlXTtcbiAgICB9IGVsc2UgaWYgKGMgPT09IDApIHtcbiAgICAgIGV2dCA9IHt9O1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZXQgPSBldnRbdHlwZV07XG4gICAgICBpZiAoIWV0KSB7IHJldHVybiB0aGluZzsgfVxuICAgICAgZXQuc3BsaWNlKGV0LmluZGV4T2YoZm4pLCAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaW5nO1xuICB9O1xuICB0aGluZy5lbWl0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBhcmdzID0gYXRvYShhcmd1bWVudHMpO1xuICAgIHJldHVybiB0aGluZy5lbWl0dGVyU25hcHNob3QoYXJncy5zaGlmdCgpKS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfTtcbiAgdGhpbmcuZW1pdHRlclNuYXBzaG90ID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICB2YXIgZXQgPSAoZXZ0W3R5cGVdIHx8IFtdKS5zbGljZSgwKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGFyZ3MgPSBhdG9hKGFyZ3VtZW50cyk7XG4gICAgICB2YXIgY3R4ID0gdGhpcyB8fCB0aGluZztcbiAgICAgIGlmICh0eXBlID09PSAnZXJyb3InICYmIG9wdHMudGhyb3dzICE9PSBmYWxzZSAmJiAhZXQubGVuZ3RoKSB7IHRocm93IGFyZ3MubGVuZ3RoID09PSAxID8gYXJnc1swXSA6IGFyZ3M7IH1cbiAgICAgIGV0LmZvckVhY2goZnVuY3Rpb24gZW1pdHRlciAobGlzdGVuKSB7XG4gICAgICAgIGlmIChvcHRzLmFzeW5jKSB7IGRlYm91bmNlKGxpc3RlbiwgYXJncywgY3R4KTsgfSBlbHNlIHsgbGlzdGVuLmFwcGx5KGN0eCwgYXJncyk7IH1cbiAgICAgICAgaWYgKGxpc3Rlbi5fb25jZSkgeyB0aGluZy5vZmYodHlwZSwgbGlzdGVuKTsgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpbmc7XG4gICAgfTtcbiAgfTtcbiAgcmV0dXJuIHRoaW5nO1xufTtcbiIsInZhciBpc0Z1bmN0aW9uID0gcmVxdWlyZSgnaXMtZnVuY3Rpb24nKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZvckVhY2hcblxudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ1xudmFyIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eVxuXG5mdW5jdGlvbiBmb3JFYWNoKGxpc3QsIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgaWYgKCFpc0Z1bmN0aW9uKGl0ZXJhdG9yKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdpdGVyYXRvciBtdXN0IGJlIGEgZnVuY3Rpb24nKVxuICAgIH1cblxuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoIDwgMykge1xuICAgICAgICBjb250ZXh0ID0gdGhpc1xuICAgIH1cbiAgICBcbiAgICBpZiAodG9TdHJpbmcuY2FsbChsaXN0KSA9PT0gJ1tvYmplY3QgQXJyYXldJylcbiAgICAgICAgZm9yRWFjaEFycmF5KGxpc3QsIGl0ZXJhdG9yLCBjb250ZXh0KVxuICAgIGVsc2UgaWYgKHR5cGVvZiBsaXN0ID09PSAnc3RyaW5nJylcbiAgICAgICAgZm9yRWFjaFN0cmluZyhsaXN0LCBpdGVyYXRvciwgY29udGV4dClcbiAgICBlbHNlXG4gICAgICAgIGZvckVhY2hPYmplY3QobGlzdCwgaXRlcmF0b3IsIGNvbnRleHQpXG59XG5cbmZ1bmN0aW9uIGZvckVhY2hBcnJheShhcnJheSwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gYXJyYXkubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwoYXJyYXksIGkpKSB7XG4gICAgICAgICAgICBpdGVyYXRvci5jYWxsKGNvbnRleHQsIGFycmF5W2ldLCBpLCBhcnJheSlcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZm9yRWFjaFN0cmluZyhzdHJpbmcsIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHN0cmluZy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAvLyBubyBzdWNoIHRoaW5nIGFzIGEgc3BhcnNlIHN0cmluZy5cbiAgICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBzdHJpbmcuY2hhckF0KGkpLCBpLCBzdHJpbmcpXG4gICAgfVxufVxuXG5mdW5jdGlvbiBmb3JFYWNoT2JqZWN0KG9iamVjdCwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBmb3IgKHZhciBrIGluIG9iamVjdCkge1xuICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChvYmplY3QsIGspKSB7XG4gICAgICAgICAgICBpdGVyYXRvci5jYWxsKGNvbnRleHQsIG9iamVjdFtrXSwgaywgb2JqZWN0KVxuICAgICAgICB9XG4gICAgfVxufVxuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuaWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHdpbmRvdztcbn0gZWxzZSBpZiAodHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZ2xvYmFsO1xufSBlbHNlIGlmICh0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIil7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBzZWxmO1xufSBlbHNlIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHt9O1xufVxuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkltNXZaR1ZmYlc5a2RXeGxjeTluYkc5aVlXd3ZkMmx1Wkc5M0xtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZCUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVNJc0ltWnBiR1VpT2lKblpXNWxjbUYwWldRdWFuTWlMQ0p6YjNWeVkyVlNiMjkwSWpvaUlpd2ljMjkxY21ObGMwTnZiblJsYm5RaU9sc2lhV1lnS0hSNWNHVnZaaUIzYVc1a2IzY2dJVDA5SUZ3aWRXNWtaV1pwYm1Wa1hDSXBJSHRjYmlBZ0lDQnRiMlIxYkdVdVpYaHdiM0owY3lBOUlIZHBibVJ2ZHp0Y2JuMGdaV3h6WlNCcFppQW9kSGx3Wlc5bUlHZHNiMkpoYkNBaFBUMGdYQ0oxYm1SbFptbHVaV1JjSWlrZ2UxeHVJQ0FnSUcxdlpIVnNaUzVsZUhCdmNuUnpJRDBnWjJ4dlltRnNPMXh1ZlNCbGJITmxJR2xtSUNoMGVYQmxiMllnYzJWc1ppQWhQVDBnWENKMWJtUmxabWx1WldSY0lpbDdYRzRnSUNBZ2JXOWtkV3hsTG1WNGNHOXlkSE1nUFNCelpXeG1PMXh1ZlNCbGJITmxJSHRjYmlBZ0lDQnRiMlIxYkdVdVpYaHdiM0owY3lBOUlIdDlPMXh1ZlZ4dUlsMTkiLCJtb2R1bGUuZXhwb3J0cyA9IGlzRnVuY3Rpb25cblxudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uIChmbikge1xuICB2YXIgc3RyaW5nID0gdG9TdHJpbmcuY2FsbChmbilcbiAgcmV0dXJuIHN0cmluZyA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJyB8fFxuICAgICh0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicgJiYgc3RyaW5nICE9PSAnW29iamVjdCBSZWdFeHBdJykgfHxcbiAgICAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgLy8gSUU4IGFuZCBiZWxvd1xuICAgICAoZm4gPT09IHdpbmRvdy5zZXRUaW1lb3V0IHx8XG4gICAgICBmbiA9PT0gd2luZG93LmFsZXJ0IHx8XG4gICAgICBmbiA9PT0gd2luZG93LmNvbmZpcm0gfHxcbiAgICAgIGZuID09PSB3aW5kb3cucHJvbXB0KSlcbn07XG4iLCJ2YXIgdHJpbSA9IHJlcXVpcmUoJ3RyaW0nKVxuICAsIGZvckVhY2ggPSByZXF1aXJlKCdmb3ItZWFjaCcpXG4gICwgaXNBcnJheSA9IGZ1bmN0aW9uKGFyZykge1xuICAgICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhcmcpID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgIH1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoaGVhZGVycykge1xuICBpZiAoIWhlYWRlcnMpXG4gICAgcmV0dXJuIHt9XG5cbiAgdmFyIHJlc3VsdCA9IHt9XG5cbiAgZm9yRWFjaChcbiAgICAgIHRyaW0oaGVhZGVycykuc3BsaXQoJ1xcbicpXG4gICAgLCBmdW5jdGlvbiAocm93KSB7XG4gICAgICAgIHZhciBpbmRleCA9IHJvdy5pbmRleE9mKCc6JylcbiAgICAgICAgICAsIGtleSA9IHRyaW0ocm93LnNsaWNlKDAsIGluZGV4KSkudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICwgdmFsdWUgPSB0cmltKHJvdy5zbGljZShpbmRleCArIDEpKVxuXG4gICAgICAgIGlmICh0eXBlb2YocmVzdWx0W2tleV0pID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWVcbiAgICAgICAgfSBlbHNlIGlmIChpc0FycmF5KHJlc3VsdFtrZXldKSkge1xuICAgICAgICAgIHJlc3VsdFtrZXldLnB1c2godmFsdWUpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0W2tleV0gPSBbIHJlc3VsdFtrZXldLCB2YWx1ZSBdXG4gICAgICAgIH1cbiAgICAgIH1cbiAgKVxuXG4gIHJldHVybiByZXN1bHRcbn0iLCIoZnVuY3Rpb24gKHByb2Nlc3Mpe1xuLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjYuM1xuKGZ1bmN0aW9uKCkge1xuICB2YXIgZ2V0TmFub1NlY29uZHMsIGhydGltZSwgbG9hZFRpbWU7XG5cbiAgaWYgKCh0eXBlb2YgcGVyZm9ybWFuY2UgIT09IFwidW5kZWZpbmVkXCIgJiYgcGVyZm9ybWFuY2UgIT09IG51bGwpICYmIHBlcmZvcm1hbmNlLm5vdykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgfTtcbiAgfSBlbHNlIGlmICgodHlwZW9mIHByb2Nlc3MgIT09IFwidW5kZWZpbmVkXCIgJiYgcHJvY2VzcyAhPT0gbnVsbCkgJiYgcHJvY2Vzcy5ocnRpbWUpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIChnZXROYW5vU2Vjb25kcygpIC0gbG9hZFRpbWUpIC8gMWU2O1xuICAgIH07XG4gICAgaHJ0aW1lID0gcHJvY2Vzcy5ocnRpbWU7XG4gICAgZ2V0TmFub1NlY29uZHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBocjtcbiAgICAgIGhyID0gaHJ0aW1lKCk7XG4gICAgICByZXR1cm4gaHJbMF0gKiAxZTkgKyBoclsxXTtcbiAgICB9O1xuICAgIGxvYWRUaW1lID0gZ2V0TmFub1NlY29uZHMoKTtcbiAgfSBlbHNlIGlmIChEYXRlLm5vdykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gRGF0ZS5ub3coKSAtIGxvYWRUaW1lO1xuICAgIH07XG4gICAgbG9hZFRpbWUgPSBEYXRlLm5vdygpO1xuICB9IGVsc2Uge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSBsb2FkVGltZTtcbiAgICB9O1xuICAgIGxvYWRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gIH1cblxufSkuY2FsbCh0aGlzKTtcblxuLypcblxuKi9cblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoJ19wcm9jZXNzJykpXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbTV2WkdWZmJXOWtkV3hsY3k5d1pYSm1iM0p0WVc1alpTMXViM2N2YkdsaUwzQmxjbVp2Y20xaGJtTmxMVzV2ZHk1cWN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaU8wRkJRVUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEVpTENKbWFXeGxJam9pWjJWdVpYSmhkR1ZrTG1weklpd2ljMjkxY21ObFVtOXZkQ0k2SWlJc0luTnZkWEpqWlhORGIyNTBaVzUwSWpwYklpOHZJRWRsYm1WeVlYUmxaQ0JpZVNCRGIyWm1aV1ZUWTNKcGNIUWdNUzQyTGpOY2JpaG1kVzVqZEdsdmJpZ3BJSHRjYmlBZ2RtRnlJR2RsZEU1aGJtOVRaV052Ym1SekxDQm9jblJwYldVc0lHeHZZV1JVYVcxbE8xeHVYRzRnSUdsbUlDZ29kSGx3Wlc5bUlIQmxjbVp2Y20xaGJtTmxJQ0U5UFNCY0luVnVaR1ZtYVc1bFpGd2lJQ1ltSUhCbGNtWnZjbTFoYm1ObElDRTlQU0J1ZFd4c0tTQW1KaUJ3WlhKbWIzSnRZVzVqWlM1dWIzY3BJSHRjYmlBZ0lDQnRiMlIxYkdVdVpYaHdiM0owY3lBOUlHWjFibU4wYVc5dUtDa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlIQmxjbVp2Y20xaGJtTmxMbTV2ZHlncE8xeHVJQ0FnSUgwN1hHNGdJSDBnWld4elpTQnBaaUFvS0hSNWNHVnZaaUJ3Y205alpYTnpJQ0U5UFNCY0luVnVaR1ZtYVc1bFpGd2lJQ1ltSUhCeWIyTmxjM01nSVQwOUlHNTFiR3dwSUNZbUlIQnliMk5sYzNNdWFISjBhVzFsS1NCN1hHNGdJQ0FnYlc5a2RXeGxMbVY0Y0c5eWRITWdQU0JtZFc1amRHbHZiaWdwSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUFvWjJWMFRtRnViMU5sWTI5dVpITW9LU0F0SUd4dllXUlVhVzFsS1NBdklERmxOanRjYmlBZ0lDQjlPMXh1SUNBZ0lHaHlkR2x0WlNBOUlIQnliMk5sYzNNdWFISjBhVzFsTzF4dUlDQWdJR2RsZEU1aGJtOVRaV052Ym1SeklEMGdablZ1WTNScGIyNG9LU0I3WEc0Z0lDQWdJQ0IyWVhJZ2FISTdYRzRnSUNBZ0lDQm9jaUE5SUdoeWRHbHRaU2dwTzF4dUlDQWdJQ0FnY21WMGRYSnVJR2h5V3pCZElDb2dNV1U1SUNzZ2FISmJNVjA3WEc0Z0lDQWdmVHRjYmlBZ0lDQnNiMkZrVkdsdFpTQTlJR2RsZEU1aGJtOVRaV052Ym1SektDazdYRzRnSUgwZ1pXeHpaU0JwWmlBb1JHRjBaUzV1YjNjcElIdGNiaUFnSUNCdGIyUjFiR1V1Wlhod2IzSjBjeUE5SUdaMWJtTjBhVzl1S0NrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUVSaGRHVXVibTkzS0NrZ0xTQnNiMkZrVkdsdFpUdGNiaUFnSUNCOU8xeHVJQ0FnSUd4dllXUlVhVzFsSUQwZ1JHRjBaUzV1YjNjb0tUdGNiaUFnZlNCbGJITmxJSHRjYmlBZ0lDQnRiMlIxYkdVdVpYaHdiM0owY3lBOUlHWjFibU4wYVc5dUtDa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHNWxkeUJFWVhSbEtDa3VaMlYwVkdsdFpTZ3BJQzBnYkc5aFpGUnBiV1U3WEc0Z0lDQWdmVHRjYmlBZ0lDQnNiMkZrVkdsdFpTQTlJRzVsZHlCRVlYUmxLQ2t1WjJWMFZHbHRaU2dwTzF4dUlDQjlYRzVjYm4wcExtTmhiR3dvZEdocGN5azdYRzVjYmk4cVhHNHZMMEFnYzI5MWNtTmxUV0Z3Y0dsdVoxVlNURDF3WlhKbWIzSnRZVzVqWlMxdWIzY3ViV0Z3WEc0cUwxeHVJbDE5IiwidmFyIG5vdyA9IHJlcXVpcmUoJ3BlcmZvcm1hbmNlLW5vdycpXG4gICwgZ2xvYmFsID0gdHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcgPyB7fSA6IHdpbmRvd1xuICAsIHZlbmRvcnMgPSBbJ21veicsICd3ZWJraXQnXVxuICAsIHN1ZmZpeCA9ICdBbmltYXRpb25GcmFtZSdcbiAgLCByYWYgPSBnbG9iYWxbJ3JlcXVlc3QnICsgc3VmZml4XVxuICAsIGNhZiA9IGdsb2JhbFsnY2FuY2VsJyArIHN1ZmZpeF0gfHwgZ2xvYmFsWydjYW5jZWxSZXF1ZXN0JyArIHN1ZmZpeF1cbiAgLCBpc05hdGl2ZSA9IHRydWVcblxuZm9yKHZhciBpID0gMDsgaSA8IHZlbmRvcnMubGVuZ3RoICYmICFyYWY7IGkrKykge1xuICByYWYgPSBnbG9iYWxbdmVuZG9yc1tpXSArICdSZXF1ZXN0JyArIHN1ZmZpeF1cbiAgY2FmID0gZ2xvYmFsW3ZlbmRvcnNbaV0gKyAnQ2FuY2VsJyArIHN1ZmZpeF1cbiAgICAgIHx8IGdsb2JhbFt2ZW5kb3JzW2ldICsgJ0NhbmNlbFJlcXVlc3QnICsgc3VmZml4XVxufVxuXG4vLyBTb21lIHZlcnNpb25zIG9mIEZGIGhhdmUgckFGIGJ1dCBub3QgY0FGXG5pZighcmFmIHx8ICFjYWYpIHtcbiAgaXNOYXRpdmUgPSBmYWxzZVxuXG4gIHZhciBsYXN0ID0gMFxuICAgICwgaWQgPSAwXG4gICAgLCBxdWV1ZSA9IFtdXG4gICAgLCBmcmFtZUR1cmF0aW9uID0gMTAwMCAvIDYwXG5cbiAgcmFmID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICBpZihxdWV1ZS5sZW5ndGggPT09IDApIHtcbiAgICAgIHZhciBfbm93ID0gbm93KClcbiAgICAgICAgLCBuZXh0ID0gTWF0aC5tYXgoMCwgZnJhbWVEdXJhdGlvbiAtIChfbm93IC0gbGFzdCkpXG4gICAgICBsYXN0ID0gbmV4dCArIF9ub3dcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjcCA9IHF1ZXVlLnNsaWNlKDApXG4gICAgICAgIC8vIENsZWFyIHF1ZXVlIGhlcmUgdG8gcHJldmVudFxuICAgICAgICAvLyBjYWxsYmFja3MgZnJvbSBhcHBlbmRpbmcgbGlzdGVuZXJzXG4gICAgICAgIC8vIHRvIHRoZSBjdXJyZW50IGZyYW1lJ3MgcXVldWVcbiAgICAgICAgcXVldWUubGVuZ3RoID0gMFxuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgY3AubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZighY3BbaV0uY2FuY2VsbGVkKSB7XG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgIGNwW2ldLmNhbGxiYWNrKGxhc3QpXG4gICAgICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHsgdGhyb3cgZSB9LCAwKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSwgTWF0aC5yb3VuZChuZXh0KSlcbiAgICB9XG4gICAgcXVldWUucHVzaCh7XG4gICAgICBoYW5kbGU6ICsraWQsXG4gICAgICBjYWxsYmFjazogY2FsbGJhY2ssXG4gICAgICBjYW5jZWxsZWQ6IGZhbHNlXG4gICAgfSlcbiAgICByZXR1cm4gaWRcbiAgfVxuXG4gIGNhZiA9IGZ1bmN0aW9uKGhhbmRsZSkge1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYocXVldWVbaV0uaGFuZGxlID09PSBoYW5kbGUpIHtcbiAgICAgICAgcXVldWVbaV0uY2FuY2VsbGVkID0gdHJ1ZVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGZuKSB7XG4gIC8vIFdyYXAgaW4gYSBuZXcgZnVuY3Rpb24gdG8gcHJldmVudFxuICAvLyBgY2FuY2VsYCBwb3RlbnRpYWxseSBiZWluZyBhc3NpZ25lZFxuICAvLyB0byB0aGUgbmF0aXZlIHJBRiBmdW5jdGlvblxuICBpZighaXNOYXRpdmUpIHtcbiAgICByZXR1cm4gcmFmLmNhbGwoZ2xvYmFsLCBmbilcbiAgfVxuICByZXR1cm4gcmFmLmNhbGwoZ2xvYmFsLCBmdW5jdGlvbigpIHtcbiAgICB0cnl7XG4gICAgICBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgfSBjYXRjaChlKSB7XG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyB0aHJvdyBlIH0sIDApXG4gICAgfVxuICB9KVxufVxubW9kdWxlLmV4cG9ydHMuY2FuY2VsID0gZnVuY3Rpb24oKSB7XG4gIGNhZi5hcHBseShnbG9iYWwsIGFyZ3VtZW50cylcbn1cbiIsInZhciBzaSA9IHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09ICdmdW5jdGlvbicsIHRpY2s7XG5pZiAoc2kpIHtcbiAgdGljayA9IGZ1bmN0aW9uIChmbikgeyBzZXRJbW1lZGlhdGUoZm4pOyB9O1xufSBlbHNlIHtcbiAgdGljayA9IGZ1bmN0aW9uIChmbikgeyBzZXRUaW1lb3V0KGZuLCAwKTsgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0aWNrOyIsIlxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gdHJpbTtcblxuZnVuY3Rpb24gdHJpbShzdHIpe1xuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMqfFxccyokL2csICcnKTtcbn1cblxuZXhwb3J0cy5sZWZ0ID0gZnVuY3Rpb24oc3RyKXtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzKi8sICcnKTtcbn07XG5cbmV4cG9ydHMucmlnaHQgPSBmdW5jdGlvbihzdHIpe1xuICByZXR1cm4gc3RyLnJlcGxhY2UoL1xccyokLywgJycpO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xudmFyIHdpbmRvdyA9IHJlcXVpcmUoXCJnbG9iYWwvd2luZG93XCIpXG52YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoXCJpcy1mdW5jdGlvblwiKVxudmFyIHBhcnNlSGVhZGVycyA9IHJlcXVpcmUoXCJwYXJzZS1oZWFkZXJzXCIpXG52YXIgeHRlbmQgPSByZXF1aXJlKFwieHRlbmRcIilcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVYSFJcbmNyZWF0ZVhIUi5YTUxIdHRwUmVxdWVzdCA9IHdpbmRvdy5YTUxIdHRwUmVxdWVzdCB8fCBub29wXG5jcmVhdGVYSFIuWERvbWFpblJlcXVlc3QgPSBcIndpdGhDcmVkZW50aWFsc1wiIGluIChuZXcgY3JlYXRlWEhSLlhNTEh0dHBSZXF1ZXN0KCkpID8gY3JlYXRlWEhSLlhNTEh0dHBSZXF1ZXN0IDogd2luZG93LlhEb21haW5SZXF1ZXN0XG5cbmZvckVhY2hBcnJheShbXCJnZXRcIiwgXCJwdXRcIiwgXCJwb3N0XCIsIFwicGF0Y2hcIiwgXCJoZWFkXCIsIFwiZGVsZXRlXCJdLCBmdW5jdGlvbihtZXRob2QpIHtcbiAgICBjcmVhdGVYSFJbbWV0aG9kID09PSBcImRlbGV0ZVwiID8gXCJkZWxcIiA6IG1ldGhvZF0gPSBmdW5jdGlvbih1cmksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0UGFyYW1zKHVyaSwgb3B0aW9ucywgY2FsbGJhY2spXG4gICAgICAgIG9wdGlvbnMubWV0aG9kID0gbWV0aG9kLnRvVXBwZXJDYXNlKClcbiAgICAgICAgcmV0dXJuIF9jcmVhdGVYSFIob3B0aW9ucylcbiAgICB9XG59KVxuXG5mdW5jdGlvbiBmb3JFYWNoQXJyYXkoYXJyYXksIGl0ZXJhdG9yKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICBpdGVyYXRvcihhcnJheVtpXSlcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGlzRW1wdHkob2JqKXtcbiAgICBmb3IodmFyIGkgaW4gb2JqKXtcbiAgICAgICAgaWYob2JqLmhhc093blByb3BlcnR5KGkpKSByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgcmV0dXJuIHRydWVcbn1cblxuZnVuY3Rpb24gaW5pdFBhcmFtcyh1cmksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgdmFyIHBhcmFtcyA9IHVyaVxuXG4gICAgaWYgKGlzRnVuY3Rpb24ob3B0aW9ucykpIHtcbiAgICAgICAgY2FsbGJhY2sgPSBvcHRpb25zXG4gICAgICAgIGlmICh0eXBlb2YgdXJpID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICBwYXJhbXMgPSB7dXJpOnVyaX1cbiAgICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcmFtcyA9IHh0ZW5kKG9wdGlvbnMsIHt1cmk6IHVyaX0pXG4gICAgfVxuXG4gICAgcGFyYW1zLmNhbGxiYWNrID0gY2FsbGJhY2tcbiAgICByZXR1cm4gcGFyYW1zXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVhIUih1cmksIG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgb3B0aW9ucyA9IGluaXRQYXJhbXModXJpLCBvcHRpb25zLCBjYWxsYmFjaylcbiAgICByZXR1cm4gX2NyZWF0ZVhIUihvcHRpb25zKVxufVxuXG5mdW5jdGlvbiBfY3JlYXRlWEhSKG9wdGlvbnMpIHtcbiAgICBpZih0eXBlb2Ygb3B0aW9ucy5jYWxsYmFjayA9PT0gXCJ1bmRlZmluZWRcIil7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhbGxiYWNrIGFyZ3VtZW50IG1pc3NpbmdcIilcbiAgICB9XG5cbiAgICB2YXIgY2FsbGVkID0gZmFsc2VcbiAgICB2YXIgY2FsbGJhY2sgPSBmdW5jdGlvbiBjYk9uY2UoZXJyLCByZXNwb25zZSwgYm9keSl7XG4gICAgICAgIGlmKCFjYWxsZWQpe1xuICAgICAgICAgICAgY2FsbGVkID0gdHJ1ZVxuICAgICAgICAgICAgb3B0aW9ucy5jYWxsYmFjayhlcnIsIHJlc3BvbnNlLCBib2R5KVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVhZHlzdGF0ZWNoYW5nZSgpIHtcbiAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICBsb2FkRnVuYygpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRCb2R5KCkge1xuICAgICAgICAvLyBDaHJvbWUgd2l0aCByZXF1ZXN0VHlwZT1ibG9iIHRocm93cyBlcnJvcnMgYXJyb3VuZCB3aGVuIGV2ZW4gdGVzdGluZyBhY2Nlc3MgdG8gcmVzcG9uc2VUZXh0XG4gICAgICAgIHZhciBib2R5ID0gdW5kZWZpbmVkXG5cbiAgICAgICAgaWYgKHhoci5yZXNwb25zZSkge1xuICAgICAgICAgICAgYm9keSA9IHhoci5yZXNwb25zZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYm9keSA9IHhoci5yZXNwb25zZVRleHQgfHwgZ2V0WG1sKHhocilcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc0pzb24pIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSlcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYm9keVxuICAgIH1cblxuICAgIHZhciBmYWlsdXJlUmVzcG9uc2UgPSB7XG4gICAgICAgICAgICAgICAgYm9keTogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHt9LFxuICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDAsXG4gICAgICAgICAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgICAgICAgICAgdXJsOiB1cmksXG4gICAgICAgICAgICAgICAgcmF3UmVxdWVzdDogeGhyXG4gICAgICAgICAgICB9XG5cbiAgICBmdW5jdGlvbiBlcnJvckZ1bmMoZXZ0KSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0VGltZXIpXG4gICAgICAgIGlmKCEoZXZ0IGluc3RhbmNlb2YgRXJyb3IpKXtcbiAgICAgICAgICAgIGV2dCA9IG5ldyBFcnJvcihcIlwiICsgKGV2dCB8fCBcIlVua25vd24gWE1MSHR0cFJlcXVlc3QgRXJyb3JcIikgKVxuICAgICAgICB9XG4gICAgICAgIGV2dC5zdGF0dXNDb2RlID0gMFxuICAgICAgICByZXR1cm4gY2FsbGJhY2soZXZ0LCBmYWlsdXJlUmVzcG9uc2UpXG4gICAgfVxuXG4gICAgLy8gd2lsbCBsb2FkIHRoZSBkYXRhICYgcHJvY2VzcyB0aGUgcmVzcG9uc2UgaW4gYSBzcGVjaWFsIHJlc3BvbnNlIG9iamVjdFxuICAgIGZ1bmN0aW9uIGxvYWRGdW5jKCkge1xuICAgICAgICBpZiAoYWJvcnRlZCkgcmV0dXJuXG4gICAgICAgIHZhciBzdGF0dXNcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRUaW1lcilcbiAgICAgICAgaWYob3B0aW9ucy51c2VYRFIgJiYgeGhyLnN0YXR1cz09PXVuZGVmaW5lZCkge1xuICAgICAgICAgICAgLy9JRTggQ09SUyBHRVQgc3VjY2Vzc2Z1bCByZXNwb25zZSBkb2Vzbid0IGhhdmUgYSBzdGF0dXMgZmllbGQsIGJ1dCBib2R5IGlzIGZpbmVcbiAgICAgICAgICAgIHN0YXR1cyA9IDIwMFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3RhdHVzID0gKHhoci5zdGF0dXMgPT09IDEyMjMgPyAyMDQgOiB4aHIuc3RhdHVzKVxuICAgICAgICB9XG4gICAgICAgIHZhciByZXNwb25zZSA9IGZhaWx1cmVSZXNwb25zZVxuICAgICAgICB2YXIgZXJyID0gbnVsbFxuXG4gICAgICAgIGlmIChzdGF0dXMgIT09IDApe1xuICAgICAgICAgICAgcmVzcG9uc2UgPSB7XG4gICAgICAgICAgICAgICAgYm9keTogZ2V0Qm9keSgpLFxuICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IHN0YXR1cyxcbiAgICAgICAgICAgICAgICBtZXRob2Q6IG1ldGhvZCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7fSxcbiAgICAgICAgICAgICAgICB1cmw6IHVyaSxcbiAgICAgICAgICAgICAgICByYXdSZXF1ZXN0OiB4aHJcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmKHhoci5nZXRBbGxSZXNwb25zZUhlYWRlcnMpeyAvL3JlbWVtYmVyIHhociBjYW4gaW4gZmFjdCBiZSBYRFIgZm9yIENPUlMgaW4gSUVcbiAgICAgICAgICAgICAgICByZXNwb25zZS5oZWFkZXJzID0gcGFyc2VIZWFkZXJzKHhoci5nZXRBbGxSZXNwb25zZUhlYWRlcnMoKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVyciA9IG5ldyBFcnJvcihcIkludGVybmFsIFhNTEh0dHBSZXF1ZXN0IEVycm9yXCIpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGVyciwgcmVzcG9uc2UsIHJlc3BvbnNlLmJvZHkpXG4gICAgfVxuXG4gICAgdmFyIHhociA9IG9wdGlvbnMueGhyIHx8IG51bGxcblxuICAgIGlmICgheGhyKSB7XG4gICAgICAgIGlmIChvcHRpb25zLmNvcnMgfHwgb3B0aW9ucy51c2VYRFIpIHtcbiAgICAgICAgICAgIHhociA9IG5ldyBjcmVhdGVYSFIuWERvbWFpblJlcXVlc3QoKVxuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHhociA9IG5ldyBjcmVhdGVYSFIuWE1MSHR0cFJlcXVlc3QoKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGtleVxuICAgIHZhciBhYm9ydGVkXG4gICAgdmFyIHVyaSA9IHhoci51cmwgPSBvcHRpb25zLnVyaSB8fCBvcHRpb25zLnVybFxuICAgIHZhciBtZXRob2QgPSB4aHIubWV0aG9kID0gb3B0aW9ucy5tZXRob2QgfHwgXCJHRVRcIlxuICAgIHZhciBib2R5ID0gb3B0aW9ucy5ib2R5IHx8IG9wdGlvbnMuZGF0YSB8fCBudWxsXG4gICAgdmFyIGhlYWRlcnMgPSB4aHIuaGVhZGVycyA9IG9wdGlvbnMuaGVhZGVycyB8fCB7fVxuICAgIHZhciBzeW5jID0gISFvcHRpb25zLnN5bmNcbiAgICB2YXIgaXNKc29uID0gZmFsc2VcbiAgICB2YXIgdGltZW91dFRpbWVyXG5cbiAgICBpZiAoXCJqc29uXCIgaW4gb3B0aW9ucykge1xuICAgICAgICBpc0pzb24gPSB0cnVlXG4gICAgICAgIGhlYWRlcnNbXCJhY2NlcHRcIl0gfHwgaGVhZGVyc1tcIkFjY2VwdFwiXSB8fCAoaGVhZGVyc1tcIkFjY2VwdFwiXSA9IFwiYXBwbGljYXRpb24vanNvblwiKSAvL0Rvbid0IG92ZXJyaWRlIGV4aXN0aW5nIGFjY2VwdCBoZWFkZXIgZGVjbGFyZWQgYnkgdXNlclxuICAgICAgICBpZiAobWV0aG9kICE9PSBcIkdFVFwiICYmIG1ldGhvZCAhPT0gXCJIRUFEXCIpIHtcbiAgICAgICAgICAgIGhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSB8fCAoaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSA9IFwiYXBwbGljYXRpb24vanNvblwiKSAvL0Rvbid0IG92ZXJyaWRlIGV4aXN0aW5nIGFjY2VwdCBoZWFkZXIgZGVjbGFyZWQgYnkgdXNlclxuICAgICAgICAgICAgYm9keSA9IEpTT04uc3RyaW5naWZ5KG9wdGlvbnMuanNvbilcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSByZWFkeXN0YXRlY2hhbmdlXG4gICAgeGhyLm9ubG9hZCA9IGxvYWRGdW5jXG4gICAgeGhyLm9uZXJyb3IgPSBlcnJvckZ1bmNcbiAgICAvLyBJRTkgbXVzdCBoYXZlIG9ucHJvZ3Jlc3MgYmUgc2V0IHRvIGEgdW5pcXVlIGZ1bmN0aW9uLlxuICAgIHhoci5vbnByb2dyZXNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBJRSBtdXN0IGRpZVxuICAgIH1cbiAgICB4aHIub250aW1lb3V0ID0gZXJyb3JGdW5jXG4gICAgeGhyLm9wZW4obWV0aG9kLCB1cmksICFzeW5jLCBvcHRpb25zLnVzZXJuYW1lLCBvcHRpb25zLnBhc3N3b3JkKVxuICAgIC8vaGFzIHRvIGJlIGFmdGVyIG9wZW5cbiAgICBpZighc3luYykge1xuICAgICAgICB4aHIud2l0aENyZWRlbnRpYWxzID0gISFvcHRpb25zLndpdGhDcmVkZW50aWFsc1xuICAgIH1cbiAgICAvLyBDYW5ub3Qgc2V0IHRpbWVvdXQgd2l0aCBzeW5jIHJlcXVlc3RcbiAgICAvLyBub3Qgc2V0dGluZyB0aW1lb3V0IG9uIHRoZSB4aHIgb2JqZWN0LCBiZWNhdXNlIG9mIG9sZCB3ZWJraXRzIGV0Yy4gbm90IGhhbmRsaW5nIHRoYXQgY29ycmVjdGx5XG4gICAgLy8gYm90aCBucG0ncyByZXF1ZXN0IGFuZCBqcXVlcnkgMS54IHVzZSB0aGlzIGtpbmQgb2YgdGltZW91dCwgc28gdGhpcyBpcyBiZWluZyBjb25zaXN0ZW50XG4gICAgaWYgKCFzeW5jICYmIG9wdGlvbnMudGltZW91dCA+IDAgKSB7XG4gICAgICAgIHRpbWVvdXRUaW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGFib3J0ZWQ9dHJ1ZS8vSUU5IG1heSBzdGlsbCBjYWxsIHJlYWR5c3RhdGVjaGFuZ2VcbiAgICAgICAgICAgIHhoci5hYm9ydChcInRpbWVvdXRcIilcbiAgICAgICAgICAgIHZhciBlID0gbmV3IEVycm9yKFwiWE1MSHR0cFJlcXVlc3QgdGltZW91dFwiKVxuICAgICAgICAgICAgZS5jb2RlID0gXCJFVElNRURPVVRcIlxuICAgICAgICAgICAgZXJyb3JGdW5jKGUpXG4gICAgICAgIH0sIG9wdGlvbnMudGltZW91dCApXG4gICAgfVxuXG4gICAgaWYgKHhoci5zZXRSZXF1ZXN0SGVhZGVyKSB7XG4gICAgICAgIGZvcihrZXkgaW4gaGVhZGVycyl7XG4gICAgICAgICAgICBpZihoZWFkZXJzLmhhc093blByb3BlcnR5KGtleSkpe1xuICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgaGVhZGVyc1trZXldKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLmhlYWRlcnMgJiYgIWlzRW1wdHkob3B0aW9ucy5oZWFkZXJzKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJIZWFkZXJzIGNhbm5vdCBiZSBzZXQgb24gYW4gWERvbWFpblJlcXVlc3Qgb2JqZWN0XCIpXG4gICAgfVxuXG4gICAgaWYgKFwicmVzcG9uc2VUeXBlXCIgaW4gb3B0aW9ucykge1xuICAgICAgICB4aHIucmVzcG9uc2VUeXBlID0gb3B0aW9ucy5yZXNwb25zZVR5cGVcbiAgICB9XG5cbiAgICBpZiAoXCJiZWZvcmVTZW5kXCIgaW4gb3B0aW9ucyAmJlxuICAgICAgICB0eXBlb2Ygb3B0aW9ucy5iZWZvcmVTZW5kID09PSBcImZ1bmN0aW9uXCJcbiAgICApIHtcbiAgICAgICAgb3B0aW9ucy5iZWZvcmVTZW5kKHhocilcbiAgICB9XG5cbiAgICB4aHIuc2VuZChib2R5KVxuXG4gICAgcmV0dXJuIHhoclxuXG5cbn1cblxuZnVuY3Rpb24gZ2V0WG1sKHhocikge1xuICAgIGlmICh4aHIucmVzcG9uc2VUeXBlID09PSBcImRvY3VtZW50XCIpIHtcbiAgICAgICAgcmV0dXJuIHhoci5yZXNwb25zZVhNTFxuICAgIH1cbiAgICB2YXIgZmlyZWZveEJ1Z1Rha2VuRWZmZWN0ID0geGhyLnN0YXR1cyA9PT0gMjA0ICYmIHhoci5yZXNwb25zZVhNTCAmJiB4aHIucmVzcG9uc2VYTUwuZG9jdW1lbnRFbGVtZW50Lm5vZGVOYW1lID09PSBcInBhcnNlcmVycm9yXCJcbiAgICBpZiAoeGhyLnJlc3BvbnNlVHlwZSA9PT0gXCJcIiAmJiAhZmlyZWZveEJ1Z1Rha2VuRWZmZWN0KSB7XG4gICAgICAgIHJldHVybiB4aHIucmVzcG9uc2VYTUxcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbFxufVxuXG5mdW5jdGlvbiBub29wKCkge31cbiIsIm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kXG5cbnZhciBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbmZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgICB2YXIgdGFyZ2V0ID0ge31cblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV1cblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7XG4gICAgICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIGtleSkpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGV4cGFuZCAoZm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIGV4cGFuc2lvbiAoYWNjdW11bGF0b3IsIGNoaWxkKSB7XG4gICAgYWNjdW11bGF0b3IucHVzaC5hcHBseShhY2N1bXVsYXRvciwgZm4oY2hpbGQpKTtcbiAgICByZXR1cm4gYWNjdW11bGF0b3I7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlcXVlc3RzIChsYXllciwgY2xlYXIpIHtcbiAgdmFyIHJlc3VsdCA9IGxheWVyLnJlcXVlc3RzLmNvbmNhdChsYXllci5jaGlsZHJlbi5yZWR1Y2UoZXhwYW5kKHJlcXVlc3RzKSwgW10pKTtcbiAgaWYgKGNsZWFyKSB7XG4gICAgbGF5ZXIucmVxdWVzdHMgPSBbXTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBjb250ZXh0cyAobGF5ZXIpIHtcbiAgdmFyIHNlbGYgPSBbe1xuICAgIGNvbnRleHQ6IGxheWVyLmNvbnRleHQsXG4gICAgbGF5ZXI6IGxheWVyXG4gIH1dO1xuICByZXR1cm4gc2VsZi5jb25jYXQobGF5ZXIuY2hpbGRyZW4ucmVkdWNlKGV4cGFuZChjb250ZXh0cyksIFtdKSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICByZXF1ZXN0czogcmVxdWVzdHMsXG4gIGNvbnRleHRzOiBjb250ZXh0c1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZmluZCAodXJsLCBjb250ZXh0KSB7XG4gIHZhciBjdHggPSBjb250ZXh0O1xuICB2YXIgY2FjaGU7XG4gIHdoaWxlIChjdHgpIHtcbiAgICBjYWNoZSA9IGN0eC5jYWNoZTtcbiAgICBpZiAodXJsIGluIGNhY2hlKSB7XG4gICAgICBpZiAoaXNGcmVzaChjYWNoZVt1cmxdKSkge1xuICAgICAgICByZXR1cm4gY2FjaGVbdXJsXTtcbiAgICAgIH1cbiAgICAgIGRlbGV0ZSBjYWNoZVt1cmxdO1xuICAgIH1cbiAgICBjdHggPSBjdHgucGFyZW50O1xuICB9XG59XG5cbmZ1bmN0aW9uIGlzRnJlc2ggKGVudHJ5KSB7XG4gIHJldHVybiBlbnRyeS5leHBpcmVzIC0gbmV3IERhdGUoKSA+IDA7XG59XG5cbmZ1bmN0aW9uIGV4cGlyZXMgKGR1cmF0aW9uKSB7XG4gIHJldHVybiBEYXRlLm5vdygpICsgZHVyYXRpb247XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBmaW5kOiBmaW5kLFxuICBleHBpcmVzOiBleHBpcmVzXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBlbWl0Q2FzY2FkZSAoKSB7XG4gIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcbiAgdmFyIHJlcSA9IGFyZ3Muc2hpZnQoKTtcbiAgdmFyIHRhcmdldHMgPSBbcmVxXTtcbiAgdmFyIGxheWVyID0gcmVxLmxheWVyO1xuXG4gIHdoaWxlIChsYXllcikge1xuICAgIHRhcmdldHMucHVzaChsYXllcik7XG4gICAgbGF5ZXIgPSBsYXllci5wYXJlbnQ7XG4gIH1cblxuICB0YXJnZXRzLnJldmVyc2UoKS5mb3JFYWNoKGZ1bmN0aW9uIGVtaXRJbkNvbnRleHQgKHRhcmdldCkge1xuICAgIHRhcmdldC5lbWl0LmFwcGx5KHJlcSwgYXJncyk7XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGVtaXRDYXNjYWRlO1xuIl19
