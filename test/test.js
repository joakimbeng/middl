import test from 'ava';
import middl from '../src';

test('middl is a function', t => {
	t.is(typeof middl, 'function');
});

test('middl() is a function', t => {
	t.is(typeof middl(), 'function');
});

test('middl().use is a function', t => {
	t.is(typeof middl().use, 'function');
});

test('middl().match is a function', t => {
	t.is(typeof middl().match, 'function');
});

test('middl().run is a function', t => {
	t.is(typeof middl().run, 'function');
});

test('running use without function', t => {
	t.throws(() => middl().use(), 'Missing middleware function!');
});

test('running use with path but no function', t => {
	t.throws(() => middl().use('/'), 'Missing middleware function!');
});

test('running match without conditions', t => {
	t.throws(() => middl().match(), 'Missing matching conditions!');
});

test('running match without middleware function returns function for partial application', t => {
	t.is(typeof middl().match({}), 'function');
});

test('no string pathProperty option', t => {
	t.throws(() => middl({pathProperty: true}), /TypeError/);
});

test('empty string pathProperty option', t => {
	t.throws(() => middl({pathProperty: ''}), /TypeError/);
});

test('no middleware', async t => {
	const input = {a: 1};
	const output = {b: 2};
	const result = await middl().run(input, output);
	t.same(result, output);
});

test('crashing async middleware', async t => {
	const input = {a: 1};
	const output = {b: 2};
	const app = middl();
	app.use(input => {
		input.b();
	});
	try {
		await app.run(input, output);
	} catch (err) {
		t.ok(err instanceof TypeError);
		return;
	}
	t.fail('Should not get here!');
});

test.cb('crashing sync middleware', t => {
	const input = {a: 1};
	const output = {b: 2};
	const app = middl();
	app.use(input => {
		input.b();
	});
	let promise;
	try {
		promise = app.run(input, output);
	} catch (err) {
		t.fail('Should not get here!');
		t.ok(err instanceof TypeError);
		return;
	}
	promise.then(() => {
		t.fail('Should not get here either!');
	})
	.catch(err => {
		t.ok(err instanceof TypeError);
	})
	.then(t.end);
});

