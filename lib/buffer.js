/**
 * Transformation pipeline for buffer-based Vinyl files
 */
'use strict';

var through = require('through2');
var duplexer = require('duplexer2');
var parseDom = require('./dom').parse;
var stringifyDom = require('./dom').stringify;

module.exports = function(file, transform, options, done) {
	if (typeof options === 'function') {
		done = options;
		options = {};
	}

	parseDom(file.contents.toString('utf8'), options, function(err, dom) {
		if (err) {
			return done(err);
		}

		file.dom = dom;
		file.stringify = function() {
			return stringifyDom(this.dom, options);
		};

		// transform file content on DOM level
		transform.pipe(through.obj(function(file, enc, next) {
			if (file.dom) {
				file.contents = new Buffer(file.stringify());
				delete file.dom;
			}
			delete file.stringify;

			// write transformed DOM as file content
			done(null, file);
			next();
		}));

		transform.write(file);
	});
};