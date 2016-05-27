'use strict';
const path = require('path');
const fs = require('fs');
const crc = require('crc');

const fileStatCache = {};
const defaultConfig = {
	statCacheTime: 5000
};

module.exports = function(url, parentFile, config) {
	config = Object.assign({}, defaultConfig, config || {});
	var file = path.join(parentFile.base, url);
	if (!fileStatCache[file] || fileStatCache[file].created < Date.now() + config.statCacheTime) {
		var stats = Object.create(null, {
			hash: {
				enumerable: true,
				get: function() {
					if (this.error) {
						throw new Error(this.error.message);
					}

					if (!this._hash) {
						this._hash = crc.crc32(fs.readFileSync(file))
					}

					return this._hash;
				}
			}
		});

		try {
			var s = fs.statSync(file);
			if (s.isFile()) {
				stats.modified = s.mtime;
				stats.created = s.birthtime;
				stats.size = s.size;
				stats.inode = s.ino;
			}
		} catch (e) {
			stats.error = e;
		}

		fileStatCache[file] = {
			stats: stats,
			created: Date.now()
		};
	}
	return fileStatCache[file].stats;
};
