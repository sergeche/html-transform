var fs = require('fs');
var path = require('path');
var assert = require('assert');
var del = require('del');
var vfs = require('vinyl-fs');
var transform = require('../').stream;

function read(p) {
	return fs.readFileSync(path.join(__dirname, p), 'utf8');
}

function src(pattern, options) {
	return vfs.src(pattern, Object.assign({cwd: __dirname, base: __dirname}, options || {}));
}

function dest(dir) {
	return vfs.dest(path.join(__dirname, dir));
}

describe('URL rewriter', function() {
	before(() => del('./out', { cwd: __dirname }));

	it('transform URLs', function(done) {
		src('./html/urls.html')
		.pipe(transform({
			prefix: '/a/b/c',
			mode: 'xhtml'
		}))
		.pipe(dest('out'))
		.on('end', function() {
			assert.equal(read('out/html/urls.html'), read('fixtures/urls1.html'));
			done();
		});
	});

	it('add custom tag to rewrite map', function(done) {
		src('./html/urls.html')
		.pipe(transform({
			prefix: '/a/b/c',
			rewriteMapAddon: {
				foo: ['href']
			},
			mode: 'xhtml'
		}))
		.pipe(dest('out'))
		.on('end', function() {
			assert.equal(read('out/html/urls.html'), read('fixtures/urls2.html'));
			done();
		});
	});

	it('custom URL transformer', function(done) {
		src('./html/urls.html')
		.pipe(transform({
			prefix: '/a/b/c',
			transformUrl: function(url) {
				return '/-' + url;
			},
			mode: 'xhtml'
		}))
		.pipe(dest('out'))
		.on('end', function() {
			assert.equal(read('out/html/urls.html'), read('fixtures/urls3.html'));
			done();
		});
	});

	it('preserve hrefs', function(done) {
		src('./html/urls-preserve.html')
		.pipe(transform({
			prefix: '/a/b/c',
			mode: 'xhtml'
		}))
		.pipe(dest('out'))
		.on('end', function() {
			assert.equal(read('out/html/urls-preserve.html'), read('fixtures/urls-preserve.html'));
			done();
		});
	});

	it('rewrite in scripts', function(done) {
		src('./html/script.html')
		.pipe(transform({
			prefix: '/a/b/c',
			mode: 'xhtml'
		}))
		.pipe(dest('out'))
		.on('end', function() {
			assert.equal(read('out/html/script.html'), read('fixtures/script.html'));
			done();
		});
	});

	it('rewrite static assets', function(done) {
		src('./html/urls.html', {base: path.join(__dirname, './html')})
		.pipe(transform({
			prefix: '/a/b/c',
			transformUrl: function(url, file, ctx) {
				return ctx.stats ? '/-/' + ctx.stats.hash + url : url;
			},
			mode: 'xhtml'
		}))
		.pipe(dest('out/html'))
		.on('end', function() {
			assert.equal(read('out/html/urls.html'), read('fixtures/assets.html'));
			done();
		});
	});
});
