/**
 * Стандартный препроцессор документа, который меняет ссылки 
 * на ресурсы внутри HTML/XML документа. Работает на основе конфига:
 * пути относительно `root` превращаются в абсолютные
 * и им добавляется `prefix`.
 * Полученный адрес может быть переработан методом `transform`. 
 */
var path = require('path');
var extend = require('xtend');
var through = require('through2');
var ensureDom = require('../lib/ensure-dom');

var defaultConfig = {
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
		return node && node.name && this.rewriteMap[node.name];
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
	transform: function(url, file, ctx) {
		return url;
	},

	/**
	 * Map of elements and their attributes to be rewritten
	 */
	rewriteMap: {
		script: ['src'],
		link: ['href'],
		a: ['href'],
		video: ['src'],
		audio: ['src'],
		iframe: ['src'],
		source: ['src'],
		embed: ['src'],
		form: ['action'],
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
		config = {transform: config};
	}

	var out = extend({}, defaultConfig, config);
	if (config && config.rewriteMapAddon) {
		out.rewriteMap = extend({}, defaultConfig.rewriteMap, config.rewriteMapAddon);
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

	// console.log('Build abs url', url, parentUrl, root);

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
 * @param  {String} url    Абсолютный URL, который нужно переделать
 * @param  {String} prefix Префикс, который нужно добавить к адресу
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

module.exports = function(config) {
	config = createConfig(config);
	return through.obj(function(file, enc, next) {
		var base = path.resolve(file.cwd, file.base);
		ensureDom(file, function(dom) {
			findNodesToRewrite(dom, config).forEach(function(item) {
				var absUrl = absoluteUrl(item.node.attribs[item.attribute], file.path, base);
				// console.log('ABS', absUrl);
				var targetUrl = rebuildUrl(absUrl, config.prefix);
				// console.log('TARGET', targetUrl);
				if (config.transform) {
					targetUrl = config.transform(targetUrl, file, {
						clean: absUrl,
						config: config,
						node: item,
						attribute: item.attribute
					});
				}

				// console.log('TARGET2', targetUrl);

				item.node.attribs[item.attribute] = targetUrl;
			});
		}, config, next);
	});
};

module.exports.config = defaultConfig;
module.exports.absoluteUrl = absoluteUrl;
module.exports.rebuildUrl = rebuildUrl;