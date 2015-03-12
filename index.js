var through = require('through2');
var rewriteUrl = require('./processor/rewrite-url');
var dom = require('./lib/dom');

module.exports.rewriteUrl = rewriteUrl;

module.exports.parseToDom = function(options) {
	options = options || {};
	return through.obj(function(file, enc, next) {
		if (file.isNull()) {
			return next(null, file);
		}

		if (file.isStream()) {
			return next(new Error('Streams are not supported'));
		}

		dom.parse(file.contents.toString('utf8'), options, function(err, dom) {
			if (dom) {
				file.dom = dom;
			}
			next(err, file);
		});
	});
};

module.exports.stringifyDom = function(options) {
	if (typeof options === 'string') {
		options = {mode: options};
	}

	options = options || {};

	return through.obj(function(file, enc, next) {
		if (file.dom) {
			file.contents = new Buffer(dom.stringify(file.dom, options));
		}

		next(null, file);
	});
};