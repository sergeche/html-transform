'use strict';

var through = require('through2');
var combine = require('stream-combiner2');
var rewriteUrl = require('./processor/rewrite-url');
var streamFactory = require('./lib/stream');
var readContents = require('./lib/read-contents');

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
module.exports.process = function(file, options, done) {
	options = options || {};

	if (file.isNull()) {
		return done(null, file);
	}

	var transform = streamFactory(file, createPipeline(options), options)
	.once('error', done);

	if (file.isStream()) {
		file.contents = file.contents.pipe(transform);
		file.contents.pause();
		done(null, file);
	} else {
		transform.pipe(readContents(function(contents, next) {
			file.contents = contents;
			next();
			done(null, file);
		}))
		.once('error', done);
		transform.end(file.contents);
	}

	return transform;
};

module.exports.htmlparser = require('htmlparser2');

/**
 * Creates file transformation pipeline: a stream that transforms passed CSS files
 * on object modle level
 * @param  {Object} options
 * @return {stream.Duplex}
 */
function createPipeline(options) {
	var pipeline = [rewriteUrl(options)];

	// use custom transformers, if provided
	// each `transform` entry must be a function that returns a transform stream
	if (options.transform) {
		var t = Array.isArray(options.transform) ? options.transform : [options.transform];
		t.forEach(function(streamFactory) {
			pipeline.push(streamFactory(options));
		});
	}

	return combine(pipeline);
}