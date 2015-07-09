'use strict';

var through = require('through2');
var duplexer = require('duplexer2');
var rewriteUrl = require('./processor/rewrite-url');
var bufferPipeline = require('./lib/buffer');
var streamPipeline = require('./lib/stream');

/**
 * Returns a Transform stream for VinylFS file object
 * @return {stream.Transform}
 */
module.exports = function(options) {
	options = options || {};

	return through.obj(function(file, enc, next) {
		return module.exports.process(file, options, next);
	});
};

/**
 * Processes single VinylFS file
 * @param  {VinylFS}   file
 * @param  {Function} next
 */
module.exports.process = function(file, options, next) {
	options = options || {};

	if (file.isNull()) {
		return next(null, file);
	}

	var input = rewriteUrl(options);
	var output = input;

	// use custom transformers, if provided
	// each `transform` entry must be a function that returns a transform stream
	if (options.transform) {
		var t = Array.isArray(options.transform) ? options.transform : [options.transform];
		t.forEach(function(streamFactory) {
			output = output.pipe(streamFactory(options));
		});
	}

	var transform = duplexer(input, output);

	if (file.isStream()) {
		return streamPipeline(file, transform, options, next);
	}

	return bufferPipeline(file, transform, options, next);
};

module.exports.htmlparser = require('htmlparser2');