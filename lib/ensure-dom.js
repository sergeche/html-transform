/**
 * Ensures that given Vinyl file contains DOM
 * and dumps it back to file contents when processing
 * is finished
 */
var dom = require('./dom');

module.exports = function(file, fn, options, next) {
	if (typeof options === 'function') {
		next = options;
		options = {};
	}
	options = options || {};

	var run = function(tree) {
		fn(tree);
		next(null, file);
	};

	if (!file.dom) {
		dom.parse(file.contents.toString('utf8'), options, function(err, dom) {
			if (err) {
				return file.emit('error', err);
			}

			run(file.dom = dom);
		});
	} else {
		run(file.dom);
	}
};
