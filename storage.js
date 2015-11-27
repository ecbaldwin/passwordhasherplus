<!--
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Password Hasher Plus
 *
 * The Initial Developer of the Original Code is Eric Woodruff.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Oren Ben-Kiki
 * Contributor(s): Carl Baldwin
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
-->

storage = {}

// This is meant to wrap localStorage with an interface that acts
// close enough to chrome.storage that it can be used as a replacement
// for it in this code.
storage.LOCAL = (function() {
	var get = function(keys, callback) {
		items = {};
		if (keys === null) {
			keys = Object.keys (localStorage);
		}
		if (typeof keys === "string") {
			items[keys] = localStorage.getItem(keys);
		} else if (keys instanceof Array) {
			for (var i=0; i < keys.length; i++) {
				var key = keys[i];
				if (typeof key !== "string") {
					throw "key is not a string.";
				}
				items[key] = localStorage.getItem(key);
			}
		} else {
			// TODO This method doesn't handle an object passed as
			// keys as specified in the chrome.storage api
			throw "keys is not a string or an array.";
		}
		callback(items);
	}
	var set = function(items, callback) {
		for (var key in items) {
			var item = items[key];
			if (items.hasOwnProperty(key)) {
				localStorage.setItem(key, item);
			}
		}

		if (callback) { callback(); }
	}
	var remove = function(keys, callback) {
		if (typeof keys === "string") {
			localStorage.removeItem(keys);
		} else if (keys instanceof Array) {
			for (var i=0; i < keys.length; i++) {
				var key = keys[i];
				if (typeof key !== "string") {
					throw "key is not a string.";
				}
				localStorage.removeItem(key);
			}
		} else {
			throw "keys is not a string or an array.";
		}
		if (callback) { callback(); }
	}
	var clear = function(callback) {
		localStorage.clear();
		if (callback) { callback(); }
	}
	return {
		get: get
	,	set: set
	,	remove: remove
	,	clear: clear
	}
})()

// Stores secrets locally and other data remotely.  Allows the rest of
// the application to continue operating as if there is only one store.
storage.HYBRID = (function(local, remote) {
	var LOCAL = local;
	var REMOTE = remote;
	var localKeys = {"version":true, "secrets":true};
	var divideKeys = function(keys) {
		if (keys === null) {
			return {"local": null, "remote": null};
		} else if (typeof keys === "string") {
			if (localKeys[keys]) {
				return {"local":[keys], "remote":[]}
			} else {
				return {"local":[], "remote":[keys]}
			}
		} else if (keys instanceof Array) {
			var local = [];
			var remote = [];
			for (var i = 0; i < keys.length; ++i) {
				key = keys[i];
				if (localKeys[key]) {
					local.push(key);
				} else {
					remote.push(key);
				}
			}
			return {"local":local, "remote":remote}
		} else {
			throw "Unhandled type for keys";
		}
	}
	var get = function(keys, callback) {
		var k = divideKeys(keys);
		LOCAL.get(k["local"], function(local) {
			REMOTE.get(k["remote"], function(items) {
				for (var key in local) { items[key] = local[key]; }

				callback(items);
			});
		})
	}
	var set = function(items, callback) {
		var k = divideKeys(Object.keys(items));
		var localKeys = k["local"];
		var local = {};
		for (var i = 0; i < localKeys.length; ++i) {
			var key = localKeys[i];
			local[key] = items[key];
			delete items[key];
		}
		LOCAL.set(local, function() {
			REMOTE.set(items, callback);
		})
	}
	var remove = function(keys, callback) {
		k = divideKeys(keys);
		LOCAL.remove(k["local"], function() {
			REMOTE.remove(k["remote"], callback);
		})
	}
	var clear = function(callback) {
		LOCAL.clear(function() {
			REMOTE.clear(callback);
		});
	}
	var newRemote = function(remote, callback) {
		if (REMOTE === remote) {
			callback();
			return;
		}
		var old_remote = REMOTE;
		REMOTE = remote;

		old_remote.get(null, function(items) {
			k = divideKeys(Object.keys(items));
			old_remote.get(k.remote, function(remote_items) {
				remote.set(remote_items, function() {
					old_remote.remove(k.remote, callback);
				});
			})
		})
	}
	return {
		get: get
	,	set: set
	,	remove: remove
	,	clear: clear
	,	newRemote: newRemote
	}
})(storage.LOCAL, storage.LOCAL)

