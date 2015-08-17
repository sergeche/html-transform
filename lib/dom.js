var htmlparser = require('htmlparser2');
var DomHandler = require('domhandler');
var extend = require('xtend');
var stringifyDom = require('./stringify');

var defaultOptions = {
	xhtmlMode: true,
	parseCustomScript: true,
	sanitize: false
	// decodeEntities: true
};

/**
 * Parses given HTML/XML code into DOM
 * @param  {String} code String to parse
 * @return {Object}      DOM tree
 */
function parse(code, options, callback) {
	if (typeof options === 'function') {
		callback = options;
		options = {};
	}

	options = makeOptions(options);
	var handler = new DomHandler(function(err, dom) {
		if (err) {
			return callback(err);
		}

		if (options.parseCustomScript) {
			var h = new DomHandler();
			var scriptParser = new htmlparser.Parser(h, options);
			walk(dom, function(node) {
				if (node.name === 'script' || node.name === 'SCRIPT') {
					if (node.attribs.type && node.attribs.type.toLowerCase() !== 'text/javascript') {
						parseScriptContent(node, scriptParser, h);
					}
				}
			});
		}

		callback(null, dom);
	});
	var parser = new htmlparser.Parser(handler, options);
	parser.write(options.sanitize ? sanitize(code) : code);
	parser.done();
	return handler.dom;
}

/**
 * Replaces sybmols that can break HTML parsing
 * @param  {String} str
 * @return {String}
 */
function sanitize(str) {
	return str
		.replace(/[\x00-\x08]/g, '')
		.replace(/&(?!([a-z0-9]+|#x?\d+);)/g, '&amp;');
}

/**
 * Returns string representation of given DOM tree
 * @param  {Object} dom
 * @return {String}
 */
function stringify(dom, options) {
	return stringifyDom(dom, makeOptions(options));
}

function makeOptions(options) {
	return extend({}, defaultOptions, options);
}

function walk(nodes, fn) {
	if (!nodes) return;
	nodes.forEach(function(node, i) {
		fn(node, i);
		walk(node.children, fn);
	});
}

function parseScriptContent(node, parser, handler) {
	for (var i = node.children.length - 1, c; i >= 0; i--) {
		c = node.children[i];
		if (c.type === 'text') {
			parser.reset();
			parser.write(c.data);
			parser.done();
			Array.prototype.splice.apply(node.children, [i, 1].concat(handler.dom));
		}
	}
}

module.exports.parse = parse;
module.exports.sanitize = sanitize;
module.exports.stringify = stringify;