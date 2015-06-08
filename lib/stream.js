/**
 * Transformation pipeline for stream-based Vinyl files
 */
'use strict';

var through = require('through2');
var duplexer = require('duplexer2');
var parseDom = require('./dom').parse;
var stringifyDom = require('./dom').stringify;

/**
 * Applies `transform` stream on given stream-content Vinyl file instance
 * @param  {Vinyl} file Vinyl file instance to transform
 * @param  {stream.Transform} transform Transformation stream for file content
 * @param  {Object} options DOM parsing options
 * @param  {Function} done Callback function, invoked when transformation
 * is ready 
 */
module.exports = function(file, transform, options, done) {
	if (typeof options === 'function') {
		done = options;
		options = {};
	}

	var buf = null;
	// read file completely then parse it into DOM
	file.contents.pipe(function(chunk, enc, next) {
		buf = buf ? Buffer.concat([buf, chunk]) : chunk;
		next();
	}, function(next) {
		parseDom(buf.toString('utf8'), options, function(err, dom) {
			if (err) {
				return next(err);
			}

			file.dom = dom;

			// transform file content on DOM level
			transform.pipe(through.obj(function(file, enc, next2) {
				if (file.dom) {
					buf = new Buffer(stringifyDom(file.dom, options));
					delete file.dom;
				}

				// write transformed DOM as file content
				next(null, buf);
				buf = null;
				next2();
			}));

			transform.write(file);
		});
	});
	done(null, file);
};