// Use the hybrid storage as the main storage.
storage.RAW = storage.HYBRID;

storage.setObject = function (key, value, callback) {
	var str = JSON.stringify (value);
	if (debug) console.log ("Set " + key + " " + str);
	items = {};
	items[key] = str;
	this.RAW.set (items, callback);
}

storage.setObjects = function (items, callback) {
	objects = {};
	for (key in items) {
		var str = JSON.stringify (items[key]);
		if (debug) console.log ("Set " + key + " " + str);
		objects[key] = str;
	}
	this.RAW.set (objects, callback);
}

storage.getObject = function (key, callback) {
this.RAW.get (key, function(items) {
	var str = items[key];
	if (null == str) {
		if (debug) console.log ("Get " + key + " null");
		callback (null);
		return;
	}
	if (debug) console.log ("Get " + key + " " + str);
	callback(JSON.parse (str));
});
}

storage.getObjects = function (keys, callback) {
	this.RAW.get (keys, function(items) {
		for(var key in items) {
			var str = items[key];
			if (null == str) {
				if (debug) console.log ("Get " + key + " null");
				items[key] = null;
			} else {
				if (debug) console.log ("Get " + key + " " + str);
				items[key] = JSON.parse (str);
			}
		}
		callback(items);
	});
}

storage.addDefaultOptions = function(options, secrets, callback) {
	var dirty = false;
	if (!options) {
		options = new Object ();
		dirty = true;
	}
	if (!secrets) {
		secrets = new Object ();
		dirty = true;
	}
	if (null == secrets.privateSeed) {
		secrets.privateSeed = generateGuid ();
		dirty = true;
	}
	// This value is not secret.
	if (null == options.salt) {
		options.salt = generateGuid ();
		dirty = true;
	}
	if (null == secrets.seeds) {
		secrets.seeds = {};
		dirty = true;
	}
	var seedDigest = hex_hmac_sha1(
		options.salt,
		secrets.privateSeed).substring(0,7);
	if (null == secrets.seeds[seedDigest]) {
		secrets.seeds[seedDigest] = secrets.privateSeed;
		dirty = true;
	}
	if (null == options.defaultLength) {
		options.defaultLength = default_length;
		dirty = true;
	}
	if (null == options.defaultStrength) {
		options.defaultStrength = default_strength;
		dirty = true;
	}
	if (null == options.backedUp) {
		options.backedUp = false;
		dirty = true;
	}
	if (null == options.compatibilityMode) {
		options.compatibilityMode = false;
		dirty = true;
	}
	if (dirty) {
		this.saveOptions (options, secrets, function() {
			callback(options, secrets);
		});
	} else {
		callback(options, secrets);
	}
}

storage.saveOptions = function (options, secrets, callback) {
	var self = this;
	self.addDefaultOptions(options, secrets, function() {
		self.setObject ("options", options, function () {
			if (secrets !== undefined) {
				self.setObject ("secrets", secrets, callback);
			} else {
				callback();
			}
		});
	});
}

storage.loadOptions = function (callback) {
	var self = this;
	self.getObject ("options", function(options) {
		self.getObject ("secrets", function(secrets) {
			self.addDefaultOptions(options, secrets, callback);
		});
	});
}

storage.saveConfig = function (url, config, callback) {
	if (debug) console.log ("Saving " + url + " " + JSON.stringify (config));
	config.fields = toArray (config.fields);

	var options = config.options;
	var secrets = config.secrets;
	var policy = config.policy;
	delete config.policy;
	delete config.options;
	delete config.secrets;

	var tag = "tag:" + config.tag;
	var url = "url:" + url;
	items = {}
	items[tag] = policy;
	items[url] = config;
	this.setObjects(items, function() {
	config.policy = policy;
	config.options = options;
	config.secrets = secrets;
	if (callback) callback();
	});
}

storage.loadTags = function (callback) {
	this.RAW.get(null, function(items) {
		var tags = []
		for (var key in items) {
			if (key.startsWith ("tag:")) {
				tags.push (key.substringAfter ("tag:"));
			}
		}
		callback(tags);
	});
}

storage.isTagReferenced = function (items, tag) {
	for (var key in items) {
		if (key.startsWith ("url:")) {
			var config = items[key];
			if (config.tag == tag) {
				return true;
			}
		}
	}
	return false;
}

