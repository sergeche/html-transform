var fs = require('fs');
var path = require('path');
var assert = require('assert');
var vfs = require('vinyl-fs');
var rewrite = require('../processor/rewrite-url');
var transform = require('../');

function read(p) {
	return fs.readFileSync(path.join(__dirname, p), {encoding: 'utf8'});
}

describe('URL rewriter', function() {
	var stringify = transform.stringifyDom('xhtml');
	var save = vfs.dest(path.join(__dirname, 'out'));
	var run = function(file, rewriteOpt, callback) {
		return vfs.src(file, {cwd: __dirname, base: __dirname})
			.pipe(rewrite(rewriteOpt))
			.pipe(transform.stringifyDom('xhtml'))
			.pipe(vfs.dest(path.join(__dirname, 'out')))
			.on('end', callback);
	};

	it('transform URLs', function(done) {
		run('./html/urls.html', {prefix: '/a/b/c'}, function() {
			assert.equal(read('out/html/urls.html'), read('fixtures/urls1.html'));
			done();
		});
	});

	it('add custom tag to rewrite map', function(done) {
		run('./html/urls.html', {
			prefix: '/a/b/c',
			rewriteMapAddon: {
				foo: ['href']
			}
		}, function() {
			assert.equal(read('out/html/urls.html'), read('fixtures/urls2.html'));
			done();
		});
	});

	it('custom URL transformer', function(done) {
		run('./html/urls.html', {
			prefix: '/a/b/c',
			transform: function(url) {
				return '/-' + url;
			}
		}, function() {
			assert.equal(read('out/html/urls.html'), read('fixtures/urls3.html'));
			done();
		});
	});

	it('preserve hrefs', function(done) {
		run('./html/urls-preserve.html', {prefix: '/a/b/c'}, function() {
			assert.equal(read('out/html/urls-preserve.html'), read('fixtures/urls-preserve.html'));
			done();
		});
	});

	it('rewrite in scripts', function(done) {
		run('./html/script.html', {prefix: '/a/b/c'}, function() {
			assert.equal(read('out/html/script.html'), read('fixtures/script.html'));
			done();
		});
	});
});