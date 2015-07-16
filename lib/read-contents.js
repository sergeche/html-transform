/**
 * Create a readable stream that buffer entire stream content and calls
 * given `callback` with conatenated content
 */
'use strict';

var through = require('through2');

module.exports = function(callback) {
	var chunks = [];
	return through(function(chunk, enc, next) {
		chunks.push(chunk);
		next();
	}, function(next) {
		var contents = chunks.length < 2 ? chunks[0] : Buffer.concat(chunks);
		chunks = null;
		callback.call(this, contents, next);
	})
	.on('drain', resume);
}

function resume() {
	this.resume();
}