/**
 * Create a readable stream that buffer entire stream content and calls
 * given `callback` with conatenated content
 */
'use strict';

var through = require('through2');

module.exports = function(callback) {
	var stream = through(read, flush);
	stream.chunks = [];
	stream.callback = callback;
	return stream;
};

function read(chunk, enc, next) {
	this.chunks.push(chunk);
	next();
}

function flush(next) {
	var contents = this.chunks.length < 2 ? this.chunks[0] : Buffer.concat(this.chunks);
	this.chunks = null;
	this.callback(contents, next);
}