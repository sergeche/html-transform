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
	return vfs.src(pattern, Object.assign({
		cwd: __dirname,
		base: __dirname,
	}, options || {}));
}

function dest(dir) {
	return vfs.dest(path.join(__dirname, dir));
}

describe('Glob', function() {
	before(function(done) {
		del(['./out-stream', './out'], {cwd: __dirname}, done);
	});

	it('stream content', function(done) {
		src('./html/{urls,urls-preserve}.html', {buffer: false})
		.pipe(transform({
			prefix: '/a/b/c',
			mode: 'xhtml'
		}))
		.pipe(dest('out-stream'))
		.on('end', function() {
			assert.equal(read('out-stream/html/urls.html'), read('fixtures/urls1.html'));
			assert.equal(read('out-stream/html/urls-preserve.html'), read('fixtures/urls-preserve.html'));
			done();
		});
	});

	it('buffer content', function(done) {
		src('./html/{urls,urls-preserve}.html')
		.pipe(transform({
			prefix: '/a/b/c',
			mode: 'xhtml'
		}))
		.pipe(dest('out'))
		.on('end', function() {
			assert.equal(read('out/html/urls.html'), read('fixtures/urls1.html'));
			assert.equal(read('out/html/urls-preserve.html'), read('fixtures/urls-preserve.html'));
			done();
		});
	});
});
