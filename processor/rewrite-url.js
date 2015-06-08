/**
 * Стандартный препроцессор документа, который меняет ссылки 
 * на ресурсы внутри HTML/XML документа. Работает на основе конфига:
 * пути относительно `root` превращаются в абсолютные
 * и им добавляется `prefix`.
 * Полученный адрес может быть переработан методом `transformUrl`. 
 */
var path = require('path');
var fs = require('graceful-fs');
var extend = require('xtend');
var through = require('through2');
var crc = require('crc');
var ensureDom = require('../lib/ensure-dom');

var fileStatCache = {};

var defaultConfig = {
	/**
	 * How much time (milliseconds) a static asset
	 * stats should be cached
	 */
	statCacheTime: 5000,

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
		form: ['action']
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


function createConfig(config) {
	if (typeof config === 'function') {
		config = {transformUrl: config};
	}

	var out = extend({}, defaultConfig, config);
	if (config && config.rewriteMapAddon) {
		out.rewriteMap = extend({}, defaultConfig.rewriteMap, config.rewriteMapAddon);
	}
	
	if (config && config.staticMapAddon) {
		out.staticMap = extend({}, defaultConfig.staticMap, config.staticMapAddon);
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
 * Переделывает указанный URL: добавляет к нему `prefix` и следит 
 * за «чистотой» адреса 
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
				if (node.attribs[name] && config.validUrl(node.attribs[name], node)) {
					out.push({
						node: node,
						attribute: name
					});
				}
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
	return staticAttrs && ~staticAttrs.indexOf(attribute);
}

function getFileStats(url, parentFile, config) {
	var file = path.join(parentFile.base, url);
	if (!fileStatCache[file] || fileStatCache[file].created < Date.now() + config.statCacheTime) {
		var stats = null;

		try {
			var s = fs.statSync(file);
			if (s.isFile()) {
				stats = {
					modified: s.mtime,
					created: s.birthtime,
					size: s.size,
					inode: s.ino
				};

				Object.defineProperty(stats, 'hash', {
					enumerable: true, 
					get: function() {
						if (!this._hash) {
							this._hash = crc.crc32(fs.readFileSync(file))
						}

						return this._hash;
					}
				});
			}
		} catch (e) {
			console.warn(e.message);
		}

		fileStatCache[file] = {
			stats: stats,
			created: Date.now()
		};
	}
	return fileStatCache[file].stats;
}

module.exports = function(config) {
	config = createConfig(config);
	return through.obj(function(file, enc, next) {
		module.exports.process(file, config, next);
	});
};

module.exports.process = function(file, config, callback) {
	config = config || defaultConfig;

	ensureDom(file, function(dom) {
		var base = path.resolve(file.cwd, file.base);
		findNodesToRewrite(dom, config).forEach(function(item) {
			var absUrl = absoluteUrl(item.node.attribs[item.attribute], file.path, base);
			var targetUrl = rebuildUrl(absUrl, config.prefix);
			var _static = isStatic(item.node, item.attribute, config);

			if (config.transformUrl) {
				targetUrl = config.transformUrl(targetUrl, file, {
					clean: absUrl,
					config: config,
					node: item,
					isStatic: _static,
					stats: _static ? getFileStats(absUrl, file, config) : null,
					attribute: item.attribute
				});
			}

			item.node.attribs[item.attribute] = targetUrl;
		});
	}, config, callback);
};

module.exports.config = defaultConfig;
module.exports.createConfig = createConfig;
module.exports.absoluteUrl = absoluteUrl;
module.exports.rebuildUrl = rebuildUrl;
