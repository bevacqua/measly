# measly

> A measly wrapper around XHR to help you contain your requests

# Online Demo

[![measly.png][3]][4]

# Install

```shell
npm install measly --save
```

```shell
bower install measly --save
```

# Layer API

Here is the API exposed by `measly`.

## `.layer(options?)`

Measly works as a hierarchy-based layer that helps you perform XHR requests. `measly.layer()` provides the same API as `measly` does, by creating a child layer. Measly supports tree-like structures as well. You can use a thinner layer to create requests from different parts of your application. You can pass a few options to `measly.layer`.

Option    | Description
----------|--------------------------------------------------------------------------------------------
`context` | A DOM context element for the layer. Defaults to `document.body`.
`cache`   | Milliseconds that response data is considered fresh. Defaults to `false`.

Note that if you pass in a `context` that already has a Measly layer, that layer will be returned instead.

#### Usage

```js
var core = require('measly');
var thin = core.layer();

// thin has same api as core
```

## `.parent`

Access the parent layer.

#### Usage

```js
var core = require('measly');
var thin = core.layer();

console.log(core.parent);
// <- undefined

console.log(thin.parent);
// <- core
```

## `.context`

This is the context element for the measly layer.

#### Usage

```js
var core = require('measly');
var thin = core.layer({ context: div });

console.log(core.context);
// <- document.body

console.log(thin.context);
// <- div
```

## `.all`

Lists all of the measly layers that have been ever created. **Note that this method is only available in the top measly layer.**

## `.find(context, shallow?)`

Finds a measly layer by their `context` DOM element. If the provided element isn't found in any layer, its parent element is looked up. If no other parent elements are found, then you're going to get `core` back because its context is `document.body`. **Note that this method is only available in the top measly layer.**

If you set `shallow` to `true`, then only the provided `context` will be tested, rather than walking the DOM tree.

#### Usage

```js
var core = require('measly');
var thin = core.layer({ context: div });

console.log(core.find(document.body));
// <- core

console.log(core.find(div));
// <- thin
```

## `.children`

Array of thinner layers created on top of this layer.

#### Usage

```js
var core = require('measly');
var thin = core.layer();

console.log(core.children);
// <- [thin]
```

## `.requests`

These are the pending requests that pertain to this measly layer.

#### Usage

```js
var core = require('measly');
core.get('/api/v1/logs');

console.log(core.requests);
// <- [req]
```

## `.cache`

These are the cache entries for the current layer. Note that freshness is evaluated only when the cache entry is considered as a response, and thus the `cache` object may have stale entries in it, even though they will be removed when detected.

Whenever there's a cache hit the request won't be initiated against the server. Instead, your local copy of the data will be used. **Cache hits are limited to `GET` requests because best practices.**

#### Usage

```js
var core = require('measly');

core.cache['/api/v1/logs'] = {
  statusCode: 200,
  body: 'a cached response'
};

core.get('/api/v1/logs').on('data', function (err, res, body) {
  console.log(body);
  // <- 'a cached response'
});
```

**Note that the `cache` properties are automatically set for you if you define a duration for which your requests are _cache-worthy_.**

```js
var core = require('measly');
core.get('/api/v1/logs', { cache: 60000 }).on('data', function () {
  core.get('/api/v1/logs').on('data', function () {
    // same response. the resource won't be hit again for 60 seconds
  });
});
```

## `.abort()`

This method will abort all pending requests found on this layer as well as all its children's requests, recursively.

#### Usage

```js
var core = require('measly');

core.get('/api/v1/logs');
core.abort();
```

## `.request(url, options)`

Requests are created using [`xhr`][1]. In addition to the options defined by `xhr`, you could define these options as well.

Option    | Description
----------|--------------------------------------------------------------------------------------------
`context` | An arbitrary context object for this. DOM elements are encouraged. Defaults to `layer.context`.
`cache`   | Milliseconds that response data is considered fresh. Defaults to `layer.cache`.

There's also `.get`, `.post`, `.put`, `.delete`, and `.patch` as short-hand methods. These methods return a `req` object. Each instance of `req` has an extensive API.

#### Usage

```js
var core = require('measly');
var req = core.get('/api/v1/logs');
```

# Request API

Firstly, `req` objects are also event emitters created by [`contra`][2]. These events don't only get fired on the `req` object, but on the `layer` that created the request, and all of its parents.

## Request Events

In every event listener, `req` will be the context assigned to `this`.

Event          | Arguments     | Fired when...
---------------|---------------|-----------------------------------------------------------
`'create'`     | `(req)`       | A `measly` request is created
`'cache'`      | `(err, body)` | A request is prevented either manually or by a cache hit
`'request'`    | `(xhr)`       | The XHR request is opened
`'abort'`      | `(xhr?)`      | A request is aborted manually
`'error'`      | `(err, body)` | There was an error
`(statusCode)` | `(err, body)` | There was an error with status code: `statusCode`
`'data'`       | `(body)`      | We got a successful response
`'always'`     | `(err, body)` | A request produces an error, is fulfilled, or aborted

Naturally, requests also have properties and other methods.

## `.prevent(err, body, statusCode?)`

Prevents a request from turning into an XHR request. Instead, you can define your own error, response body, and status code. Considering events get bubbled up `measly` layers, you're able to prevent requests under certain conditions, globally for any requests made by a layer or its children. Also useful in testing environments.

The status code is `200` if there isn't an error, `500` in case of an error, and you can also set it explicitly.

#### Usage

```js
var core = require('measly');
var req = core.get('/api/v1/logs');

core.on('create', function (req) {
  if (canInfer) {
    req.prevent(null, ['dogs', 'cats', 'carrots']);
  }
});
```

## `.abort()`

Aborts the request individually.

## `.layer`

This is the layer the request was created on.

#### Usage

```js
var core = require('measly');
var req = core.get('/api/v1/logs');

console.log(req.layer);
// <- core
```

## `.context`

An arbitrary context object for this. DOM elements are encouraged. Defaults to `layer.context`.

## `.cache`

Milliseconds that response data is considered fresh. Defaults to `layer.cache`.

## `.done`

`false` unless the request is completed.

## `.requested`

`false` unless an XHR request is actually created.

## `.prevented`

`false` unless the request is prevented either manually or by a cache hit

## `.xhr`

The browser native XHR object, once the request is created.

# License

MIT

[1]: https://github.com/Raynos/xhr
[2]: https://github.com/bevacqua/contra
[3]: https://cloud.githubusercontent.com/assets/934293/3533872/66285232-07dc-11e4-9601-b7f4ae07bf3e.png
[4]: http://bevacqua.github.io/measly/
