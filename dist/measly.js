/**
 * measly - A measly wrapper around XHR to help you contain your requests
 * @version v0.1.2
 * @link https://github.com/bevacqua/measly
 * @license MIT
 */
!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.measly=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
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
process.once = noop;
process.off = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],2:[function(_dereq_,module,exports){
module.exports = _dereq_('./src/contra.js');

},{"./src/contra.js":3}],3:[function(_dereq_,module,exports){
(function (process){
(function (Object, root, undefined) {
  'use strict';

  var undef = '' + undefined;
  var SERIAL = 1;
  var CONCURRENT = Infinity;

  function noop () {}
  function a (o) { return Object.prototype.toString.call(o) === '[object Array]'; }
  function atoa (a, n) { return Array.prototype.slice.call(a, n); }
  function debounce (fn, args, ctx) { if (!fn) { return; } tick(function run () { fn.apply(ctx || null, args || []); }); }
  function once (fn) {
    var disposed;
    function disposable () {
      if (disposed) { return; }
      disposed = true;
      (fn || noop).apply(null, arguments);
    }
    disposable.discard = function () { disposed = true; };
    return disposable;
  }
  function handle (args, done, disposable) {
    var err = args.shift();
    if (err) { if (disposable) { disposable.discard(); } debounce(done, [err]); return true; }
  }

  // cross-platform ticker
  var si = typeof setImmediate === 'function', tick;
  if (si) {
    tick = function (fn) { setImmediate(fn); };
  } else if (typeof process !== undef && process.nextTick) {
    tick = process.nextTick;
  } else {
    tick = function (fn) { setTimeout(fn, 0); };
  }

  function _curry () {
    var args = atoa(arguments);
    var method = args.shift();
    return function curried () {
      var more = atoa(arguments);
      method.apply(method, args.concat(more));
    };
  }

  function _waterfall (steps, done) {
    var d = once(done);
    function next () {
      var args = atoa(arguments);
      var step = steps.shift();
      if (step) {
        if (handle(args, d)) { return; }
        args.push(once(next));
        debounce(step, args);
      } else {
        debounce(d, arguments);
      }
    }
    next();
  }

  function _concurrent (tasks, concurrency, done) {
    if (!done) { done = concurrency; concurrency = CONCURRENT; }
    var d = once(done);
    var q = _queue(worker, concurrency);
    var keys = Object.keys(tasks);
    var results = a(tasks) ? [] : {};
    q.unshift(keys);
    q.on('drain', function completed () { d(null, results); });
    function worker (key, next) {
      debounce(tasks[key], [proceed]);
      function proceed () {
        var args = atoa(arguments);
        if (handle(args, d)) { return; }
        results[key] = args.shift();
        next();
      }
    }
  }

  function _series (tasks, done) {
    _concurrent(tasks, SERIAL, done);
  }

  function _map (cap, then, attached) {
    var map = function (collection, concurrency, iterator, done) {
      var args = arguments;
      if (args.length === 2) { iterator = concurrency; concurrency = CONCURRENT; }
      if (args.length === 3 && typeof concurrency !== 'number') { done = iterator; iterator = concurrency; concurrency = CONCURRENT; }
      var keys = Object.keys(collection);
      var tasks = a(collection) ? [] : {};
      keys.forEach(function insert (key) {
        tasks[key] = function iterate (cb) {
          if (iterator.length === 3) {
            iterator(collection[key], key, cb);
          } else {
            iterator(collection[key], cb);
          }
        };
      });
      _concurrent(tasks, cap || concurrency, then ? then(collection, done) : done);
    };
    if (!attached) { map.series = _map(SERIAL, then, true); }
    return map;
  }

  function _each (concurrency) {
    return _map(concurrency, then);
    function then (collection, done) {
      return function mask (err) {
        done(err); // only return the error, no more arguments
      };
    }
  }

  function _filter (concurrency) {
    return _map(concurrency, then);
    function then (collection, done) {
      return function filter (err, results) {
        function exists (item, key) {
          return !!results[key];
        }
        function ofilter () {
          var filtered = {};
          Object.keys(collection).forEach(function omapper (key) {
            if (exists(null, key)) { filtered[key] = collection[key]; }
          });
          return filtered;
        }
        if (err) { done(err); return; }
        done(null, a(results) ? collection.filter(exists) : ofilter());
      };
    }
  }

  function _emitter (thing, options) {
    var opts = options || {};
    var evt = {};
    if (thing === undefined) { thing = {}; }
    thing.on = function (type, fn) {
      if (!evt[type]) {
        evt[type] = [fn];
      } else {
        evt[type].push(fn);
      }
    };
    thing.once = function (type, fn) {
      fn._once = true; // thing.off(fn) still works!
      thing.on(type, fn);
    };
    thing.off = function (type, fn) {
      var et = evt[type];
      if (!et) { return; }
      et.splice(et.indexOf(fn), 1);
    };
    thing.emit = function () {
      var args = atoa(arguments);
      var type = args.shift();
      var et = evt[type];
      if (type === 'error' && !et) { throw args.length === 1 ? args[0] : args; }
      if (!et) { return; }
      evt[type] = et.filter(function emitter (listen) {
        if (opts.async) { debounce(listen, args, thing); } else { listen.apply(thing, args); }
        return !listen._once;
      });
    };
    return thing;
  }

  function _queue (worker, concurrency) {
    var q = [], load = 0, max = concurrency || 1, paused;
    var qq = _emitter({
      push: manipulate.bind(null, 'push'),
      unshift: manipulate.bind(null, 'unshift'),
      pause: function () { paused = true; },
      resume: function () { paused = false; debounce(labor); },
      pending: q
    });
    if (Object.defineProperty && !Object.definePropertyPartial) {
      Object.defineProperty(qq, 'length', { get: function () { return q.length; } });
    }
    function manipulate (how, task, done) {
      var tasks = a(task) ? task : [task];
      tasks.forEach(function insert (t) { q[how]({ t: t, done: done }); });
      debounce(labor);
    }
    function labor () {
      if (paused || load >= max) { return; }
      if (!q.length) { if (load === 0) { qq.emit('drain'); } return; }
      load++;
      var job = q.pop();
      worker(job.t, once(complete.bind(null, job)));
      debounce(labor);
    }
    function complete (job) {
      load--;
      debounce(job.done, atoa(arguments, 1));
      debounce(labor);
    }
    return qq;
  }

  var contra = {
    curry: _curry,
    concurrent: _concurrent,
    series: _series,
    waterfall: _waterfall,
    each: _each(),
    map: _map(),
    filter: _filter(),
    queue: _queue,
    emitter: _emitter
  };

  // cross-platform export
  if (typeof module !== undef && module.exports) {
    module.exports = contra;
  } else {
    root.contra = contra;
  }
})(Object, this);

}).call(this,_dereq_("/Users/nico/.nvm/v0.10.26/lib/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"/Users/nico/.nvm/v0.10.26/lib/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":1}],4:[function(_dereq_,module,exports){
var now = _dereq_('performance-now')
  , global = typeof window === 'undefined' ? {} : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = global['request' + suffix]
  , caf = global['cancel' + suffix] || global['cancelRequest' + suffix]

for(var i = 0; i < vendors.length && !raf; i++) {
  raf = global[vendors[i] + 'Request' + suffix]
  caf = global[vendors[i] + 'Cancel' + suffix]
      || global[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
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
        for (var i = 0; i < cp.length; i++) {
          if (!cp[i].cancelled) {
            cp[i].callback(last)
          }
        }
      }, next)
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

module.exports = function() {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  return raf.apply(global, arguments)
}
module.exports.cancel = function() {
  caf.apply(global, arguments)
}

},{"performance-now":5}],5:[function(_dereq_,module,exports){
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
//@ sourceMappingURL=performance-now.map
*/

}).call(this,_dereq_("/Users/nico/.nvm/v0.10.26/lib/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"/Users/nico/.nvm/v0.10.26/lib/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":1}],6:[function(_dereq_,module,exports){
var window = _dereq_("global/window")
var once = _dereq_("once")

var messages = {
    "0": "Internal XMLHttpRequest Error",
    "4": "4xx Client Error",
    "5": "5xx Server Error"
}

var XHR = window.XMLHttpRequest || noop
var XDR = "withCredentials" in (new XHR()) ?
        window.XMLHttpRequest : window.XDomainRequest

module.exports = createXHR

function createXHR(options, callback) {
    if (typeof options === "string") {
        options = { uri: options }
    }

    options = options || {}
    callback = once(callback)

    var xhr = options.xhr || null

    if (!xhr && options.cors) {
        xhr = new XDR()
    } else if (!xhr) {
        xhr = new XHR()
    }

    var uri = xhr.url = options.uri || options.url;
    var method = xhr.method = options.method || "GET"
    var body = options.body || options.data
    var headers = xhr.headers = options.headers || {}
    var sync = !!options.sync
    var isJson = false
    var key

    if ("json" in options) {
        isJson = true
        headers["Accept"] = "application/json"
        if (method !== "GET" && method !== "HEAD") {
            headers["Content-Type"] = "application/json"
            body = JSON.stringify(options.json)
        }
    }

    xhr.onreadystatechange = readystatechange
    xhr.onload = load
    xhr.onerror = error
    // IE9 must have onprogress be set to a unique function.
    xhr.onprogress = function () {
        // IE must die
    }
    // hate IE
    xhr.ontimeout = noop
    xhr.open(method, uri, !sync)

    if (options.cors && options.withCredentials !== false) {
        xhr.withCredentials = true
    }

    // Cannot set timeout with sync request
    if (!sync) {
        xhr.timeout = "timeout" in options ? options.timeout : 5000
    }

    if (xhr.setRequestHeader) {
        for(key in headers){
            if(headers.hasOwnProperty(key)){
                xhr.setRequestHeader(key, headers[key])
            }
        }
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

    function readystatechange() {
        if (xhr.readyState === 4) {
            load()
        }
    }

    function load() {
        var error = null
        var status = xhr.statusCode = xhr.status
        // Chrome with requestType=blob throws errors arround when even testing access to responseText
        var body = null

        if (xhr.response) {
            body = xhr.body = xhr.response
        } else if (xhr.responseType === 'text' || !xhr.responseType) {
            body = xhr.body = xhr.responseText || xhr.responseXML
        }

        if (status === 1223) {
            status = 204
        }

        if (status === 0 || (status >= 400 && status < 600)) {
            var message = (typeof body === "string" ? body : false) ||
                messages[String(status).charAt(0)]
            error = new Error(message)
            error.statusCode = status
        }
        
        xhr.status = xhr.statusCode = status;

        if (isJson) {
            try {
                body = xhr.body = JSON.parse(body)
            } catch (e) {}
        }

        callback(error, xhr, body)
    }

    function error(evt) {
        callback(evt, xhr)
    }
}


function noop() {}

},{"global/window":7,"once":8}],7:[function(_dereq_,module,exports){
(function (global){
if (typeof window !== "undefined") {
    module.exports = window
} else if (typeof global !== "undefined") {
    module.exports = global
} else {
    module.exports = {}
}

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],8:[function(_dereq_,module,exports){
module.exports = once

once.proto = once(function () {
  Object.defineProperty(Function.prototype, 'once', {
    value: function () {
      return once(this)
    },
    configurable: true
  })
})

function once (fn) {
  var called = false
  return function () {
    if (called) return
    called = true
    return fn.apply(this, arguments)
  }
}

},{}],9:[function(_dereq_,module,exports){
'use strict';

function aggregate (context, clear) {
  var result = context.requests.concat(context.children.reduce(expand, []));
  if (clear) {
    context.requests = [];
  }
  return result;
}

function expand (accumulator, child) {
  accumulator.push.apply(accumulator, aggregate(child));
  return accumulator;
}

module.exports = aggregate;

},{}],10:[function(_dereq_,module,exports){
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

},{}],11:[function(_dereq_,module,exports){
'use strict';

module.exports = function (emitter, context, types) {
  types.forEach(function through (type) {
    emitter.on(type, raise.bind(emitter, type));
  });

  function raise (type) {
    var args = Array.prototype.slice.call(arguments);
    var all = [type].concat(args);
    var ctx = context;

    while (ctx) {
      ctx.emit.apply(emitter, all);
      ctx = ctx.parent;
    }
  }
};

},{}],12:[function(_dereq_,module,exports){
(function (global){
'use strict';

var raf = _dereq_('raf');
var xhr = _dereq_('xhr');
var contra = _dereq_('contra');
var cache = _dereq_('./cache');
var aggregate = _dereq_('./aggregate');
var emitUpstream = _dereq_('./emitUpstream');
var methods = ['get', 'post', 'put', 'delete', 'patch'];
var stateEvents = ['create', 'cache', 'request', 'abort', 'error', 'data', 'always'];

function measly (measlyOptions, parent) {
  var layer = contra.emitter({
    thinner: thinner,
    parent: parent,
    context: measlyOptions.context,
    children: [],
    requests: [],
    cache: {},
    abort: abort,
    request: request
  });

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
      cache: fireOptions.cache || measlyOptions.cache
    });
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
    aggregate(layer, true).forEach(abortRequest);
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

module.exports = measly({
  context: global.document.body,
  base: ''
});

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./aggregate":9,"./cache":10,"./emitUpstream":11,"contra":2,"raf":4,"xhr":6}]},{},[12])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvbmljby8ubnZtL3YwLjEwLjI2L2xpYi9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL1VzZXJzL25pY28vLm52bS92MC4xMC4yNi9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2luc2VydC1tb2R1bGUtZ2xvYmFscy9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwiL1VzZXJzL25pY28vbmljby9naXQvbWVhc2x5L25vZGVfbW9kdWxlcy9jb250cmEvaW5kZXguanMiLCIvVXNlcnMvbmljby9uaWNvL2dpdC9tZWFzbHkvbm9kZV9tb2R1bGVzL2NvbnRyYS9zcmMvY29udHJhLmpzIiwiL1VzZXJzL25pY28vbmljby9naXQvbWVhc2x5L25vZGVfbW9kdWxlcy9yYWYvaW5kZXguanMiLCIvVXNlcnMvbmljby9uaWNvL2dpdC9tZWFzbHkvbm9kZV9tb2R1bGVzL3JhZi9ub2RlX21vZHVsZXMvcGVyZm9ybWFuY2Utbm93L2xpYi9wZXJmb3JtYW5jZS1ub3cuanMiLCIvVXNlcnMvbmljby9uaWNvL2dpdC9tZWFzbHkvbm9kZV9tb2R1bGVzL3hoci9pbmRleC5qcyIsIi9Vc2Vycy9uaWNvL25pY28vZ2l0L21lYXNseS9ub2RlX21vZHVsZXMveGhyL25vZGVfbW9kdWxlcy9nbG9iYWwvd2luZG93LmpzIiwiL1VzZXJzL25pY28vbmljby9naXQvbWVhc2x5L25vZGVfbW9kdWxlcy94aHIvbm9kZV9tb2R1bGVzL29uY2Uvb25jZS5qcyIsIi9Vc2Vycy9uaWNvL25pY28vZ2l0L21lYXNseS9zcmMvYWdncmVnYXRlLmpzIiwiL1VzZXJzL25pY28vbmljby9naXQvbWVhc2x5L3NyYy9jYWNoZS5qcyIsIi9Vc2Vycy9uaWNvL25pY28vZ2l0L21lYXNseS9zcmMvZW1pdFVwc3RyZWFtLmpzIiwiL1VzZXJzL25pY28vbmljby9naXQvbWVhc2x5L3NyYy9tZWFzbHkuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1REE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9OQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhblBvc3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5wb3N0TWVzc2FnZSAmJiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lclxuICAgIDtcblxuICAgIGlmIChjYW5TZXRJbW1lZGlhdGUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmKSB7IHJldHVybiB3aW5kb3cuc2V0SW1tZWRpYXRlKGYpIH07XG4gICAgfVxuXG4gICAgaWYgKGNhblBvc3QpIHtcbiAgICAgICAgdmFyIHF1ZXVlID0gW107XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICB2YXIgc291cmNlID0gZXYuc291cmNlO1xuICAgICAgICAgICAgaWYgKChzb3VyY2UgPT09IHdpbmRvdyB8fCBzb3VyY2UgPT09IG51bGwpICYmIGV2LmRhdGEgPT09ICdwcm9jZXNzLXRpY2snKSB7XG4gICAgICAgICAgICAgICAgZXYuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZuID0gcXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgZm4oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2UoJ3Byb2Nlc3MtdGljaycsICcqJyk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZm4sIDApO1xuICAgIH07XG59KSgpO1xuXG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufVxuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vc3JjL2NvbnRyYS5qcycpO1xuIiwiKGZ1bmN0aW9uIChwcm9jZXNzKXtcbihmdW5jdGlvbiAoT2JqZWN0LCByb290LCB1bmRlZmluZWQpIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIHZhciB1bmRlZiA9ICcnICsgdW5kZWZpbmVkO1xuICB2YXIgU0VSSUFMID0gMTtcbiAgdmFyIENPTkNVUlJFTlQgPSBJbmZpbml0eTtcblxuICBmdW5jdGlvbiBub29wICgpIHt9XG4gIGZ1bmN0aW9uIGEgKG8pIHsgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvKSA9PT0gJ1tvYmplY3QgQXJyYXldJzsgfVxuICBmdW5jdGlvbiBhdG9hIChhLCBuKSB7IHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhLCBuKTsgfVxuICBmdW5jdGlvbiBkZWJvdW5jZSAoZm4sIGFyZ3MsIGN0eCkgeyBpZiAoIWZuKSB7IHJldHVybjsgfSB0aWNrKGZ1bmN0aW9uIHJ1biAoKSB7IGZuLmFwcGx5KGN0eCB8fCBudWxsLCBhcmdzIHx8IFtdKTsgfSk7IH1cbiAgZnVuY3Rpb24gb25jZSAoZm4pIHtcbiAgICB2YXIgZGlzcG9zZWQ7XG4gICAgZnVuY3Rpb24gZGlzcG9zYWJsZSAoKSB7XG4gICAgICBpZiAoZGlzcG9zZWQpIHsgcmV0dXJuOyB9XG4gICAgICBkaXNwb3NlZCA9IHRydWU7XG4gICAgICAoZm4gfHwgbm9vcCkuYXBwbHkobnVsbCwgYXJndW1lbnRzKTtcbiAgICB9XG4gICAgZGlzcG9zYWJsZS5kaXNjYXJkID0gZnVuY3Rpb24gKCkgeyBkaXNwb3NlZCA9IHRydWU7IH07XG4gICAgcmV0dXJuIGRpc3Bvc2FibGU7XG4gIH1cbiAgZnVuY3Rpb24gaGFuZGxlIChhcmdzLCBkb25lLCBkaXNwb3NhYmxlKSB7XG4gICAgdmFyIGVyciA9IGFyZ3Muc2hpZnQoKTtcbiAgICBpZiAoZXJyKSB7IGlmIChkaXNwb3NhYmxlKSB7IGRpc3Bvc2FibGUuZGlzY2FyZCgpOyB9IGRlYm91bmNlKGRvbmUsIFtlcnJdKTsgcmV0dXJuIHRydWU7IH1cbiAgfVxuXG4gIC8vIGNyb3NzLXBsYXRmb3JtIHRpY2tlclxuICB2YXIgc2kgPSB0eXBlb2Ygc2V0SW1tZWRpYXRlID09PSAnZnVuY3Rpb24nLCB0aWNrO1xuICBpZiAoc2kpIHtcbiAgICB0aWNrID0gZnVuY3Rpb24gKGZuKSB7IHNldEltbWVkaWF0ZShmbik7IH07XG4gIH0gZWxzZSBpZiAodHlwZW9mIHByb2Nlc3MgIT09IHVuZGVmICYmIHByb2Nlc3MubmV4dFRpY2spIHtcbiAgICB0aWNrID0gcHJvY2Vzcy5uZXh0VGljaztcbiAgfSBlbHNlIHtcbiAgICB0aWNrID0gZnVuY3Rpb24gKGZuKSB7IHNldFRpbWVvdXQoZm4sIDApOyB9O1xuICB9XG5cbiAgZnVuY3Rpb24gX2N1cnJ5ICgpIHtcbiAgICB2YXIgYXJncyA9IGF0b2EoYXJndW1lbnRzKTtcbiAgICB2YXIgbWV0aG9kID0gYXJncy5zaGlmdCgpO1xuICAgIHJldHVybiBmdW5jdGlvbiBjdXJyaWVkICgpIHtcbiAgICAgIHZhciBtb3JlID0gYXRvYShhcmd1bWVudHMpO1xuICAgICAgbWV0aG9kLmFwcGx5KG1ldGhvZCwgYXJncy5jb25jYXQobW9yZSkpO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBfd2F0ZXJmYWxsIChzdGVwcywgZG9uZSkge1xuICAgIHZhciBkID0gb25jZShkb25lKTtcbiAgICBmdW5jdGlvbiBuZXh0ICgpIHtcbiAgICAgIHZhciBhcmdzID0gYXRvYShhcmd1bWVudHMpO1xuICAgICAgdmFyIHN0ZXAgPSBzdGVwcy5zaGlmdCgpO1xuICAgICAgaWYgKHN0ZXApIHtcbiAgICAgICAgaWYgKGhhbmRsZShhcmdzLCBkKSkgeyByZXR1cm47IH1cbiAgICAgICAgYXJncy5wdXNoKG9uY2UobmV4dCkpO1xuICAgICAgICBkZWJvdW5jZShzdGVwLCBhcmdzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlYm91bmNlKGQsIGFyZ3VtZW50cyk7XG4gICAgICB9XG4gICAgfVxuICAgIG5leHQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIF9jb25jdXJyZW50ICh0YXNrcywgY29uY3VycmVuY3ksIGRvbmUpIHtcbiAgICBpZiAoIWRvbmUpIHsgZG9uZSA9IGNvbmN1cnJlbmN5OyBjb25jdXJyZW5jeSA9IENPTkNVUlJFTlQ7IH1cbiAgICB2YXIgZCA9IG9uY2UoZG9uZSk7XG4gICAgdmFyIHEgPSBfcXVldWUod29ya2VyLCBjb25jdXJyZW5jeSk7XG4gICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh0YXNrcyk7XG4gICAgdmFyIHJlc3VsdHMgPSBhKHRhc2tzKSA/IFtdIDoge307XG4gICAgcS51bnNoaWZ0KGtleXMpO1xuICAgIHEub24oJ2RyYWluJywgZnVuY3Rpb24gY29tcGxldGVkICgpIHsgZChudWxsLCByZXN1bHRzKTsgfSk7XG4gICAgZnVuY3Rpb24gd29ya2VyIChrZXksIG5leHQpIHtcbiAgICAgIGRlYm91bmNlKHRhc2tzW2tleV0sIFtwcm9jZWVkXSk7XG4gICAgICBmdW5jdGlvbiBwcm9jZWVkICgpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSBhdG9hKGFyZ3VtZW50cyk7XG4gICAgICAgIGlmIChoYW5kbGUoYXJncywgZCkpIHsgcmV0dXJuOyB9XG4gICAgICAgIHJlc3VsdHNba2V5XSA9IGFyZ3Muc2hpZnQoKTtcbiAgICAgICAgbmV4dCgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIF9zZXJpZXMgKHRhc2tzLCBkb25lKSB7XG4gICAgX2NvbmN1cnJlbnQodGFza3MsIFNFUklBTCwgZG9uZSk7XG4gIH1cblxuICBmdW5jdGlvbiBfbWFwIChjYXAsIHRoZW4sIGF0dGFjaGVkKSB7XG4gICAgdmFyIG1hcCA9IGZ1bmN0aW9uIChjb2xsZWN0aW9uLCBjb25jdXJyZW5jeSwgaXRlcmF0b3IsIGRvbmUpIHtcbiAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgaWYgKGFyZ3MubGVuZ3RoID09PSAyKSB7IGl0ZXJhdG9yID0gY29uY3VycmVuY3k7IGNvbmN1cnJlbmN5ID0gQ09OQ1VSUkVOVDsgfVxuICAgICAgaWYgKGFyZ3MubGVuZ3RoID09PSAzICYmIHR5cGVvZiBjb25jdXJyZW5jeSAhPT0gJ251bWJlcicpIHsgZG9uZSA9IGl0ZXJhdG9yOyBpdGVyYXRvciA9IGNvbmN1cnJlbmN5OyBjb25jdXJyZW5jeSA9IENPTkNVUlJFTlQ7IH1cbiAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoY29sbGVjdGlvbik7XG4gICAgICB2YXIgdGFza3MgPSBhKGNvbGxlY3Rpb24pID8gW10gOiB7fTtcbiAgICAgIGtleXMuZm9yRWFjaChmdW5jdGlvbiBpbnNlcnQgKGtleSkge1xuICAgICAgICB0YXNrc1trZXldID0gZnVuY3Rpb24gaXRlcmF0ZSAoY2IpIHtcbiAgICAgICAgICBpZiAoaXRlcmF0b3IubGVuZ3RoID09PSAzKSB7XG4gICAgICAgICAgICBpdGVyYXRvcihjb2xsZWN0aW9uW2tleV0sIGtleSwgY2IpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpdGVyYXRvcihjb2xsZWN0aW9uW2tleV0sIGNiKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICAgIF9jb25jdXJyZW50KHRhc2tzLCBjYXAgfHwgY29uY3VycmVuY3ksIHRoZW4gPyB0aGVuKGNvbGxlY3Rpb24sIGRvbmUpIDogZG9uZSk7XG4gICAgfTtcbiAgICBpZiAoIWF0dGFjaGVkKSB7IG1hcC5zZXJpZXMgPSBfbWFwKFNFUklBTCwgdGhlbiwgdHJ1ZSk7IH1cbiAgICByZXR1cm4gbWFwO1xuICB9XG5cbiAgZnVuY3Rpb24gX2VhY2ggKGNvbmN1cnJlbmN5KSB7XG4gICAgcmV0dXJuIF9tYXAoY29uY3VycmVuY3ksIHRoZW4pO1xuICAgIGZ1bmN0aW9uIHRoZW4gKGNvbGxlY3Rpb24sIGRvbmUpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbiBtYXNrIChlcnIpIHtcbiAgICAgICAgZG9uZShlcnIpOyAvLyBvbmx5IHJldHVybiB0aGUgZXJyb3IsIG5vIG1vcmUgYXJndW1lbnRzXG4gICAgICB9O1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIF9maWx0ZXIgKGNvbmN1cnJlbmN5KSB7XG4gICAgcmV0dXJuIF9tYXAoY29uY3VycmVuY3ksIHRoZW4pO1xuICAgIGZ1bmN0aW9uIHRoZW4gKGNvbGxlY3Rpb24sIGRvbmUpIHtcbiAgICAgIHJldHVybiBmdW5jdGlvbiBmaWx0ZXIgKGVyciwgcmVzdWx0cykge1xuICAgICAgICBmdW5jdGlvbiBleGlzdHMgKGl0ZW0sIGtleSkge1xuICAgICAgICAgIHJldHVybiAhIXJlc3VsdHNba2V5XTtcbiAgICAgICAgfVxuICAgICAgICBmdW5jdGlvbiBvZmlsdGVyICgpIHtcbiAgICAgICAgICB2YXIgZmlsdGVyZWQgPSB7fTtcbiAgICAgICAgICBPYmplY3Qua2V5cyhjb2xsZWN0aW9uKS5mb3JFYWNoKGZ1bmN0aW9uIG9tYXBwZXIgKGtleSkge1xuICAgICAgICAgICAgaWYgKGV4aXN0cyhudWxsLCBrZXkpKSB7IGZpbHRlcmVkW2tleV0gPSBjb2xsZWN0aW9uW2tleV07IH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm4gZmlsdGVyZWQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGVycikgeyBkb25lKGVycik7IHJldHVybjsgfVxuICAgICAgICBkb25lKG51bGwsIGEocmVzdWx0cykgPyBjb2xsZWN0aW9uLmZpbHRlcihleGlzdHMpIDogb2ZpbHRlcigpKTtcbiAgICAgIH07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gX2VtaXR0ZXIgKHRoaW5nLCBvcHRpb25zKSB7XG4gICAgdmFyIG9wdHMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciBldnQgPSB7fTtcbiAgICBpZiAodGhpbmcgPT09IHVuZGVmaW5lZCkgeyB0aGluZyA9IHt9OyB9XG4gICAgdGhpbmcub24gPSBmdW5jdGlvbiAodHlwZSwgZm4pIHtcbiAgICAgIGlmICghZXZ0W3R5cGVdKSB7XG4gICAgICAgIGV2dFt0eXBlXSA9IFtmbl07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBldnRbdHlwZV0ucHVzaChmbik7XG4gICAgICB9XG4gICAgfTtcbiAgICB0aGluZy5vbmNlID0gZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgICBmbi5fb25jZSA9IHRydWU7IC8vIHRoaW5nLm9mZihmbikgc3RpbGwgd29ya3MhXG4gICAgICB0aGluZy5vbih0eXBlLCBmbik7XG4gICAgfTtcbiAgICB0aGluZy5vZmYgPSBmdW5jdGlvbiAodHlwZSwgZm4pIHtcbiAgICAgIHZhciBldCA9IGV2dFt0eXBlXTtcbiAgICAgIGlmICghZXQpIHsgcmV0dXJuOyB9XG4gICAgICBldC5zcGxpY2UoZXQuaW5kZXhPZihmbiksIDEpO1xuICAgIH07XG4gICAgdGhpbmcuZW1pdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBhcmdzID0gYXRvYShhcmd1bWVudHMpO1xuICAgICAgdmFyIHR5cGUgPSBhcmdzLnNoaWZ0KCk7XG4gICAgICB2YXIgZXQgPSBldnRbdHlwZV07XG4gICAgICBpZiAodHlwZSA9PT0gJ2Vycm9yJyAmJiAhZXQpIHsgdGhyb3cgYXJncy5sZW5ndGggPT09IDEgPyBhcmdzWzBdIDogYXJnczsgfVxuICAgICAgaWYgKCFldCkgeyByZXR1cm47IH1cbiAgICAgIGV2dFt0eXBlXSA9IGV0LmZpbHRlcihmdW5jdGlvbiBlbWl0dGVyIChsaXN0ZW4pIHtcbiAgICAgICAgaWYgKG9wdHMuYXN5bmMpIHsgZGVib3VuY2UobGlzdGVuLCBhcmdzLCB0aGluZyk7IH0gZWxzZSB7IGxpc3Rlbi5hcHBseSh0aGluZywgYXJncyk7IH1cbiAgICAgICAgcmV0dXJuICFsaXN0ZW4uX29uY2U7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHJldHVybiB0aGluZztcbiAgfVxuXG4gIGZ1bmN0aW9uIF9xdWV1ZSAod29ya2VyLCBjb25jdXJyZW5jeSkge1xuICAgIHZhciBxID0gW10sIGxvYWQgPSAwLCBtYXggPSBjb25jdXJyZW5jeSB8fCAxLCBwYXVzZWQ7XG4gICAgdmFyIHFxID0gX2VtaXR0ZXIoe1xuICAgICAgcHVzaDogbWFuaXB1bGF0ZS5iaW5kKG51bGwsICdwdXNoJyksXG4gICAgICB1bnNoaWZ0OiBtYW5pcHVsYXRlLmJpbmQobnVsbCwgJ3Vuc2hpZnQnKSxcbiAgICAgIHBhdXNlOiBmdW5jdGlvbiAoKSB7IHBhdXNlZCA9IHRydWU7IH0sXG4gICAgICByZXN1bWU6IGZ1bmN0aW9uICgpIHsgcGF1c2VkID0gZmFsc2U7IGRlYm91bmNlKGxhYm9yKTsgfSxcbiAgICAgIHBlbmRpbmc6IHFcbiAgICB9KTtcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5ICYmICFPYmplY3QuZGVmaW5lUHJvcGVydHlQYXJ0aWFsKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkocXEsICdsZW5ndGgnLCB7IGdldDogZnVuY3Rpb24gKCkgeyByZXR1cm4gcS5sZW5ndGg7IH0gfSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG1hbmlwdWxhdGUgKGhvdywgdGFzaywgZG9uZSkge1xuICAgICAgdmFyIHRhc2tzID0gYSh0YXNrKSA/IHRhc2sgOiBbdGFza107XG4gICAgICB0YXNrcy5mb3JFYWNoKGZ1bmN0aW9uIGluc2VydCAodCkgeyBxW2hvd10oeyB0OiB0LCBkb25lOiBkb25lIH0pOyB9KTtcbiAgICAgIGRlYm91bmNlKGxhYm9yKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gbGFib3IgKCkge1xuICAgICAgaWYgKHBhdXNlZCB8fCBsb2FkID49IG1heCkgeyByZXR1cm47IH1cbiAgICAgIGlmICghcS5sZW5ndGgpIHsgaWYgKGxvYWQgPT09IDApIHsgcXEuZW1pdCgnZHJhaW4nKTsgfSByZXR1cm47IH1cbiAgICAgIGxvYWQrKztcbiAgICAgIHZhciBqb2IgPSBxLnBvcCgpO1xuICAgICAgd29ya2VyKGpvYi50LCBvbmNlKGNvbXBsZXRlLmJpbmQobnVsbCwgam9iKSkpO1xuICAgICAgZGVib3VuY2UobGFib3IpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjb21wbGV0ZSAoam9iKSB7XG4gICAgICBsb2FkLS07XG4gICAgICBkZWJvdW5jZShqb2IuZG9uZSwgYXRvYShhcmd1bWVudHMsIDEpKTtcbiAgICAgIGRlYm91bmNlKGxhYm9yKTtcbiAgICB9XG4gICAgcmV0dXJuIHFxO1xuICB9XG5cbiAgdmFyIGNvbnRyYSA9IHtcbiAgICBjdXJyeTogX2N1cnJ5LFxuICAgIGNvbmN1cnJlbnQ6IF9jb25jdXJyZW50LFxuICAgIHNlcmllczogX3NlcmllcyxcbiAgICB3YXRlcmZhbGw6IF93YXRlcmZhbGwsXG4gICAgZWFjaDogX2VhY2goKSxcbiAgICBtYXA6IF9tYXAoKSxcbiAgICBmaWx0ZXI6IF9maWx0ZXIoKSxcbiAgICBxdWV1ZTogX3F1ZXVlLFxuICAgIGVtaXR0ZXI6IF9lbWl0dGVyXG4gIH07XG5cbiAgLy8gY3Jvc3MtcGxhdGZvcm0gZXhwb3J0XG4gIGlmICh0eXBlb2YgbW9kdWxlICE9PSB1bmRlZiAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gY29udHJhO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuY29udHJhID0gY29udHJhO1xuICB9XG59KShPYmplY3QsIHRoaXMpO1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZShcIi9Vc2Vycy9uaWNvLy5udm0vdjAuMTAuMjYvbGliL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9pbnNlcnQtbW9kdWxlLWdsb2JhbHMvbm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qc1wiKSkiLCJ2YXIgbm93ID0gcmVxdWlyZSgncGVyZm9ybWFuY2Utbm93JylcbiAgLCBnbG9iYWwgPSB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJyA/IHt9IDogd2luZG93XG4gICwgdmVuZG9ycyA9IFsnbW96JywgJ3dlYmtpdCddXG4gICwgc3VmZml4ID0gJ0FuaW1hdGlvbkZyYW1lJ1xuICAsIHJhZiA9IGdsb2JhbFsncmVxdWVzdCcgKyBzdWZmaXhdXG4gICwgY2FmID0gZ2xvYmFsWydjYW5jZWwnICsgc3VmZml4XSB8fCBnbG9iYWxbJ2NhbmNlbFJlcXVlc3QnICsgc3VmZml4XVxuXG5mb3IodmFyIGkgPSAwOyBpIDwgdmVuZG9ycy5sZW5ndGggJiYgIXJhZjsgaSsrKSB7XG4gIHJhZiA9IGdsb2JhbFt2ZW5kb3JzW2ldICsgJ1JlcXVlc3QnICsgc3VmZml4XVxuICBjYWYgPSBnbG9iYWxbdmVuZG9yc1tpXSArICdDYW5jZWwnICsgc3VmZml4XVxuICAgICAgfHwgZ2xvYmFsW3ZlbmRvcnNbaV0gKyAnQ2FuY2VsUmVxdWVzdCcgKyBzdWZmaXhdXG59XG5cbi8vIFNvbWUgdmVyc2lvbnMgb2YgRkYgaGF2ZSByQUYgYnV0IG5vdCBjQUZcbmlmKCFyYWYgfHwgIWNhZikge1xuICB2YXIgbGFzdCA9IDBcbiAgICAsIGlkID0gMFxuICAgICwgcXVldWUgPSBbXVxuICAgICwgZnJhbWVEdXJhdGlvbiA9IDEwMDAgLyA2MFxuXG4gIHJhZiA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgaWYocXVldWUubGVuZ3RoID09PSAwKSB7XG4gICAgICB2YXIgX25vdyA9IG5vdygpXG4gICAgICAgICwgbmV4dCA9IE1hdGgubWF4KDAsIGZyYW1lRHVyYXRpb24gLSAoX25vdyAtIGxhc3QpKVxuICAgICAgbGFzdCA9IG5leHQgKyBfbm93XG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgY3AgPSBxdWV1ZS5zbGljZSgwKVxuICAgICAgICAvLyBDbGVhciBxdWV1ZSBoZXJlIHRvIHByZXZlbnRcbiAgICAgICAgLy8gY2FsbGJhY2tzIGZyb20gYXBwZW5kaW5nIGxpc3RlbmVyc1xuICAgICAgICAvLyB0byB0aGUgY3VycmVudCBmcmFtZSdzIHF1ZXVlXG4gICAgICAgIHF1ZXVlLmxlbmd0aCA9IDBcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjcC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmICghY3BbaV0uY2FuY2VsbGVkKSB7XG4gICAgICAgICAgICBjcFtpXS5jYWxsYmFjayhsYXN0KVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSwgbmV4dClcbiAgICB9XG4gICAgcXVldWUucHVzaCh7XG4gICAgICBoYW5kbGU6ICsraWQsXG4gICAgICBjYWxsYmFjazogY2FsbGJhY2ssXG4gICAgICBjYW5jZWxsZWQ6IGZhbHNlXG4gICAgfSlcbiAgICByZXR1cm4gaWRcbiAgfVxuXG4gIGNhZiA9IGZ1bmN0aW9uKGhhbmRsZSkge1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYocXVldWVbaV0uaGFuZGxlID09PSBoYW5kbGUpIHtcbiAgICAgICAgcXVldWVbaV0uY2FuY2VsbGVkID0gdHJ1ZVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAvLyBXcmFwIGluIGEgbmV3IGZ1bmN0aW9uIHRvIHByZXZlbnRcbiAgLy8gYGNhbmNlbGAgcG90ZW50aWFsbHkgYmVpbmcgYXNzaWduZWRcbiAgLy8gdG8gdGhlIG5hdGl2ZSByQUYgZnVuY3Rpb25cbiAgcmV0dXJuIHJhZi5hcHBseShnbG9iYWwsIGFyZ3VtZW50cylcbn1cbm1vZHVsZS5leHBvcnRzLmNhbmNlbCA9IGZ1bmN0aW9uKCkge1xuICBjYWYuYXBwbHkoZ2xvYmFsLCBhcmd1bWVudHMpXG59XG4iLCIoZnVuY3Rpb24gKHByb2Nlc3Mpe1xuLy8gR2VuZXJhdGVkIGJ5IENvZmZlZVNjcmlwdCAxLjYuM1xuKGZ1bmN0aW9uKCkge1xuICB2YXIgZ2V0TmFub1NlY29uZHMsIGhydGltZSwgbG9hZFRpbWU7XG5cbiAgaWYgKCh0eXBlb2YgcGVyZm9ybWFuY2UgIT09IFwidW5kZWZpbmVkXCIgJiYgcGVyZm9ybWFuY2UgIT09IG51bGwpICYmIHBlcmZvcm1hbmNlLm5vdykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgfTtcbiAgfSBlbHNlIGlmICgodHlwZW9mIHByb2Nlc3MgIT09IFwidW5kZWZpbmVkXCIgJiYgcHJvY2VzcyAhPT0gbnVsbCkgJiYgcHJvY2Vzcy5ocnRpbWUpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIChnZXROYW5vU2Vjb25kcygpIC0gbG9hZFRpbWUpIC8gMWU2O1xuICAgIH07XG4gICAgaHJ0aW1lID0gcHJvY2Vzcy5ocnRpbWU7XG4gICAgZ2V0TmFub1NlY29uZHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBocjtcbiAgICAgIGhyID0gaHJ0aW1lKCk7XG4gICAgICByZXR1cm4gaHJbMF0gKiAxZTkgKyBoclsxXTtcbiAgICB9O1xuICAgIGxvYWRUaW1lID0gZ2V0TmFub1NlY29uZHMoKTtcbiAgfSBlbHNlIGlmIChEYXRlLm5vdykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gRGF0ZS5ub3coKSAtIGxvYWRUaW1lO1xuICAgIH07XG4gICAgbG9hZFRpbWUgPSBEYXRlLm5vdygpO1xuICB9IGVsc2Uge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSBsb2FkVGltZTtcbiAgICB9O1xuICAgIGxvYWRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gIH1cblxufSkuY2FsbCh0aGlzKTtcblxuLypcbi8vQCBzb3VyY2VNYXBwaW5nVVJMPXBlcmZvcm1hbmNlLW5vdy5tYXBcbiovXG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKFwiL1VzZXJzL25pY28vLm52bS92MC4xMC4yNi9saWIvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbm9kZV9tb2R1bGVzL2luc2VydC1tb2R1bGUtZ2xvYmFscy9ub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzXCIpKSIsInZhciB3aW5kb3cgPSByZXF1aXJlKFwiZ2xvYmFsL3dpbmRvd1wiKVxudmFyIG9uY2UgPSByZXF1aXJlKFwib25jZVwiKVxuXG52YXIgbWVzc2FnZXMgPSB7XG4gICAgXCIwXCI6IFwiSW50ZXJuYWwgWE1MSHR0cFJlcXVlc3QgRXJyb3JcIixcbiAgICBcIjRcIjogXCI0eHggQ2xpZW50IEVycm9yXCIsXG4gICAgXCI1XCI6IFwiNXh4IFNlcnZlciBFcnJvclwiXG59XG5cbnZhciBYSFIgPSB3aW5kb3cuWE1MSHR0cFJlcXVlc3QgfHwgbm9vcFxudmFyIFhEUiA9IFwid2l0aENyZWRlbnRpYWxzXCIgaW4gKG5ldyBYSFIoKSkgP1xuICAgICAgICB3aW5kb3cuWE1MSHR0cFJlcXVlc3QgOiB3aW5kb3cuWERvbWFpblJlcXVlc3RcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVYSFJcblxuZnVuY3Rpb24gY3JlYXRlWEhSKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIG9wdGlvbnMgPSB7IHVyaTogb3B0aW9ucyB9XG4gICAgfVxuXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgICBjYWxsYmFjayA9IG9uY2UoY2FsbGJhY2spXG5cbiAgICB2YXIgeGhyID0gb3B0aW9ucy54aHIgfHwgbnVsbFxuXG4gICAgaWYgKCF4aHIgJiYgb3B0aW9ucy5jb3JzKSB7XG4gICAgICAgIHhociA9IG5ldyBYRFIoKVxuICAgIH0gZWxzZSBpZiAoIXhocikge1xuICAgICAgICB4aHIgPSBuZXcgWEhSKClcbiAgICB9XG5cbiAgICB2YXIgdXJpID0geGhyLnVybCA9IG9wdGlvbnMudXJpIHx8IG9wdGlvbnMudXJsO1xuICAgIHZhciBtZXRob2QgPSB4aHIubWV0aG9kID0gb3B0aW9ucy5tZXRob2QgfHwgXCJHRVRcIlxuICAgIHZhciBib2R5ID0gb3B0aW9ucy5ib2R5IHx8IG9wdGlvbnMuZGF0YVxuICAgIHZhciBoZWFkZXJzID0geGhyLmhlYWRlcnMgPSBvcHRpb25zLmhlYWRlcnMgfHwge31cbiAgICB2YXIgc3luYyA9ICEhb3B0aW9ucy5zeW5jXG4gICAgdmFyIGlzSnNvbiA9IGZhbHNlXG4gICAgdmFyIGtleVxuXG4gICAgaWYgKFwianNvblwiIGluIG9wdGlvbnMpIHtcbiAgICAgICAgaXNKc29uID0gdHJ1ZVxuICAgICAgICBoZWFkZXJzW1wiQWNjZXB0XCJdID0gXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgaWYgKG1ldGhvZCAhPT0gXCJHRVRcIiAmJiBtZXRob2QgIT09IFwiSEVBRFwiKSB7XG4gICAgICAgICAgICBoZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdID0gXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgICAgIGJvZHkgPSBKU09OLnN0cmluZ2lmeShvcHRpb25zLmpzb24pXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gcmVhZHlzdGF0ZWNoYW5nZVxuICAgIHhoci5vbmxvYWQgPSBsb2FkXG4gICAgeGhyLm9uZXJyb3IgPSBlcnJvclxuICAgIC8vIElFOSBtdXN0IGhhdmUgb25wcm9ncmVzcyBiZSBzZXQgdG8gYSB1bmlxdWUgZnVuY3Rpb24uXG4gICAgeGhyLm9ucHJvZ3Jlc3MgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIElFIG11c3QgZGllXG4gICAgfVxuICAgIC8vIGhhdGUgSUVcbiAgICB4aHIub250aW1lb3V0ID0gbm9vcFxuICAgIHhoci5vcGVuKG1ldGhvZCwgdXJpLCAhc3luYylcblxuICAgIGlmIChvcHRpb25zLmNvcnMgJiYgb3B0aW9ucy53aXRoQ3JlZGVudGlhbHMgIT09IGZhbHNlKSB7XG4gICAgICAgIHhoci53aXRoQ3JlZGVudGlhbHMgPSB0cnVlXG4gICAgfVxuXG4gICAgLy8gQ2Fubm90IHNldCB0aW1lb3V0IHdpdGggc3luYyByZXF1ZXN0XG4gICAgaWYgKCFzeW5jKSB7XG4gICAgICAgIHhoci50aW1lb3V0ID0gXCJ0aW1lb3V0XCIgaW4gb3B0aW9ucyA/IG9wdGlvbnMudGltZW91dCA6IDUwMDBcbiAgICB9XG5cbiAgICBpZiAoeGhyLnNldFJlcXVlc3RIZWFkZXIpIHtcbiAgICAgICAgZm9yKGtleSBpbiBoZWFkZXJzKXtcbiAgICAgICAgICAgIGlmKGhlYWRlcnMuaGFzT3duUHJvcGVydHkoa2V5KSl7XG4gICAgICAgICAgICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoa2V5LCBoZWFkZXJzW2tleV0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoXCJyZXNwb25zZVR5cGVcIiBpbiBvcHRpb25zKSB7XG4gICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSBvcHRpb25zLnJlc3BvbnNlVHlwZVxuICAgIH1cbiAgICBcbiAgICBpZiAoXCJiZWZvcmVTZW5kXCIgaW4gb3B0aW9ucyAmJiBcbiAgICAgICAgdHlwZW9mIG9wdGlvbnMuYmVmb3JlU2VuZCA9PT0gXCJmdW5jdGlvblwiXG4gICAgKSB7XG4gICAgICAgIG9wdGlvbnMuYmVmb3JlU2VuZCh4aHIpXG4gICAgfVxuXG4gICAgeGhyLnNlbmQoYm9keSlcblxuICAgIHJldHVybiB4aHJcblxuICAgIGZ1bmN0aW9uIHJlYWR5c3RhdGVjaGFuZ2UoKSB7XG4gICAgICAgIGlmICh4aHIucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgbG9hZCgpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb2FkKCkge1xuICAgICAgICB2YXIgZXJyb3IgPSBudWxsXG4gICAgICAgIHZhciBzdGF0dXMgPSB4aHIuc3RhdHVzQ29kZSA9IHhoci5zdGF0dXNcbiAgICAgICAgLy8gQ2hyb21lIHdpdGggcmVxdWVzdFR5cGU9YmxvYiB0aHJvd3MgZXJyb3JzIGFycm91bmQgd2hlbiBldmVuIHRlc3RpbmcgYWNjZXNzIHRvIHJlc3BvbnNlVGV4dFxuICAgICAgICB2YXIgYm9keSA9IG51bGxcblxuICAgICAgICBpZiAoeGhyLnJlc3BvbnNlKSB7XG4gICAgICAgICAgICBib2R5ID0geGhyLmJvZHkgPSB4aHIucmVzcG9uc2VcbiAgICAgICAgfSBlbHNlIGlmICh4aHIucmVzcG9uc2VUeXBlID09PSAndGV4dCcgfHwgIXhoci5yZXNwb25zZVR5cGUpIHtcbiAgICAgICAgICAgIGJvZHkgPSB4aHIuYm9keSA9IHhoci5yZXNwb25zZVRleHQgfHwgeGhyLnJlc3BvbnNlWE1MXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc3RhdHVzID09PSAxMjIzKSB7XG4gICAgICAgICAgICBzdGF0dXMgPSAyMDRcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzdGF0dXMgPT09IDAgfHwgKHN0YXR1cyA+PSA0MDAgJiYgc3RhdHVzIDwgNjAwKSkge1xuICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSAodHlwZW9mIGJvZHkgPT09IFwic3RyaW5nXCIgPyBib2R5IDogZmFsc2UpIHx8XG4gICAgICAgICAgICAgICAgbWVzc2FnZXNbU3RyaW5nKHN0YXR1cykuY2hhckF0KDApXVxuICAgICAgICAgICAgZXJyb3IgPSBuZXcgRXJyb3IobWVzc2FnZSlcbiAgICAgICAgICAgIGVycm9yLnN0YXR1c0NvZGUgPSBzdGF0dXNcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgeGhyLnN0YXR1cyA9IHhoci5zdGF0dXNDb2RlID0gc3RhdHVzO1xuXG4gICAgICAgIGlmIChpc0pzb24pIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYm9keSA9IHhoci5ib2R5ID0gSlNPTi5wYXJzZShib2R5KVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge31cbiAgICAgICAgfVxuXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCB4aHIsIGJvZHkpXG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZXJyb3IoZXZ0KSB7XG4gICAgICAgIGNhbGxiYWNrKGV2dCwgeGhyKVxuICAgIH1cbn1cblxuXG5mdW5jdGlvbiBub29wKCkge31cbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbmlmICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB3aW5kb3dcbn0gZWxzZSBpZiAodHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZ2xvYmFsXG59IGVsc2Uge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge31cbn1cblxufSkuY2FsbCh0aGlzLHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJtb2R1bGUuZXhwb3J0cyA9IG9uY2Vcblxub25jZS5wcm90byA9IG9uY2UoZnVuY3Rpb24gKCkge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoRnVuY3Rpb24ucHJvdG90eXBlLCAnb25jZScsIHtcbiAgICB2YWx1ZTogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIG9uY2UodGhpcylcbiAgICB9LFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZVxuICB9KVxufSlcblxuZnVuY3Rpb24gb25jZSAoZm4pIHtcbiAgdmFyIGNhbGxlZCA9IGZhbHNlXG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKGNhbGxlZCkgcmV0dXJuXG4gICAgY2FsbGVkID0gdHJ1ZVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gYWdncmVnYXRlIChjb250ZXh0LCBjbGVhcikge1xuICB2YXIgcmVzdWx0ID0gY29udGV4dC5yZXF1ZXN0cy5jb25jYXQoY29udGV4dC5jaGlsZHJlbi5yZWR1Y2UoZXhwYW5kLCBbXSkpO1xuICBpZiAoY2xlYXIpIHtcbiAgICBjb250ZXh0LnJlcXVlc3RzID0gW107XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gZXhwYW5kIChhY2N1bXVsYXRvciwgY2hpbGQpIHtcbiAgYWNjdW11bGF0b3IucHVzaC5hcHBseShhY2N1bXVsYXRvciwgYWdncmVnYXRlKGNoaWxkKSk7XG4gIHJldHVybiBhY2N1bXVsYXRvcjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBhZ2dyZWdhdGU7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZpbmQgKHVybCwgY29udGV4dCkge1xuICB2YXIgY3R4ID0gY29udGV4dDtcbiAgdmFyIGNhY2hlO1xuICB3aGlsZSAoY3R4KSB7XG4gICAgY2FjaGUgPSBjdHguY2FjaGU7XG4gICAgaWYgKHVybCBpbiBjYWNoZSkge1xuICAgICAgaWYgKGlzRnJlc2goY2FjaGVbdXJsXSkpIHtcbiAgICAgICAgcmV0dXJuIGNhY2hlW3VybF07XG4gICAgICB9XG4gICAgICBkZWxldGUgY2FjaGVbdXJsXTtcbiAgICB9XG4gICAgY3R4ID0gY3R4LnBhcmVudDtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc0ZyZXNoIChlbnRyeSkge1xuICByZXR1cm4gZW50cnkuZXhwaXJlcyAtIG5ldyBEYXRlKCkgPiAwO1xufVxuXG5mdW5jdGlvbiBleHBpcmVzIChkdXJhdGlvbikge1xuICByZXR1cm4gRGF0ZS5ub3coKSArIGR1cmF0aW9uO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZmluZDogZmluZCxcbiAgZXhwaXJlczogZXhwaXJlc1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZW1pdHRlciwgY29udGV4dCwgdHlwZXMpIHtcbiAgdHlwZXMuZm9yRWFjaChmdW5jdGlvbiB0aHJvdWdoICh0eXBlKSB7XG4gICAgZW1pdHRlci5vbih0eXBlLCByYWlzZS5iaW5kKGVtaXR0ZXIsIHR5cGUpKTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gcmFpc2UgKHR5cGUpIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG4gICAgdmFyIGFsbCA9IFt0eXBlXS5jb25jYXQoYXJncyk7XG4gICAgdmFyIGN0eCA9IGNvbnRleHQ7XG5cbiAgICB3aGlsZSAoY3R4KSB7XG4gICAgICBjdHguZW1pdC5hcHBseShlbWl0dGVyLCBhbGwpO1xuICAgICAgY3R4ID0gY3R4LnBhcmVudDtcbiAgICB9XG4gIH1cbn07XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciByYWYgPSByZXF1aXJlKCdyYWYnKTtcbnZhciB4aHIgPSByZXF1aXJlKCd4aHInKTtcbnZhciBjb250cmEgPSByZXF1aXJlKCdjb250cmEnKTtcbnZhciBjYWNoZSA9IHJlcXVpcmUoJy4vY2FjaGUnKTtcbnZhciBhZ2dyZWdhdGUgPSByZXF1aXJlKCcuL2FnZ3JlZ2F0ZScpO1xudmFyIGVtaXRVcHN0cmVhbSA9IHJlcXVpcmUoJy4vZW1pdFVwc3RyZWFtJyk7XG52YXIgbWV0aG9kcyA9IFsnZ2V0JywgJ3Bvc3QnLCAncHV0JywgJ2RlbGV0ZScsICdwYXRjaCddO1xudmFyIHN0YXRlRXZlbnRzID0gWydjcmVhdGUnLCAnY2FjaGUnLCAncmVxdWVzdCcsICdhYm9ydCcsICdlcnJvcicsICdkYXRhJywgJ2Fsd2F5cyddO1xuXG5mdW5jdGlvbiBtZWFzbHkgKG1lYXNseU9wdGlvbnMsIHBhcmVudCkge1xuICB2YXIgbGF5ZXIgPSBjb250cmEuZW1pdHRlcih7XG4gICAgdGhpbm5lcjogdGhpbm5lcixcbiAgICBwYXJlbnQ6IHBhcmVudCxcbiAgICBjb250ZXh0OiBtZWFzbHlPcHRpb25zLmNvbnRleHQsXG4gICAgY2hpbGRyZW46IFtdLFxuICAgIHJlcXVlc3RzOiBbXSxcbiAgICBjYWNoZToge30sXG4gICAgYWJvcnQ6IGFib3J0LFxuICAgIHJlcXVlc3Q6IHJlcXVlc3RcbiAgfSk7XG5cbiAgbWV0aG9kcy5mb3JFYWNoKGZ1bmN0aW9uIGFkZE1ldGhvZCAobWV0aG9kKSB7XG4gICAgbGF5ZXJbbWV0aG9kXSA9IGZpcmUuYmluZChudWxsLCBtZXRob2QpO1xuICB9KTtcblxuICBmdW5jdGlvbiByZXF1ZXN0ICh1cmwsIG9wdCkge1xuICAgIHZhciBtZXRob2QgPSBvcHQubWV0aG9kO1xuICAgIGlmIChvcHQgJiYgb3B0LnhociAmJiBvcHQueGhyLm1ldGhvZCkge1xuICAgICAgbWV0aG9kID0gb3B0Lnhoci5tZXRob2Q7XG4gICAgfVxuICAgIGlmICghbWV0aG9kKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0EgcmVxdWVzdCBtZXRob2QgbXVzdCBiZSBzcGVjaWZpZWQuJyk7XG4gICAgfVxuICAgIHJldHVybiBmaXJlKG1ldGhvZCwgdXJsLCBvcHQpO1xuICB9XG5cbiAgZnVuY3Rpb24gdGhpbm5lciAob3B0KSB7XG4gICAgdmFyIGNoaWxkID0gbWVhc2x5KG9wdCB8fCBtZWFzbHlPcHRpb25zLCBsYXllcik7XG4gICAgbGF5ZXIuY2hpbGRyZW4ucHVzaChjaGlsZCk7XG4gICAgcmV0dXJuIGNoaWxkO1xuICB9XG5cbiAgZnVuY3Rpb24gZmlyZSAobWV0aG9kLCB1cmwsIG9wdCkge1xuICAgIHZhciBmaXJlT3B0aW9ucyA9IG9wdCB8fCB7fTtcbiAgICBmaXJlT3B0aW9ucy51cmwgPSB1cmw7XG4gICAgZmlyZU9wdGlvbnMubWV0aG9kID0gbWV0aG9kLnRvVXBwZXJDYXNlKCk7XG5cbiAgICB2YXIgcmVxID0gY29udHJhLmVtaXR0ZXIoe1xuICAgICAgZG9uZTogZmFsc2UsXG4gICAgICByZXF1ZXN0ZWQ6IGZhbHNlLFxuICAgICAgcHJldmVudGVkOiBmYWxzZSxcbiAgICAgIHByZXZlbnQ6IHByZXZlbnQsXG4gICAgICBsYXllcjogbGF5ZXIsXG4gICAgICBjb250ZXh0OiBmaXJlT3B0aW9ucy5jb250ZXh0IHx8IG1lYXNseU9wdGlvbnMuY29udGV4dCxcbiAgICAgIGNhY2hlOiBmaXJlT3B0aW9ucy5jYWNoZSB8fCBtZWFzbHlPcHRpb25zLmNhY2hlXG4gICAgfSk7XG4gICAgcmVxLmFib3J0ID0gYWJvcnRSZXF1ZXN0LmJpbmQobnVsbCwgcmVxKTtcblxuICAgIGVtaXRVcHN0cmVhbShyZXEsIGxheWVyLCBzdGF0ZUV2ZW50cyk7XG4gICAgcmFmKGdvKTtcblxuICAgIGZ1bmN0aW9uIGdvICgpIHtcbiAgICAgIHJlcS5lbWl0KCdjcmVhdGUnLCByZXEpO1xuICAgICAgcmVxdWVzdCgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByZXZlbnQgKGVyciwgYm9keSwgc3RhdHVzQ29kZSkge1xuICAgICAgaWYgKHJlcS5wcmV2ZW50ZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKHJlcS5yZXF1ZXN0ZWQgPT09IHRydWUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdBIHJlcXVlc3QgaGFzIGFscmVhZHkgYmVlbiBtYWRlLiBQcmV2ZW50IHN5bmNocm9ub3VzbHkhJyk7XG4gICAgICB9XG4gICAgICByZXEucHJldmVudGVkID0gdHJ1ZTtcbiAgICAgIHJhZihwcmV2ZW50ZWQpO1xuXG4gICAgICBmdW5jdGlvbiBwcmV2ZW50ZWQgKCkge1xuICAgICAgICB2YXIgeGhyID0ge1xuICAgICAgICAgIGJvZHk6IGJvZHksXG4gICAgICAgICAgc3RhdHVzQ29kZTogc3RhdHVzQ29kZSB8fCBlcnIgPyA1MDAgOiAyMDBcbiAgICAgICAgfTtcbiAgICAgICAgcmVxLmVtaXQoJ2NhY2hlJywgZXJyLCBib2R5KTtcbiAgICAgICAgZG9uZShlcnIsIHhociwgYm9keSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2FjaGVIaXQgKCkge1xuICAgICAgdmFyIGVudHJ5ID0gY2FjaGUuZmluZCh1cmwsIGxheWVyKTtcbiAgICAgIGlmIChlbnRyeSkge1xuICAgICAgICBlbnRyeS5jYWNoZWQgPSB0cnVlO1xuICAgICAgICByZXEueGhyID0gZW50cnk7XG4gICAgICAgIHJlcS5wcmV2ZW50ZWQgPSB0cnVlO1xuICAgICAgICByZXEuZW1pdCgnY2FjaGUnLCBlbnRyeS5lcnJvciwgZW50cnkuYm9keSk7XG4gICAgICAgIGRvbmUoZW50cnkuZXJyb3IsIGVudHJ5LCBlbnRyeS5ib2R5KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXF1ZXN0ICgpIHtcbiAgICAgIGlmIChtZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICAgIGNhY2hlSGl0KCk7XG4gICAgICB9XG4gICAgICBpZiAocmVxLnByZXZlbnRlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICByZXEucmVxdWVzdGVkID0gdHJ1ZTtcbiAgICAgIHJlcS54aHIgPSB4aHIoZmlyZU9wdGlvbnMsIGRvbmUpO1xuICAgICAgcmVxLmVtaXQoJ3JlcXVlc3QnLCByZXEueGhyKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBkb25lIChlcnIsIHJlcywgYm9keSkge1xuICAgICAgcmVxLmVycm9yID0gZXJyO1xuICAgICAgcmVxLnJlc3BvbnNlID0gYm9keTtcbiAgICAgIHJlcS5kb25lID0gdHJ1ZTtcbiAgICAgIGlmIChyZXEuY2FjaGUgJiYgIXJlcy5jYWNoZWQpIHtcbiAgICAgICAgbGF5ZXIuY2FjaGVbdXJsXSA9IHtcbiAgICAgICAgICBleHBpcmVzOiBjYWNoZS5leHBpcmVzKHJlcS5jYWNoZSksXG4gICAgICAgICAgZXJyb3I6IGVycixcbiAgICAgICAgICBib2R5OiBib2R5LFxuICAgICAgICAgIHN0YXR1c0NvZGU6IHJlcy5zdGF0dXNDb2RlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHJlcS5lbWl0KCdlcnJvcicsIGVyciwgYm9keSk7XG4gICAgICAgIHJlcS5lbWl0KGVyci5zdGF0dXNDb2RlLCBlcnIsIGJvZHkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVxLmVtaXQoJ2RhdGEnLCBib2R5KTtcbiAgICAgIH1cbiAgICAgIHVudHJhY2socmVxKTtcbiAgICB9XG5cbiAgICB0cmFjayhyZXEpO1xuICAgIHJldHVybiByZXE7XG4gIH1cblxuICBmdW5jdGlvbiBhYm9ydCAoKSB7XG4gICAgYWdncmVnYXRlKGxheWVyLCB0cnVlKS5mb3JFYWNoKGFib3J0UmVxdWVzdCk7XG4gIH1cblxuICBmdW5jdGlvbiBhYm9ydFJlcXVlc3QgKHJlcSkge1xuICAgIHJlcS5wcmV2ZW50ZWQgPSB0cnVlO1xuICAgIHJlcS5lbWl0KCdhYm9ydCcsIHJlcS54aHIpO1xuXG4gICAgaWYgKHJlcS54aHIpIHtcbiAgICAgIHJlcS54aHIuYWJvcnQoKTtcbiAgICB9XG4gICAgdW50cmFjayhyZXEpO1xuICB9XG5cbiAgZnVuY3Rpb24gdHJhY2sgKHJlcSkge1xuICAgIGxheWVyLnJlcXVlc3RzLnB1c2gocmVxKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVudHJhY2sgKHJlcSkge1xuICAgIHZhciBpID0gbGF5ZXIucmVxdWVzdHMuaW5kZXhPZihyZXEpO1xuICAgIHZhciBzcGxpY2VkID0gbGF5ZXIucmVxdWVzdHMuc3BsaWNlKGksIDEpO1xuICAgIGlmIChzcGxpY2VkLmxlbmd0aCkge1xuICAgICAgcmVxLmVtaXQoJ2Fsd2F5cycsIHJlcS5lcnJvciwgcmVxLnJlc3BvbnNlLCByZXEpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBsYXllcjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtZWFzbHkoe1xuICBjb250ZXh0OiBnbG9iYWwuZG9jdW1lbnQuYm9keSxcbiAgYmFzZTogJydcbn0pO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSJdfQ==
(12)
});
