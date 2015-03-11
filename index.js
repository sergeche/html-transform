var vfs = require('vinyl-fs');
var rewriteUrl = require('./processor/rewrite-url');

module.exports.rewriteUrl = rewriteUrl;

vfs.src('./in/*.html')
	.pipe(rewriteUrl({prefix: '/a/b'}))
	.pipe(vfs.dest('./out'));