storage.collectGarbage = function (callback) {
	// remove unreferenced tags
	var self = this;
	self.getObjects(null, function(items) {
	var del_keys = [];
	for (var key in items) {
		if (key.startsWith ("tag:")) {
			if (!self.isTagReferenced (items, key.substringAfter ("tag:"))) {
				del_keys.push(key);
			}
		}
	}
	self.RAW.remove(del_keys, callback);
	});
}

storage.loadConfig = function (url, callback) {
	var self = this;
	self.getObject ("url:" + url, function(config) {
	if (null == config) {
		config = new Object ();
		config.tag = url;
		config.fields = new Array ();
	}

	self.loadOptions (function(options, secrets) {
	config.options = options;
	config.secrets = secrets;
	self.getObject ("tag:" + config.tag, function(policy) {
		config.policy = policy;

		if (null == config.policy) {
			config.policy = new Object ();
			config.policy.seedRef = hex_hmac_sha1(
				config.options.salt,
				config.secret.privateSeed).substring(0,7);
			config.policy.length = config.options.defaultLength;
			config.policy.strength = config.options.defaultStrength;
		}

		callback (config);
	});
	});
	});
}

storage.loadConfigs = function (callback) {
	var self = this;
	self.loadOptions (function(options, secrets) {
		self.getObjects (null, function(objects) {
			urls = {};
			for (key in objects) {
				if (key.startsWith ("url:")) {
					config = objects[key];
					config.options = options;
					config.secrets = secrets;
					var tag = "tag:" + config.tag;
					config.policy = objects[tag];

					if (! config.policy) {
						config.policy = new Object ();
						config.policy.seedRef = hex_hmac_sha1(
							config.options.salt,
							config.secrets.privateSeed).substring(0,7);
						config.policy.length = config.options.defaultLength;
						config.policy.strength = config.options.defaultStrength;
					}

					var url = key.slice (4);
					urls[url] = config;

				}
			}
			callback (urls);
		});
	});
}

var moveStorage = function(callback) {
	storage.LOCAL.get(["secrets", "options"], function(items) {
		var options = JSON.parse(items.secrets);
		if (! options) {
			var options = JSON.parse(items.options);
			if (! options) {
				options = Object();
			}
		}
		var storage_types = {};
		if (chrome.storage) {
			storage_types["chromelocal"] = chrome.storage.local;
			storage_types["chromesync"] = chrome.storage.sync;
		}

		var new_remote = chrome.storage.sync;
		if(options.storage && storage_types[options.storage]) {
			new_remote = storage_types[options.storage];
		}

		storage.HYBRID.newRemote(new_remote, callback);
	});
}

storage.migrate = function (callback) {
	var self = this;
	var migrate_v7 = function() {
		self.runMigration (7, function(c) {self.migrate_v7(c)}, function() {
			moveStorage(callback);
		});
	}
	var migrate_v6 = function() {
		self.runMigration (6, function(c) {self.migrate_v6(c)}, migrate_v7);
	}
	var migrate_v5 = function() {
		self.runMigration (5, function(c) {self.migrate_v5(c)}, migrate_v6);
	}
	var migrate_v4 = function() {
		self.runMigration (4, function(c) {self.migrate_v4(c)}, migrate_v5);
	}
	var migrate_v3 = function() {
		self.runMigration (3, function(c) {self.migrate_v3(c)}, migrate_v4);
	}
	var migrate_v2 = function() {
		self.runMigration (2, function(c) {self.migrate_v2(c)}, migrate_v3);
	}
	var migrate_v1 = function() {
		self.runMigration (1, function(c) {self.migrate_v1(c)}, migrate_v2);
	}

	self.RAW.get("version", function(version) {
		if (null == version) {
			self.RAW.get("option:private_seed", function(private_seed) {
				if (null != private_seed) {
					// Migrate Password Hasher Plus Plus databases
					self.RAW.set({"version": "1"}, migrate_v2);
				} else {
					self.RAW.set({"version": "0"}, migrate_v1);
				}
			})
			return;
		}
		migrate_v2();
	})
}

storage.migrate_v7 = function (callback) {
	var self = this;
	self.getObjects(null, function(items) {
		self.loadOptions(function(options) {
			var secrets = Object();
			secrets.privateSeed = options.privateSeed;
			secrets.seeds = options.seeds;
			secrets.storage = options.storage;
			delete options.privateSeed;
			delete options.seeds;
			delete options.storage;
			self.saveOptions(options, secrets, callback);
		});
	});
}

