'use strict';

var through = require('through2');
var duplexer = require('duplexer2');
var rewriteUrl = require('./processor/rewrite-url');
var dom = require('./lib/dom');
var bufferPipeline = require('./lib/buffer');
var streamPipeline = require('./lib/stream');

/**
 * Returns a Transofrm stream for VinylFS file object
 * @return {stream.Transform}
 */
module.exports = function(options) {
	options = options || {};

	return through.obj(function(file, enc, next) {
		if (file.isNull()) {
			return next(null, file);
		}

		var input = rewriteUrl(options);
		var output = input;

		// use custom transformers, if provided
		if (options.transform) {
			var t = Array.isArray(options.transform) ? options.transform : [options.transform];
			t.forEach(function(stream) {
				output = output.pipe(stream);
			});
		}

		var transform = duplexer(input, output);

		if (file.isStream()) {
			return streamPipeline(file, transform, options, next);
		}

		bufferPipeline(file, transform, options, next);
	});
};