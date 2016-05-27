/**
 * Creates DOM searializer stream: stringifies given DOM and passes
 * content to stream output
 */
'use strict';

const stream = require('stream');
const ElementType = require('domelementtype');
const entities = require('entities');
const html = require('./html.json');

const renderOptions = {
	xhtmlMode: true
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

/**
 * Creates DOM reader: readable stream that reads data from given DOM object
 * into string
 * @param  {Object} dom
 * @return {stream.Readable}
 */
module.exports.stream = function(dom, options) {
	options = Object.assign({}, renderOptions, options);
	return new stream.Readable({
        read() {
            this.push(render(dom, options));
            this.push(null);
        }
    });
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

		if (!value && html.booleanAttributes[key]) {
			output += key;
			if (opts.mode === 'xml' || opts.mode === 'xhtml') {
				output += '="' + key + '"';
			}
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
			tag += html.singleTag[elem.name] ? ' />' : '></' + elem.name + '>';
		}
	} else {
		tag += '>';
		tag += render(elem.children, opts);

		if (!html.singleTag[elem.name] || opts.mode === 'xml') {
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
	if (opts.decodeEntities && !(elem.parent && elem.parent.name in html.unencodedElements)) {
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
