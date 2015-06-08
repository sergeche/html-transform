'use strict';

var through = require('through2');
var duplexer = require('duplexer2');
var rewriteUrl = require('./processor/rewrite-url');
var dom = require('./lib/dom');

/**
 * Returns a Transofrm stream for VinylFS file object
 * @return {stream.Transform}
 */
module.exports = function(options) {
	options = options || {};
	var input = rewriteUrl(options);
	var output = input;

	// use custom transformers, if provided
	if (options.transform) {
		var t = Array.isArray(options.transform) ? options.transform : [options.transform];
		t.forEach(function(stream) {
			output = output.pipe(stream);
		});
	}

	return wrap(duplexer(input, output), options);
};

module.exports.wrap = wrap;

/**
 * Wraps given stream into a DOM parser and stringifier. Returns a new stream
 * that parses incoming VinylFS file contents into DOM, stores it in file object
 * as `.dom` property and passes file to `stream`. The `stream` output is then
 * stringifies DOM object back to buffer
 * @param  {stream.Duplex} stream 
 * @param  {Object} options
 * @return {stream.Transform}
 */
function wrap(stream, options) {
	options = options || {};
	var output = through.obj(function(file, enc, next) {
		if (file.dom) {
			file.contents = new Buffer(dom.stringify(file.dom, options));
			delete file.dom;
		}

		next(null, file);
	});

	var input = through.obj(function(file, enc, next) {
		if (file.isNull()) {
			return next(null, file);
		}

		if (file.isStream()) {
			return next(new Error('Streams are not supported'));
		}

		dom.parse(file.contents.toString('utf8'), options, function(err, dom) {
			if (err) {
				return next(err);
			}

			file.dom = dom;

			// create a transformation pipeline based on given settings
			input.unpipe(output);
			input.pipe(stream).pipe(output);
			next(null, file);
		});
	});

	return duplexer(input, output);
}