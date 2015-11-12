/**
 * Transformation pipeline for stream-based Vinyl files
 */
'use strict';

var through = require('through2');
var parseDom = require('./dom').parse;
var stringifyDom = require('./dom').stringify;
var readContents = require('./read-contents');
var File = require('vinyl');

/**
 * Returns a transformaton stream that applies content transformations from
 * `transform` stream to `file` contents
 * Applies `transform` stream on given stream-content Vinyl file instance
 * @param  {Vinyl} file Vinyl file instance to transform
 * @param  {stream.Transform} transform Transformation stream for file
 * is ready 
 */
module.exports = function(file, transform, options) {
	// XXX this is very important: clone file before actual processing starts.
	// Otherwise, when transformation process starts the actual file might 
	// be renamed which may lead to invalid results
	var f = cloneFile(file);
	return readContents(function(contents, callback) {
		var self = this;
		parseDom(contents.toString('utf8'), options, function(err, dom) {
			if (err) {
				f = null;
				return callback(err);
			}

			f.contents = contents;
			f.dom = dom;
			f.domOptions = options;
			f.stringify = stringify;

			// transform file content on DOM level
			transform
			.once('finish', function() {
				// write transformed tree as file content
				self.push(f.dom ? new Buffer(f.stringify()) : f.contents);
				f = null;
				callback();
			})
			.once('error', callback)
			.end(f);
		});
	});
}

function stringify() {
	return stringifyDom(this.dom, this.domOptions);
}

function cloneFile(file) {
	// do not use `file.clone()` here: if content is stream the original
	// reader stream will be paused because of absent cloned stream consumer
	return new File({
		cwd: file.cwd,
		base: file.base,
		stat: null,
		history: file.history.slice(),
		contents: null
	});
}