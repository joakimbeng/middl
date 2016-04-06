# middl

![middl logo](https://cdn.rawgit.com/joakimbeng/middl/master/media/middl.svg)

[![Build status][travis-image]][travis-url] [![Coverage Status][coveralls-image]][coveralls-url] [![NPM version][npm-image]][npm-url] [![js-xo-style][codestyle-image]][codestyle-url]

> A generic middleware library, inspired by Express and suitable for anything

**Note** all examples below use ES2015 syntax but the library should be able to run even in browsers back to IE9, as long as you're polyfilling the Promise object.

## Why?

Because the middleware pattern is super useful! With this module you can even BYOE (Build Your Own Express) quite easily ([see example below](#example-byoe)).

It also supports promises so your middleware can be async ([see module usage for an example](#module-usage)).

## Installation

Install `middl` using [npm](https://www.npmjs.com/):

```bash
npm install --save middl
```

## Usage

### Module usage

```javascript
const middl = require('middl');
const app = middl();

// a sync middleware
app.use((input, output) => {
	output.prop = 1;
});

// an async middleware
app.use((input, output) => {
	// Faking a time consuming task...
	return new Promise(resolve => {
		setTimeout(() => {
			output.prop += 1;
			resolve();
		}, 10);
	});
});

// a time measuring logger:
app.use((input, output) => {
	var start = new Date();
  next()
		.then(() => {
			var ms = new Date() - start;
			console.log('Done in %s ms', ms);
		});
});
// or even prettier when using Babel and async/await:
app.use(async (input, output) => {
	var start = new Date();
  await next();
	var ms = new Date() - start;
	console.log('Done in %s ms', ms);
});

// pass in the initial `input` and `output` objects
// and run the middleware stack:
app.run({val: 'hello'}, {})
	.then(output => {
		// output.prop === 2
	});
```

## Examples

## Example BYOE

> BYOE - Build Your Own Express

With Middl all it takes to create an Express like web server is the following code snippet.
Off course this is a quite limited feature set and API compared to the full Express library, but hopefully it shows how to use Middl in a creative way.

```javascript
const http = require('http');
const middl = require('middl');

// Make middl more Express like by using `url` as the property to match paths with:
const app = middl({pathProperty: 'url'});

// Adding all app.METHOD() functions à la Express:
http.METHODS.forEach(method => {
	app[method.toLowerCase()] = app.match({method});
});
// Also the app.all():
app.all = (path, fn) => {
	http.METHODS.forEach(method => {
		app[method.toLowerCase()](path, fn);
	});
	return app;
};

// A route handler for requests to: GET /test
app.get('/test', (req, res) => {
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('ok\n');
});
// A route handler for requests to: POST /test
app.post('/test', (req, res) => {
	res.writeHead(202, {'Content-Type': 'text/plain'});
	res.end('accepted\n');
});

// Make the middle app web server listen on port 3000:
http.createServer(app).listen(3000);
```

## API

### `middl(options)`

| Name | Type | Description |
|------|------|-------------|
| options | `Object` | Options |

Returns: [`app`](#appinput-output)

#### `options.pathProperty`

Type: `String`  

Used to enable the possibility to use a mount path when adding middleware ([see example above](#example-byoe)).

### `app(input, output)`

| Name | Type | Description |
|------|------|-------------|
| input | `Object` | The input to the middleware stack, will be used as the first argument of each middleware (think of Express' `req`) |
| output | `Object` | The output to/from the middleware stack, will be used as the second argument of each middleware (think of Express' `res`) |

The Express like `app` function.

Returns: `Promise` which is resolved when the whole stack of middleware have been run through, or the flow have been aborted by throwing an error/returning a rejected Promise or by not calling `next`.

#### `app.use([path, ], fn)`

| Name | Type | Description |
|------|------|-------------|
| path | `String` | An optional mount path for the middleware (only applicable if [`options.pathProperty`](#optionspathproperty) is set) |
| fn | `Function` | The middleware function |

The middleware function signature should be similar to that of Express, i.e: `function ([err, ] input, output [, next]) { ... }`.

Returns: `app` for chaining.

#### `app.match(conditions [, path [, fn]])`

| Name | Type | Description |
|------|------|-------------|
| conditions | `Object` | The middleware will only be run if the current `input` matches this object |
| path | `String` | An optional mount path for the middleware (only applicable if [`options.pathProperty`](#optionspathproperty) is set) |
| fn | `Function` | The middleware function |

The middleware function signature should be similar to that of Express, i.e: `function ([err, ] input, output [, next]) { ... }`.

Returns: `app` for chaining if `fn` is provided, otherwise a partially applied `function` will be returned, e.g:

```javascript
// this:
app.match({method: 'GET'}, '/test', (req, res) => { ... });
// is the same as this:
const get = app.match({method: 'GET'});
get('/test', (req, res) => { ... });
```

## License

MIT © [Joakim Carlstein](http://joakim.beng.se)

[npm-url]: https://npmjs.org/package/middl
[npm-image]: https://badge.fury.io/js/middl.svg
[travis-url]: https://travis-ci.org/joakimbeng/middl
[travis-image]: https://travis-ci.org/joakimbeng/middl.svg?branch=master
[coveralls-url]: https://coveralls.io/github/joakimbeng/middl?branch=master
[coveralls-image]: https://coveralls.io/repos/github/joakimbeng/middl/badge.svg?branch=master
[codestyle-url]: https://github.com/sindresorhus/xo
[codestyle-image]: https://img.shields.io/badge/code%20style-xo-brightgreen.svg?style=flat
