'use strict';

const htmlparser = require('htmlparser2');
const combine = require('stream-combiner2');
const rewriteUrl = require('./lib/rewrite-url');
const parseDom = require('./lib/parse-dom');
const stringifyDom = require('./lib/stringify');

/**
 * Creates file transformation pipeline: a stream that transforms passed
 * HTML files on object model level
 * @param  {Object} options
 * @return {stream.Duplex}
 */
module.exports = function(options) {
	var pipeline = [parseDom(options), rewriteUrl(options)];

	// use custom transformers, if provided
	// each `transform` entry must be a function that returns a transform stream
	if (options.transform) {
		var t = Array.isArray(options.transform) ? options.transform : [options.transform];
		t.forEach(streamFactory => pipeline.push(streamFactory(options)));
	}

	return combine.obj(pipeline);
};

module.exports.htmlparser = htmlparser;
module.exports.parseDom = parseDom;
module.exports.rewriteUrl = rewriteUrl;
module.exports.stringifyDom = stringifyDom;
