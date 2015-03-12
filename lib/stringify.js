/*
	Module dependencies
*/
var ElementType = require('domelementtype');
var entities = require('entities');

var booleanAttributes = {
	allowfullscreen: true,
	async: true,
	autofocus: true,
	autoplay: true,
	checked: true,
	controls: true,
	default: true,
	defer: true,
	disabled: true,
	hidden: true,
	ismap: true,
	loop: true,
	multiple: true,
	muted: true,
	open: true,
	readonly: true,
	required: true,
	reversed: true,
	scoped: true,
	seamless: true,
	selected: true,
	typemustmatch: true
};

var unencodedElements = {
	style: true,
	script: true,
	xmp: true,
	iframe: true,
	noembed: true,
	noframes: true,
	plaintext: true,
	noscript: true
};

function formatAttrs(attributes, opts) {
	if (!attributes) return;

	var output = '', value;

	// Loop through the attributes
	for (var key in attributes) {
		value = attributes[key];
		if (output) {
			output += ' ';
		}

		if (!value && booleanAttributes[key]) {
			output += key;
		} else {
			// output += key + '="' + (opts.decodeEntities ? entities.encodeXML(value) : value) + '"';
			output += key + '="' + sanitizeAttrValue(value, opts) + '"';
		}
	}

	return output;
}

function sanitizeAttrValue(value, opts) {
	value = opts.decodeEntities ? entities.encodeXML(value) : value;
	return value.replace(/"/g, '&quot;');
}

/*
	Self-enclosing tags (stolen from node-htmlparser)
*/
var singleTag = {
	area: true,
	base: true,
	basefont: true,
	br: true,
	col: true,
	command: true,
	embed: true,
	frame: true,
	hr: true,
	img: true,
	input: true,
	isindex: true,
	keygen: true,
	link: true,
	meta: true,
	param: true,
	source: true,
	track: true,
	wbr: true,
};

var render = module.exports = function(dom, opts) {
	if (!Array.isArray(dom)) {
		dom = [dom];
	}
	opts = opts || {};

	return dom.map(function(elem) {
		if (ElementType.isTag(elem)) {
			return renderTag(elem, opts);
		}

		switch (elem.type) {
			case 'root':
				return render(elem.children, opts);
			
			case ElementType.Directive:
				return renderDirective(elem, opts);
			
			case ElementType.Comment:
				return renderComment(elem, opts);

			case ElementType.CDATA:
				return renderCdata(elem, opts);

			default:
				return renderText(elem, opts);

		}
	}).join('');
};

function renderTag(elem, opts) {
	var tag = '<' + elem.name;
	var attribs = formatAttrs(elem.attribs, opts);

	if (attribs) {
		tag += ' ' + attribs;
	}

	var hasChildren = elem.children && elem.children.length;

	if (opts.mode === 'xml' && !hasChildren) {
		tag += '/>';
	} else if (opts.mode === 'xhtml') {
		if (hasChildren) {
			tag += '>';
			tag += render(elem.children, opts);
			tag += '</' + elem.name + '>';
		} else {
			tag += singleTag[elem.name] ? ' />' : '></' + elem.name + '>';
		}
	} else {
		tag += '>';
		tag += render(elem.children, opts);

		if (!singleTag[elem.name] || opts.mode === 'xml') {
			tag += '</' + elem.name + '>';
		}
	}
	
	return tag;
}

function renderDirective(elem) {
	return '<' + elem.data + '>';
}

function renderText(elem, opts) {
	var data = elem.data || '';

	// if entities weren't decoded, no need to encode them back
	if (opts.decodeEntities && !(elem.parent && elem.parent.name in unencodedElements)) {
		data = entities.encodeXML(data);
	}

	return data;
}

function renderCdata(elem) {
	return '<![CDATA[' + elem.children[0].data + ']]>';
}

function renderComment(elem) {
	return '<!--' + elem.data + '-->';
}
