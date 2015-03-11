var fs = require('fs');
var path = require('path');
var assert = require('assert');
var vfs = require('vinyl-fs');
var rewrite = require('../processor/rewrite-url');

function read(p) {
	return fs.readFileSync(path.join(__dirname, p), {encoding: 'utf8'});
}

describe('URL rewriter', function() {
	it('transform URLs', function(done) {
		vfs.src('./html/urls.html', {cwd: __dirname, base: __dirname})
			.pipe(rewrite({prefix: '/a/b/c'}))
			.pipe(vfs.dest(path.join(__dirname, 'out')))
			.on('end', function() {
				console.log('===Actual===');
				console.log(read('out/html/urls.html'));

				console.log('===Expected===');
				console.log(read('fixtures/urls.html'));

				assert.equal(read('out/html/urls.html'), read('fixtures/urls.html'));
				done();
			});
	});

	// it('add custom tag to rewrite map', function() {
	// 	var doc = dom.parse(res.content);
	// 	var proc = rewrite({
	// 		cwd: __dirname,
	// 		prefix: '/a/b/c',
	// 		rewriteMap: {
	// 			foo: ['href']
	// 		}
	// 	});

	// 	proc(doc, res);
	// 	assert.equal(dom.stringify(doc), fixtures.urls2);
	// });

	// it('custom URL transformer', function() {
	// 	var doc = dom.parse(res.content);
	// 	var proc = rewrite({
	// 		cwd: __dirname,
	// 		prefix: '/a/b/c',
	// 		transform: function(url, info) {
	// 			return '/-' + url;
	// 		}
	// 	});

	// 	proc(doc, res);
	// 	assert.equal(dom.stringify(doc), fixtures.urls3);
	// });

	// it('preserve hrefs', function() {
	// 	var res =  new Resource({
	// 		cwd: __dirname,
	// 		file: 'html/urls-preserve.html',
	// 		prefix: '/a/b/c'
	// 	});

	// 	var doc = dom.parse(res.content);
	// 	var proc = rewrite({
	// 		cwd: __dirname,
	// 		prefix: '/a/b/c'
	// 	});

	// 	proc(doc, res);
	// 	assert.equal(dom.stringify(doc), fixtures.urlsPreserve);
	// });

	// it('rewrite in scripts', function() {
	// 	var res =  new Resource({
	// 		cwd: __dirname,
	// 		file: 'html/script.html',
	// 		prefix: '/a/b/c'
	// 	});

	// 	var doc = dom.parse(res.content);
	// 	var proc = rewrite({
	// 		cwd: __dirname,
	// 		prefix: '/a/b/c'
	// 	});

	// 	proc(doc, res);
	// 	assert.equal(dom.stringify(doc), fixtures.script);
	// });
});