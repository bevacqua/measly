'use strict';

var raf = require('raf');
var xhr = require('xhr');
var contra = require('contra');
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
    abort: abort
  });

  methods.forEach(addMethod);

  function addMethod (method) {
    context[method] = fire.bind(null, method.toUpperCase());
  }

  function thinner (opt) {
    var child = measly(opt || measlyOptions, context);
    context.children.push(child);
    return child;
  }

  function abort (children) {
    if (children) {
      aggregate(context, true).forEach(abortRequest);
    } else {
      context.requests.forEach(abortRequest);
      context.requests = [];
    }
  }

  function abortRequest (req) {
    req.abort();
  }

  function fire (method, url, opt) {
    var fireOptions = opt || {};
    var ajaxOptions = {
      url: measlyOptions.base + url,
      method: method,
      json: fireOptions.data,
      headers: { Accept: 'application/json' }
    };
    var state = contra.emitter({
      prevented: false,
      prevent: prevent,
      abort: abortState,
      context: fireOptions.context || measlyOptions.context
    });

    emitUpstream(state, context, stateEvents);

    raf(go);

    function go () {
      state.emit('create', state);
      raf(request);
    }

    function prevent (err, body) {
      if (state.prevented) {
        return;
      }
      if (state.requested === true) {
        throw new Error('A request has already been made. Prevent synchronously!');
      }
      state.prevented = true;
      raf(prevented);

      function prevented () {
        state.emit('cache', err, body);
        done(err, { body: body }, body);
      }
    }

    function request () {
      if (state.prevented === false) {
        state.requested = true;
        state.xhr = xhr(ajaxOptions, done);
        state.emit('request', state.xhr);
      }
    }

    function abortState () {
      state.prevented = true;
      state.emit('abort', state.xhr);

      if (state.xhr) {
        state.xhr.abort();
      }
      untrack(state);
    }

    function done (err, res, body) {
      state.error = err;
      state.response = body;
      if (err) {
        state.emit('error', err, body);
        state.emit(err.statusCode, err, body);
      } else {
        state.emit('data', body);
      }
      untrack(state);
    }

    track(state);
    return state;
  }

  function track (state) {
    context.requests.push(state);
  }

  function untrack (state) {
    var i = context.requests.indexOf(state);
    var spliced = context.requests.splice(i, 1);
    if (spliced.length) {
      state.emit('always', state.error, state.response, state);
    }
  }

  return context;
}

module.exports = measly();
