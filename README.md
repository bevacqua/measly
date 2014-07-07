# measly

> A measly wrapper around XHR to help you contain your requests

# Install

```shell
npm install measly --save
```

```shell
bower install measly --save
```

# Usage

Here is a puny example.

```js
var measly = require('measly');
var req = measly.put('/api/thoughts', {
  data: {
    thought: 'Feeling really dizzy...'
  }
});
```

Under the hood, measly allows you to do all sorts of event handling on both a request level and a contextual level. For example, if you want to, you know, do something when the request succeeds, you could do the following.

```js
req.on('data', function (body) {
  console.log('Such a response!', body);
});
```

You could also handle errors using `measly`.

```js
req.on('error', function (err) {
  console.error('OH MY GOD!', err);
});
```

Maybe you want to handle errors on a global level. How about handling any `500` error that may occur?

```js
measly.on(500, function (err) {
  console.error('Very server error', err);
})
```

Suppose now you're developing a single page application. Wait, you are, right? This would abort all pending requests tracked by `measly`, which is quite useful when navigating away into another page.

```js
measly.abort();
```

What if you wanted to make sure you're only aborting requests that were initiated by the view you're leaving? Then you should use contexts.

```js
view.on('enter', function () {
  view.ajax = measly.thinner();
});

view.on('leave', function () {
  view.ajax.abort();
});

someButton.addEventListener('click', function () {
  view.ajax.get('/api/products');
  view.ajax.get('/api/dogs');
});

view.ajax.on('data', function (body) {
  console.log('Got something!', body);
});
```

Events will always fire on the request object, its context, and its parent contexts, if for some reason you're using a complicated request context hierarchy. The inheritance model in `measly` allows you to easily set up a consistent error handling UX where whenever a validation error occurs (`400 Bad Request`) you pop up a validation message in the context where the request originated.

```js
measly.get('/foo', {
  context: div
});

measly.on(400, function () {
  console.log(this.context); // <- the context element
});
```

You could also set the context on a layer level as well!

```js
var thin = measly.thinner({
  context: div
});

thin.get('/foo').on(400, function () {
  console.log(this.context); // <- the context element
});
```

Thin aims to be a layer between you and XHR requests, and it takes it a bit further allowing you to do caching.

```js
var thin = measly.thinner({});

thin.on('create', function (e) {
  e.prevent(null, 'a'); // prevention must be sync, otherwise AJAX request will fire!
});

thin.get('/foo').on('done', function (body) {
  console.log(body); // <- 'a'
});
```

That's all it has to show for!

# Events

Event          | Arguments     | Fired when...
---------------|---------------|-----------------------------------------------------------
`'create'`     | `(state)`     | A `measly` request is initiated
`'cache'`      | `(err, body)` | A request is prevented during the `'create'` event
`'request'`    | `(xhr)`       | An XHR request is opened
`'abort'`      | `(xhr?)`      | The request is aborted
`'error'`      | `(err, body)` | There was an error
`(statusCode)` | `(err, body)` | There was an error with status code: `statusCode`
`'data'`       | `(body)`      | We got a successful response
`'always'`     | `(err, body)` | A request produces an error, is fulfilled, or aborted

# License

MIT