test('with middleware', async t => {
	const input = {a: 1};
	const output = {b: 2};
	const app = middl();
	app.use((input, output) => {
		output.c = input.a;
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 1);
});

test('multiple middlewares', async t => {
	const input = {a: 1};
	const output = {b: 2};
	const app = middl();
	app.use((input, output) => {
		output.c = input.a;
	});
	app.use((input, output) => {
		output.c *= 2;
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 2);
});

test('async middleware', async t => {
	const input = {a: 1};
	const output = {b: 2};
	const app = middl();
	app.use(async (input, output) => {
		output.c = input.a;
	});
	app.use(async (input, output) => {
		output.c *= 2;
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 2);
});

test('async middlewares with next parameter', async t => {
	const input = {a: 3};
	const output = {b: 2};
	const app = middl();
	app.use(async (input, output, next) => {
		output.c = 'Hello';
		await next();
		output.c += ' person!';
	});
	app.use(async (input, output) => {
		output.c += ' there';
	});
	app.use(async (input, output) => {
		output.c += ' you tech savvy';
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 'Hello there you tech savvy person!');
});

test('middleware with next parameter can abort chain with error', async t => {
	const input = {a: 3};
	const output = {b: 2};
	const app = middl();
	app.use(async (input, output, next) => {
		output.c = input.a;
		next(new Error('Oh, noes!'));
	});
	app.use(async () => {
		t.fail('Should not run!');
	});
	try {
		await app.run(input, output);
	} catch (err) {
		t.is(err.message, 'Oh, noes!');
		return;
	}
	t.fail('It should have failed!');
});

test('middleware with next parameter can abort chain without error', async t => {
	/* eslint no-unused-vars: 0 */
	const input = {a: 3};
	const output = {b: 2};
	const app = middl();
	app.use(async (input, output, next) => {
		output.c = input.a;
	});
	app.use(async () => {
		t.fail('Should not run!');
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 3);
});

test('error handling middleware', async t => {
	const input = {a: 3};
	const output = {b: 2};
	const app = middl();
	app.use(async (input, output) => {
		throw new Error('Oh, noes!');
	});
	app.use(async (err, input, output, next) => {
		t.is(err.message, 'Oh, noes!');
		next();
	});
	app.use(async (input, output) => {
		output.c = input.a;
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 3);
});

test('error handling middleware can handle rejected promises', async t => {
	const input = {a: 3};
	const output = {b: 2};
	const app = middl();
	app.use((input, output) => {
		return Promise.reject(new Error('Oh, noes!'));
	});
	app.use(async (err, input, output, next) => {
		t.is(err.message, 'Oh, noes!');
		next();
	});
	app.use(async (input, output) => {
		output.c = input.a;
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 3);
});

test('matching middleware equal match', async t => {
	const input = {a: 1};
	const output = {b: 2};
	const app = middl();
	app.match({a: 1}, (input, output) => {
		output.c = 10;
	});
	app.match({a: 2}, () => {
		t.fail('Should not run!');
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 10);
});

test('multiple matching middleware without next', async t => {
	const input = {a: 1};
	const output = {b: 2};
	const app = middl();
	app.match({a: 1}, (input, output) => {
		output.c = 10;
	});
	app.match({a: 1}, () => {
		t.fail('Should not run!');
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 10);
});

test('matching middleware ignores inherited properties', async t => {
	const input = {a: 1};
	const output = {b: 2};
	const app = middl();
	const conditions = Object.create({b: 2});
	conditions.a = 1;
	app.match(conditions, (input, output) => {
		output.c = 10;
	});
	app.match({a: conditions.b}, () => {
		t.fail('Should not run!');
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 10);
});

test('matching middleware regexp match', async t => {
	const input = {a: 'hi'};
	const output = {b: 'ho'};
	const app = middl();
	app.match({a: /^h/}, (input, output) => {
		output.c = 10;
	});
	app.match({a: /^b/}, () => {
		t.fail('Should not run!');
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 10);
});

test('matching middleware function match', async t => {
	const input = {a: 'hi'};
	const output = {b: 'ho'};
	const app = middl();
	app.match({a: val => val.toUpperCase() === 'HI'}, (input, output) => {
		output.c = 10;
	});
	app.match({a: val => val.toUpperCase() === 'HELLO'}, () => {
		t.fail('Should not run!');
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 10);
});

test('matching middleware partial application', async t => {
	const input = {a: 1};
	const output = {b: 2};
	const app = middl();
	app.aOne = app.match({a: 1});

	app.aOne((input, output) => {
		output.c = input.a;
	});

	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 1);
});

test('use middleware with pathProperty option', async t => {
	const input = {path: '/test2/route', a: 1};
	const output = {b: 2};
	const app = middl({pathProperty: 'path'});
	app.use('/test2', (input, output) => {
		output.c = input.a;
	});
	app.use('/fail', () => {
		t.fail('Should not run!');
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 1);
});

test('match middleware with pathProperty option', async t => {
	const input = {path: '/test/route', method: 'GET', a: 1};
	const output = {b: 2};
	const app = middl({pathProperty: 'path'});
	app.get = app.match({method: 'GET'});
	app.get('/test', () => {
		t.fail('Should not run!');
	});
	app.get('/test/route', (input, output) => {
		output.c = input.a;
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 1);
});

test('match middleware with pathProperty option and partial application', async t => {
	const input = {path: '/test/route', method: 'GET', a: 1};
	const output = {b: 2};
	const app = middl({pathProperty: 'path'});
	app.get = app.match({method: 'GET'}, '/test');
	app.get(() => {
		t.fail('Should not run!');
	});
	app.get('/route', (input, output) => {
		output.c = input.a;
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 1);
});

test('middleware with path params', async t => {
	const input = {path: '/test/route', method: 'GET', a: 1};
	const output = {b: 2};
	const app = middl({pathProperty: 'path'});
	app.use('/test/:name', (input, output) => {
		output.c = input.params.name;
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 'route');
});

test('middleware with optional path params', async t => {
	const input = {path: '/test', method: 'GET', a: 1};
	const output = {b: 2};
	const app = middl({pathProperty: 'path'});
	app.use('/test/:name?', (input, output) => {
		output.c = input.params.name;
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, null);
});

test('use another middl instance as middleware', async t => {
	const input = {path: '/test/route', a: 1};
	const output = {b: 2};
	const app = middl({pathProperty: 'path'});
	const app2 = middl({pathProperty: 'path'});
	app.use('/test', (input, output) => {
		output.c = input.a;
	});
	app2.use(app);
	const result = await app2.run(input, output);
	t.same(result, output);
	t.is(result.c, 1);
});

test('use another middl instance as middleware with path', async t => {
	const input = {path: '/test/route', a: 4};
	const output = {b: 2};
	const app = middl({pathProperty: 'path'});
	const app2 = middl({pathProperty: 'path'});
	app.use('/route', (input, output) => {
		t.is(input.path, '/');
		t.is(input.originalPath, '/test/route');
		output.c = input.a;
	});
	app2.use('/test', app);
	const result = await app2.run(input, output);
	t.same(result, output);
	t.is(result.c, 4);
});

test('use generators as middleware', async t => {
	const input = {a: 1};
	const output = {b: 2};
	const app = middl();
	app.use(function *(input, output, next) {
		yield next();
		output.c *= 2;
	});
	app.use((input, output) => {
		output.c = input.a;
	});
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 2);
});

test('next should always return a promise (issue #2)', t => {
	const input = {a: 1};
	const output = {b: 2};
	const app = middl({pathProperty: 'url'});
	app.use((input, output, next) => {
		return next().then(() => {
			output.c = 2;
		});
	});
	app.match({a: 1}, '/no-match', (input, output) => {
		output.c = input.a;
	});
	t.notThrows(() => {
		app.run(input, output);
	});
});

test('use multiple middleware in the same function call', async t => {
	const input = {a: 1};
	const output = {b: 2};
	const app = middl();
	app.use(
		function *(input, output, next) {
			yield next();
			output.c *= 2;
		},
		(input, output) => {
			output.c = input.a;
		}
	);
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 2);
});

test('multiple match middleware in the same function call', async t => {
	const input = {path: '/test', a: 1};
	const output = {b: 2};
	const app = middl({pathProperty: 'path'});
	app.match(
		{a: 1},
		'/test',
		function *(input, output, next) {
			yield next();
			output.c *= 2;
		},
		(input, output) => {
			output.c = input.a;
		}
	);
	const result = await app.run(input, output);
	t.same(result, output);
	t.is(result.c, 2);
});
