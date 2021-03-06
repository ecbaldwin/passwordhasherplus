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
    ,   set: set
    ,   remove: remove
    ,   clear: clear
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
    ,   set: set
    ,   remove: remove
    ,   clear: clear
    ,   newRemote: newRemote
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
    copy = {};
    for (var attr in config) {
        if (config.hasOwnProperty(attr)) {
            copy[attr] = config[attr];
        }
    }
    copy.fields = toArray (copy.fields);

    var options = copy.options;
    var secrets = copy.secrets;
    var policy = copy.policy;
    delete copy.policy;
    delete copy.options;
    delete copy.secrets;

    var url = "url:" + url;
    copy.length = policy.length;
    copy.strength = policy.strength;
    copy.seedRef = policy.seedRef;
    items = {}
    items[url] = copy;
    this.setObjects(items, function() {
        if (callback) callback();
    });
}

storage.loadTags = function (callback) {
    this.getObjects(null, function(items) {
        var tags = []
        for (var key in items) {
            item = items[key];
            if (key.startsWith ("url:")) {
                tags.push (item.tag);
            }
        }
        callback(tags);
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
            if (! config.seedRef) {
                config.seedRef = hex_hmac_sha1(
                    config.options.salt,
                    config.secrets.privateSeed).substring(0,7);
                config.length = config.options.defaultLength;
                config.strength = config.options.defaultStrength;
            }
            config.policy = {
                "seedRef": config.seedRef
            ,   "length": config.length
            ,   "strength": config.strength
            }
            callback (config);
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
                    config.policy = {
                        "seedRef": config.seedRef
                    ,   "length": config.length
                    ,   "strength": config.strength
                    }

                    if (! config.policy.seedRef) {
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
    var migrate_remove_tags = function() {
        self.migrate_remove_tags(callback);
    }
    var migrate_remove_secrets_from_tags = function() {
        self.migrate_remove_secrets_from_tags(migrate_remove_tags);
    }
    var remove_version = function() {
        self.RAW.remove("version", migrate_remove_secrets_from_tags);
    }
    var init_options = function() {
        self.loadOptions(remove_version);
    }
    var migrate_create_secrets = function() {
        self.migrate_create_secrets(init_options);
    }
    var move_storage = function() {
        moveStorage(migrate_create_secrets);
    }

    move_storage();
}

storage.migrate_remove_tags = function (callback) {
    var self = this;
    self.getObjects(null, function(items) {
        var newitems = {};
        var tags_to_remove = [];
        for (var key in items) {
            if (key.startsWith ("url:")) {
                var value = items [key];
                if (value.tag) {
                    console.log("Combining tag for " + value.url);
                    tag = items["tag:" + value.tag]
                    if (tag) {
                        value.length = tag.length;
                        value.strength = tag.strength;
                        value.seedRef = tag.seedRef;
                    }
                    newitems[key] = value;
                }
            }
            if (key.startsWith ("tag:")) {
                tags_to_remove.push(key);
            }
        }
        self.setObjects(newitems, function() {
            self.RAW.remove(tags_to_remove, callback);
        });
    });
}

storage.migrate_create_secrets = function (callback) {
    var self = this;
    self.getObjects(["options", "secrets"], function(items) {
        var options = items.options;
        if (! options) {
            if (callback) callback();
            return;
        }
        var secrets = items.secrets;
        if (! secrets) {
            secrets = Object();
            secrets.privateSeed = options.privateSeed;
            secrets.seeds = options.seeds;
            secrets.storage = options.storage;
        }
        delete options.privateSeed;
        delete options.seeds;
        delete options.storage;
        self.saveOptions(options, secrets, callback);
    });
}

storage.migrate_remove_secrets_from_tags = function (callback) {
    var self = this;
    self.getObjects(null, function(items) {
    var secrets = items.secrets;
    var options = items.options;
    var newitems = {};
    for (var key in items) {
        if (key.startsWith ("tag:")) {
            var value = items [key];
            if (value.seed) {
                console.log("Scrubbing secret for " + value.tag);
                value.seedRef = hex_hmac_sha1(
                    options.salt,
                    value.seed).substring(0,7);
                secrets.seeds[value.seedRef] = value.seed;
                delete value.seed;
                newitems[key] = value;
            }
        }
    }
    newitems["secrets"] = secrets;
    self.setObjects(newitems, callback);
    });
}
