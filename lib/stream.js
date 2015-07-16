/**
 * Transformation pipeline for stream-based Vinyl files
 */
'use strict';

var through = require('through2');
var parseDom = require('./dom').parse;
var stringifyDom = require('./dom').stringify;
var readContents = require('./read-contents');

/**
 * Returns a transformaton stream that applies content transformations from
 * `transform` stream to `file` contents
 * Applies `transform` stream on given stream-content Vinyl file instance
 * @param  {Vinyl} file Vinyl file instance to transform
 * @param  {stream.Transform} transform Transformation stream for file
 * is ready 
 */
module.exports = function(file, transform, options) {
	return readContents(function(contents, callback) {
		var self = this;
		parseDom(contents.toString('utf8'), options, function(err, dom) {
			if (err) {
				return callback(err);
			}

			var f = file.clone();
			f.contents = contents;
			f.dom = dom;
			f.domOptions = options;
			f.stringify = stringify;

			// transform file content on DOM level
			transform
			.once('finish', function() {
				// write transformed tree as file content
				self.push(f.dom ? new Buffer(f.stringify()) : f.contents);
				callback();
			})
			.end(f);
		});
	});
}

function stringify() {
	return stringifyDom(this.dom, this.domOptions);
}