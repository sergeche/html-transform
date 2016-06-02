/**
 * Rewrites URLs found in given Vinyl HTML file content.
 * URLs are rewritten on DOM level.
 *
 * Each file path found in document will be resolved against `root` property
 * (e.g. will always produce absolute URL) and receive `prefix` option.
 * After that, computed URL will be passed to `transformUrl` option method along
 * with context node and file stats object for further URL transform
 */
'use strict';

const path = require('path');
const stream = require('stream');
const fileStats = require('./file-stats');
const parseDOM = require('./parse-dom');

const defaultConfig = {
	/**
	 * Prefix to add to rewritten url
	 */
	prefix: '',

	/**
	 * Check if given node should be passed to URL rewriter
	 * @param  {Object} node DOM element
	 * @return {Array} Array of attributes to be rewrutted on given node
	 */
	match: function(node) {
		if (node && node.name) {
			var attrs = [].concat(this.rewriteMap[node.name] || [], this.staticMap[node.name] || []);
			return attrs.length ? attrs : null;
		}
	},

	/**
	 * Check if given URL is valid for rewriting
	 * @param  {String}
	 * @return {Boolean}
	 */
	validUrl: function(url, node) {
		if (node.attribs && node.attribs['data-href'] === 'preserve') {
			return false;
		}

		return !(/^[a-z]+:/i.test(url) || /^\/\//.test(url));
	},

	/**
	 * Method is called right before rewritten URL is witten back
	 * to element attribute. Can be used to arbitrary change URL
	 * @param  {String} url  Rewritten URL
	 * @param  {File} file Vinyl file instance
	 * @param  {Object} ctx Context object used for transformation
	 * @return {String}
	 */
	transformUrl: function(url, file, ctx) {
		return url;
	},

	/**
	 * Map of elements and their attributes to be rewritten
	 */
	rewriteMap: {
		a: ['href'],
		iframe: ['src'],
		form: ['action'],
		area: ['href']
	},

	/**
	 * Map of elements and their attributes that point to a static
	 * resource. URLs from this map can be treated differently:
	 * for example, it is possible to add cache-busting tokens
	 */
	staticMap: {
		img: ['src'],
		script: ['src'],
		link: ['href'],
		video: ['src'],
		audio: ['src'],
		source: ['src'],
		embed: ['src'],
		object: ['data']
	},

	/**
	 * The `rewriteMapAddon` (object), if given, will be merged
	 * with `rewriteMap`.
	 */
	rewriteMapAddon: null
};

module.exports = function(file, config) {
	config = createConfig(config);

	return parseDOM(file, config)
	.then(file => {
		var base = path.resolve(file.cwd, file.base);
		findNodesToRewrite(file.dom, config).forEach(function(item) {
			var attrName = item.attribute;
			var attrValue = item.node.attribs[attrName];

			// keep only valid urls
			var urls = extractUrls(attrName, attrValue)
			.filter(obj => config.validUrl(obj.url, item.node, attrName))
			.reverse();

			urls.forEach(obj => {
				var absUrl = absoluteUrl(obj.url, file.path, base);
				var targetUrl = rebuildUrl(absUrl, config.prefix);
				var _static = isStatic(item.node, attrName, config);

				if (config.transformUrl) {
					targetUrl = config.transformUrl(targetUrl, file, {
						clean: absUrl,
						config: config,
						type: 'html',
						node: item.node,
						isStatic: _static,
						stats: _static ? fileStats(absUrl, file, config) : null,
						attribute: attrName
					});
				}

				attrValue = attrValue.slice(0, obj.pos) + targetUrl + attrValue.slice(obj.pos + obj.url.length);
			});

			item.node.attribs[item.attribute] = attrValue;
		});

		return file;
	});
};

/**
 * Transform stream for rewriting URLs in a stream of Vinyl files (Gulp/VinylFS)
 * @return {stream.Transform}
 */
module.exports.stream = function(config) {
    return new stream.Transform({
		objectMode: true,
        transform(file, enc, next) {
			module.exports(file, config)
			.then(file => next(null, file), next);
        }
    });
};

module.exports.config = defaultConfig;
module.exports.createConfig = createConfig;
module.exports.absoluteUrl = absoluteUrl;
module.exports.rebuildUrl = rebuildUrl;

function createConfig(config) {
	if (typeof config === 'function') {
		config = {transformUrl: config};
	}

	var out = Object.assign({}, defaultConfig, config);
	if (config && config.rewriteMapAddon) {
		out.rewriteMap = Object.assign({}, defaultConfig.rewriteMap, config.rewriteMapAddon);
	}

	if (config && config.staticMapAddon) {
		out.staticMap = Object.assign({}, defaultConfig.staticMap, config.staticMapAddon);
	}

	return out;
}

/**
 * Returns absolute URL for given resource
 * @param  {String} url       URL to resolve (for example, value of <img src="">)
 * @param  {String} parentUrl Path to parent file that refers `url`
 * @param  {String} root      Path to document root.
 * @return {String}
 */
function absoluteUrl(url, parentUrl, root) {
	if (url[0] === '/') {
		return url;
	}

	var out = path.normalize(path.join(path.dirname(parentUrl), url));
	// console.log('out', out);
	if (out.substr(0, root.length) === root) {
		out = out.substr(root.length);
		// console.log('trim root', root, out);
		if (out[0] !== '/') {
			out = '/' + out;
		}
	}

	return out;
}

/**
 * Rebuilds given URL: adds `prefix` and normalizes result
 * @param  {String} url
 * @param  {String} prefix
 * @return {String}
 */
function rebuildUrl(url, prefix) {
	if (prefix) {
		url = path.join(prefix, url).replace(/\/{2,}/g, '/');
	}

	return url;
}

function findNodesToRewrite(nodes, config, out) {
	out = out || [];
	nodes.forEach(function(node) {
		var attrs = config.match(node);
		if (attrs) {
			attrs.forEach(function(name) {
				if (node.attribs[name]) {
					out.push({
						node: node,
						attribute: name
					});
				}
			});
		}

		// always add nodes with `style` attribute
		if (node.attribs && node.attribs.style && (!attrs || attrs.indexOf('style') === -1)) {
			out.push({
				node: node,
				attribute: 'style'
			});
		}

		if (node.children) {
			findNodesToRewrite(node.children, config, out);
		}
	});

	return out;
}

/**
 * Check if given attribute in DOM node refers to static
 * page asset (e.g. CSS, JS)
 * @param  {Object} node
 * @param  {String} attribute
 * @param  {Objec}  config
 * @return {Boolean}
 */
function isStatic(node, attribute, config) {
	var staticAttrs = config.staticMap[node.name];
	return attribute === 'style' || (staticAttrs && ~staticAttrs.indexOf(attribute));
}

function extractUrls(attrName, attrValue) {
	var urls = [];
	if (attrName === 'style') {
		// `style` is special attribute: it may contain resource
		// references as `url(...)` tokens
		var reUrl = /\b(url\(['"]?)(.+?)['"]?\)/g, m;
		while (m = reUrl.exec(attrValue)) {
			urls.push({
				url: m[2],
				pos: m.index + m[1].length
			});
		}
	} else {
		urls.push({url: attrValue, pos: 0});
	}
	return urls;
}
