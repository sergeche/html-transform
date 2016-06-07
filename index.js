'use strict';

const htmlparser = require('htmlparser2');
const rewriteUrl = require('./lib/rewrite-url');
const parseDom = require('./lib/parse-dom');
const stringifyDom = require('./lib/stringify');
const fileStats = require('./lib/file-stats');

// Currently, only `rewriteUrl` process is supported. In future it might be
// replaced with more complex process
module.exports = rewriteUrl;
module.exports.stream = rewriteUrl.stream;

module.exports.htmlparser = htmlparser;
module.exports.parseDom = parseDom;
module.exports.rewriteUrl = rewriteUrl;
module.exports.stringifyDom = stringifyDom;
module.exports.fileStats = fileStats;
