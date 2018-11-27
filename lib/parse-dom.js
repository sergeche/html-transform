/**
 * Parses given Vinyl file object into HTML DOM and replaces `content` with
 * stream that will return stringified content of DOM. The DOM itself is available
 * as `.dom` property of Vinyl file.
 *
 * Module returns Transform stream, that can be attached to VinylFS reader:
 * `vfs.src('./*.xml').pipe(parseDOM.stream())`
 */
'use strict';

const stream = require('stream');
const htmlparser = require('htmlparser2');
const DomHandler = require('domhandler');
const stringify = require('./stringify');

const defaultOptions = {
	xhtmlMode: true,
	parseCustomScript: true,
	sanitize: false
	// decodeEntities: true
};

/**
 * Parse HTML content into DOM in given Vinyl file and saves it as `.dom`
 * property of file object. It will also replace content of given file with
 * stream that will stringify contents of DOM on-demand.
 * It won’t do anything if Vinyl file is a stream and already contains `.dom`
 * property
 * @param  {Vinyl} file
 * @param  {Object} options [description]
 * @return {Promise}
 */
var parseDOM = module.exports = function(file, options) {
	if (file.isStream() && file.dom) {
		return Promise.resolve(file);
	}

	return readFile(file)
		.then(content => parse(content.toString(), options))
		.then(dom => {
			file.dom = dom;
			file.contents = stringify.stream(dom, options);
			return file;
		});
};

/**
 * Transform stream for parsing DOM in a stream of Vinyl files (Gulp/VinylFS)
 * @return {stream.Transform}
 */
module.exports.stream = function(options) {
	return new stream.Transform({
		objectMode: true,
		transform(file, enc, next) {
			parseDOM(file, options).then(file => next(null, file), next);
		}
	});
};

/**
 * Reads content of given Vinyl file
 * @param  {Vinyl} file
 * @return {Promise}
 */
function readFile(file) {
	return new Promise(resolve => {
		if (file.isStream()) {
			const chunks = [];
			file.contents.pipe(new stream.Transform({
				transform(chunk, enc, next) {
					chunks.push(chunk);
					next();
				},
				flush(next) {
					const content = Buffer.concat(chunks);
					this.push(content);
					resolve(content);
					next();
				}
			}));
			file.contents.resume();
		} else {
			resolve(file.contents);
		}
	});
}

/**
 * Parses given HTML/XML code into DOM
 * @param  {String} code String to parse
 * @return {Object}      DOM tree
 */
function parse(code, options) {
	return new Promise((resolve, reject) => {
		options = makeOptions(options);

		var handler = new DomHandler((err, dom) => {
			if (err) {
				return reject(err);
			}

			if (options.parseCustomScript) {
				var h = new DomHandler();
				var scriptParser = new htmlparser.Parser(h, options);
				walk(dom, node => {
					if (node.name === 'script' || node.name === 'SCRIPT') {
						if (node.attribs.type && node.attribs.type.toLowerCase() !== 'text/javascript') {
							parseScriptContent(node, scriptParser, h);
						}
					}
				});
			}

			resolve(dom);
		});
		var parser = new htmlparser.Parser(handler, options);
		parser.write(options.sanitize ? sanitize(code) : code);
		parser.done();
		return handler.dom;
	});
}

/**
 * Replaces symbols that can break HTML parsing
 * @param  {String} str
 * @return {String}
 */
function sanitize(str) {
	return str
		.replace(/[\x00-\x08]/g, '')
		.replace(/&(?!([a-z0-9]+|#x?\d+);)/g, '&amp;');
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

function makeOptions(options) {
	return Object.assign({}, defaultOptions, options || {});
}

function walk(nodes, fn) {
	if (!nodes) return;
	nodes.forEach((node, i) => {
		fn(node, i);
		walk(node.children, fn);
	});
}
