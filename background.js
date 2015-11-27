
var ports = {};

function refreshTabs (callback) {
	var keys = toArray (ports);
	var post = function(key) {
		var port = ports[key];
		if (debug) console.log ("Loading " + port.passhashUrl + " for " + key);
		loadConfig (port.passhashUrl, function(config) {
			port.postMessage ({ update: config });
		});
	}
	for (var i = 0; i < keys.length; ++i) {
		post(keys[i]);
	}
	if (callback) callback();
}

function loadOptions (callback) {
	return storage.loadOptions (callback);
}

function saveOptions (options, secrets, callback) {
	storage.saveOptions (options, secrets, function() {
		refreshTabs (callback);
	});
}

function getKeys (callback) {
	storage.getKeys(callback);
}

function loadConfig (url, callback) {
	return storage.loadConfig (url, callback);
}

function loadConfigs (callback) {
	return storage.loadConfigs (callback);
}

function loadTags (callback) {
	return storage.loadTags (callback);
}

function saveConfig (url, config, callback) {
	storage.saveConfig (url, config, function() {
		refreshTabs (callback);
	});
}

storage.migrate (function () {

chrome.extension.onConnect.addListener (function (port) {
	console.assert (port.name == "passhash");
	var port_id = port.sender.id + "__" + port.sender.frameId;
	port.onMessage.addListener (function (msg) {
		if (msg.fields.length === 0) {
			return;
		}
		if (null != msg.init) {
			var url = grepUrl (msg.url);
			storage.loadConfig (url, function(config) {
			port.passhashUrl = url;
			ports[port_id] = port;
			port.postMessage ({ init: true, update: config });
			});
		} else if (null != msg.save) {
			var url = grepUrl (msg.url);
			saveConfig (url, msg.save, function() {});
		}
	});

	port.onDisconnect.addListener (function (port) {
		if (port_id in ports) {
			delete ports[port_id];
		}
	});
});

});

addRules = function() {
	matchPageWithPasswordField = new chrome.declarativeContent.PageStateMatcher({
		css: ["input[type='password']"]
	});
	matchPageWithPasswordFortifier = new chrome.declarativeContent.PageStateMatcher({
		css: [".passwordfortifier"]
	});
	actionShowPage = new chrome.declarativeContent.ShowPageAction();
	rules = [{
		conditions: [ matchPageWithPasswordField, matchPageWithPasswordFortifier ]
		, actions: [ actionShowPage ]
	}];
	chrome.declarativeContent.onPageChanged.addRules(rules);
}

resetRules = function() {
	// Remove all existing rules then the callback adds current ones back in.
	chrome.declarativeContent.onPageChanged.removeRules(undefined, addRules);
}

chrome.runtime.onInstalled.addListener(resetRules);
