'use strict';
var co = require('co');
var isGeneratorFn = require('is-generator-fn');
var isRegexp = require('is-regexp');
var objectAssign = require('object-assign');
var pathToRegexp = require('path-to-regexp');

/**
 * Create a "middl" app
 *
 * @param {object} options
 * @returns {app}
 */
module.exports = exports = function middl(options) {
	options = options || {};

	var pathPropertyType = typeof options.pathProperty;
	if (pathPropertyType !== 'undefined' && pathPropertyType !== 'string') {
		throw new TypeError(`Expected pathProperty to be a string but was: ${pathPropertyType}`);
	} else if (pathPropertyType === 'string' && !options.pathProperty.length) {
		throw new TypeError('Expected pathProperty to not be empty');
	}

	var stack = [];

	/**
	 * The "app"
	 *
	 * If used as a function it's just a wrapper for the run function
	 *
	 * @param {object} input
	 * @param {object} output
	 * @returns {promise}
	 */
	function app(input, output) {
		return run(input, output);
	}
	// attach public app api:
	app.match = match;
	app.use = use;
	app.run = run;

	/**
	 * Add a middleware to the stack
	 *
	 * @param {object} conditions
	 * @param {string} path
	 * @param {array} fns
	 * @param {object} pathOptions
	 * @returns {app}
	 */
	function addMiddleware(conditions, path, fns, opts) {
		for (var i = 0, len = fns.length; i < len; i++) {
			var fn = fns[i];
			var middleware = {
				conditions,
				path,
				fn,
				stopOnMatch: fn.length > 2 || Boolean(opts.stopOnMatch),
				paramKeys: []
			};
			if (middleware.path && options.pathProperty) {
				middleware.path = pathToRegexp(middleware.path, middleware.paramKeys, {end: opts.end});
			} else {
				middleware.path = null;
			}
			stack.push(middleware);
		}
		return app;
	}

	/**
	 * Use a conditional middleware
	 *
	 * @param {object} conditions
	 * @param {string} path
	 * @param {function} ...fn
	 * @returns {app|function}
	 */
	function match(conditions, path) {
		if (!conditions) {
			throw new Error('Missing matching conditions!');
		}
		var fns = Array.prototype.slice.call(arguments, 2);
		if (typeof path === 'function') {
			fns.unshift(path);
			path = null;
		}
		if (!fns.length) {
			return function matchPartial(p) {
				var fns = Array.prototype.slice.call(arguments, 1);
				if (typeof p === 'function') {
					fns.unshift(p);
					p = null;
				}
				return match.apply(null, [conditions, joinPaths(path, p)].concat(fns));
			};
		}
		return addMiddleware(conditions, path, fns, {stopOnMatch: true});
	}

	/**
	 * Use middleware, with optional path
	 *
	 * @param {string} path
	 * @param {function} ...fn
	 * @returns {app}
	 */
	function use(path) {
		var fns = Array.prototype.slice.call(arguments, 1);
		if (typeof path === 'function') {
			fns.unshift(path);
			path = null;
		}
		if (typeof fns[0] !== 'function') {
			throw new Error('Missing middleware function!');
		}
		return addMiddleware({}, path, fns, {end: false});
	}

	/**
	 * Run middleware stack
	 *
	 * @param {object} input
	 * @param {object} output
	 * @returns {promise}
	 */
	function run(input, output) {
		var i = 0;
		var filteredStack = getMatchingMiddleware(stack, input, options);

		function next(err) {
			var m = filteredStack[i++];
			var fn = m && m.fn;
			var fnLen = fn && fn.length;
			if ((!fn || fnLen !== 4) && err) {
				throw err;
			}
			if (!fn) {
				return Promise.resolve(output);
			}
			if (isGeneratorFn(fn)) {
				fn = co.wrap(fn);
			}
			var nextInput = getNextInput(m, input, options);
			var promise;
			if (fnLen === 4) {
				promise = Promise.resolve(fn(err, nextInput, output, next));
			} else if (fnLen === 3) {
				promise = Promise.resolve(fn(nextInput, output, next));
			} else {
				promise = Promise.resolve(fn(nextInput, output));
			}
			if (m.stopOnMatch) {
				return promise
					.then(function () {
						return output;
					});
			}
			return promise
				.then(function () {
					return next();
				})
				.catch(next);
		}

		return new Promise(function (resolve) {
			try {
				resolve(next());
			} catch (err) {
				resolve(next(err));
			}
		});
	}

	return app;
};