storage.migrate_v6 = function (callback) {
	var self = this;
	self.getObjects(null, function(items) {
	self.loadOptions(function(options) {
	var newitems = {};
	for (var key in items) {
		if (key.startsWith ("tag:")) {
			var value = items [key];
			if (value.seed) {
				console.log("Scrubbing secret for " + value.tag);
				value.seedRef = hex_hmac_sha1(
					options.salt,
					value.seed).substring(0,7);
				delete value.seed;
				newitems[key] = value;
			}
		}
	}
	self.setObjects(newitems, callback);
	});
	});
}

storage.migrate_v5 = function (callback) {
	var self = this;
	self.getObjects(null, function(items) {
	var newitems = {};
	for (var key in items) {
		if (key.startsWith ("url:")) {
			var config = items[key];
			var tagName = config.tag;
			var tag = new Object ();
			tag.strength = config.strength;
			tag.length = config.length;
			tag.seed = config.seed;
			delete config.strength;
			delete config.length;
			delete config.seed;
			newitems[key] = config;
			newitems["tag:" + tagName] = tag;
		}
	}
	self.setObjects(newitems, callback);
	});
}
storage.migrate_v4 = function (callback) {
	var self = this;
	self.RAW.get(null, function(items) {
	var options = new Object ();
	options.defaultLength = items["option:default_length"];
	options.defaultStrength = items["option:default_strength"];
	options.privateSeed = items["option:private_seed"];
	options.compatibilityMode = ("true" === items["option:compatibility_mode"]);
	options.backedUp = ("true" === items["option:backed_up"]);

	self.getObjects(null, function(objects) {
	var del_keys = [];
	var update_objects = {};
	for (var key in objects) {
		if (key.startsWith ("option:")) {
			del_items.push (key);
		} else if (key.startsWith ("url:")) {
			var config = objects[key];
			try {
				if (config.tag.startsWith ("compatible:")) {
					delete config.seed;
					config.tag = config.tag.substringAfter ("compatible:");
				}
				delete config.compatibilitymode;
				delete config.backedup;
				update_objects[key] = config;
			} catch (e) {
				console.log ("failed to migrate " + key);
			}
		}
	}

	self.RAW.remove(del_keys, function() {
		self.setObjects(update_objects, function() {
			self.saveOptions (options, undefined, callback)
		});
	});
	});
	});
}

storage.migrate_v3 = function (callback) {
	var self = this;
	self.getObjects(null, function(objects) {
	var set_objects = {};
	for (var key in objects) {
		if (!key.startsWith ("url:")) {
			continue;
		}
		try {
			var config = objects[key];
			var config2 = new Object ();
			config2.tag = config.site;
			for (var property in config) {
				config2[property] = config[property];
			}
			delete config2.site;
			set_objects[key] = config2;
		} catch (e) {
			console.log ("failed to migrate " + key);
		}
	}
	self.setObjects(set_objects, callback);
	});
}

storage.migrate_v2 = function (callback) {
	var self = this;
	self.RAW.get(null, function(items) {
	var set_items = {};
	var del_keys = [];
	var reg = new RegExp ("^site:.*$");
	for (var key in items) {
		if (reg.test (key)) {
			var to = "url";
			set_items[to + key.slice(4)] = items[key];
			del_keys.push(key);
		}
	}
	self.RAW.remove(del_keys, function() {
		self.RAW.set(set_items, callback);
	});
	});
}

storage.migrate_v1 = function (callback) {
	var self = this;
	self.RAW.get(null, function(items) {
	var set_items = {"version": "1"};
	var del_keys = [];
	var reg = new RegExp ("^compatibility_mode|default_length|default_strength|private_seed|backed_up$");
	for (var key in items) {
		var to = "site";
		if ("version" == key) {
			continue;
		} else if (reg.test (key)) {
			to = "option";
		}
		set_items[to + ":" + key] = items[key];
		del_keys.push(key);
	}
	self.RAW.remove(del_keys, function() {
		self.RAW.set(set_items, callback);
	});
	});
}

storage.runMigration = function (toVersion, func, callback) {
	var self = this;
	self.RAW.get("version", function(items) {
	var version = parseInt (items["version"]);
	if (toVersion <= version) {
		if (callback) callback();
		return;
	}

	func (function() {
		self.RAW.set({"version": toVersion}, callback);
	});
	});
}