/**
 * Get all middleware where their conditions match the given input
 *
 * @param {array} stack
 * @param {object} input
 * @param {object} opts
 * @returns {array}
 */
function getMatchingMiddleware(stack, input, opts) {
	var matchingMiddleware = [];
	for (var i = 0, len = stack.length; i < len; i++) {
		var middleware = stack[i];
		if (matchesConditions(middleware, input, opts)) {
			matchingMiddleware.push(middleware);
		}
	}
	return matchingMiddleware;
}

/**
 * Check if a middleware's conditions are matching the given input
 *
 * @param {object} middleware
 * @param {object} input
 * @param {object} opts
 * @returns {boolean}
 */
function matchesConditions(middleware, input, opts) {
	if (middleware.path && !middleware.path.exec(input[opts.pathProperty])) {
		return false;
	}
	for (var key in middleware.conditions) {
		if (!middleware.conditions.hasOwnProperty(key)) {
			continue;
		}
		var condition = middleware.conditions[key];
		if (isRegexp(condition)) {
			if (!condition.exec(input[key])) {
				return false;
			}
		} else if (typeof condition === 'function') {
			if (!condition(input[key])) {
				return false;
			}
		} else if (condition !== input[key]) {
			return false;
		}
	}
	return true;
}

/**
 * Prefix a property name
 *
 * The first letter in the property name is uppercased before prefixing
 *
 * @param {string} prefix
 * @param {string} property
 * @returns {string}
 */
function getPrefixedPropertyName(prefix, property) {
	return prefix + property[0].toUpperCase() + property.slice(1);
}

/**
 * Get the input argument for a middleware
 *
 * If one has set options.pathProperty and the middleware has a mount path
 * the mount path will be stripped from the path property in the input object.
 * An unstripped version of the path property will also be set in the input object
 * as the path property name prefixed with "original", and any path params, e.g:
 *
 * options.pathProperty = 'url'
 * input.url = '/test/route'
 * middleware mount path = '/test/:name'
 * =>
 * nextInput.url = '/'
 * nextInput.originalUrl = '/test/route'
 * nextInput.params = {name: 'route'}
 *
 * @param {object} middleware
 * @param {object} input
 * @param {object} options
 * @returns {object}
 */
function getNextInput(middleware, input, options) {
	var nextInput = input;
	if (middleware.path) {
		var originalPathProperty = getPrefixedPropertyName('original', options.pathProperty);
		var pathMatch = middleware.path.exec(input[options.pathProperty]);
		var obj = {};
		obj[originalPathProperty] = nextInput[originalPathProperty] || nextInput[options.pathProperty];
		obj[options.pathProperty] = addLeadingSlash(nextInput[options.pathProperty].slice(pathMatch[0].length));
		obj.params = getParams(middleware.paramKeys, pathMatch);
		nextInput = objectAssign({}, nextInput, obj);
	}
	return nextInput;
}

/**
 * Get a params object from an array of parameter keys and the path match array
 *
 * @param {array} paramKeys
 * @param {array} pathMatch
 * @returns {object}
 */
function getParams(paramKeys, pathMatch) {
	return paramKeys.reduce(
		function (params, key, i) {
			var val = pathMatch[i + 1];
			var obj = {};
			obj[key.name] = typeof val === 'string' ? decodeURIComponent(val) : val || null;
			return objectAssign(params, obj);
		},
		{}
	);
}

/**
 * Prepend given path with a '/' if it's not already prepended
 *
 * @param {string} str
 * @returns {string}
 */
function addLeadingSlash(str) {
	if (str[0] === '/') {
		return str;
	}
	return '/' + str;
}

/**
 * Prepend each truthy argument with a '/' and then join them together
 *
 * @param {...string} ...arguments
 * @returns {string}
 */
function joinPaths() {
	var paths = Array.prototype.slice.call(arguments).filter(Boolean);
	return paths.map(addLeadingSlash).join('') || null;
}
