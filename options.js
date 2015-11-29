
function setNewGuid () {
	var seedElement = document.getElementById ("seed");
	seedElement.value = generateGuid ();
}

function saveOptions (callback) {
	storage.loadOptions (function(options) {
	options.defaultLength = document.getElementById ("length").value;
	options.defaultStrength = document.getElementById ("strength").value;
	options.compatibilityMode = document.getElementById ("compatibility").checked;
	options.privateSeed = document.getElementById ("seed").value;
	options.backedUp = document.getElementById ("backedup").checked;
	chrome.extension.getBackgroundPage ().saveOptions (options, function() {
		refreshStorage (callback);
	});
	});
}

function restoreOptions (callback) {
	storage.loadOptions (function(options) {
	document.getElementById ("length").value = options.defaultLength;
	document.getElementById ("strength").value = options.defaultStrength;
	document.getElementById ("compatibility").checked = options.compatibilityMode;
	document.getElementById ("seed").value = options.privateSeed;
	document.getElementById ("backedup").checked = options.backedUp;
	if (callback) callback();
	});
}

function refreshStorage (callback) {
	storage.RAW.get(null, function(items) {
	var entries = [];
	for (key in items) {
		var value = items[key];
		var entry = {}
		if (key.slice(0, 7) == "option:") {
			entry[key] = value;
		} else {
			try {
				entry[key] = JSON.parse(value);
			} catch (e) {
				entry[key] = "BAD: " + value
			}
		}
		entry = JSON.stringify(entry);
		entry = entry.replace("{","").replace(/}$/,"");
		entries.push(entry);
	}
	entries.sort ();
	document.getElementById ("everything").value = "{\n" + entries.join(",\n") + "\n}\n";
	if (callback) callback();
	});
}

function clearStorage (callback) {
	if (confirm ("You are about to erase all of the Password Fortifier database. " +
			"This is typically done before loading a snapshot of a previous database state. " +
			"Are you certain you want to erase the database?")) {
		storage.RAW.clear (function() {
		alert ("Your database is now empty. " +
			  "You probably want to paste a previous snapshot of the database to the text area to the right, " +
			  "and hit \"Load\" to re-populate the database. " +
			  "Good luck.");
		storage.migrate (callback);
		});
		return;
	}
	storage.migrate (callback);
}

function loadStorage (callback) {
	try {
		everything = JSON.parse(document.getElementById ("everything").value);
	} catch(e) {
		alert("Sorry, the data in the text area to the right is not valid JSON.");
		return;
	}
	storage.RAW.clear (function() {
	items = {};
	for (var key in everything) {
		var value = everything[key];
		if (key.slice(0, 7) != "option:") value = JSON.stringify(value);
		items[key] = value;
	}
	storage.RAW.set(items, function() {
		storage.migrate (function() {
			restoreOptions (function() {
				refreshStorage (callback);
			});
		});
	});
	});
}

// Add event listeners once the DOM has fully loaded by listening for the
// `DOMContentLoaded` event on the document, and adding your listeners to
// specific elements when it triggers.
document.addEventListener('DOMContentLoaded', function () {
	storage.migrate (function () {
	restoreOptions (function() {
	refreshStorage (function() {
  
	$('#generate').click(setNewGuid);
	$('#backupSave').click(saveOptions);
	$('#backupRevert').click(restoreOptions);
	$('#removeUnUsedTags').click(function() {
		storage.collectGarbage (refreshStorage);
	});
	$('#dbClear').click(function() {
		clearStorage (function() {
            refreshStorage(restoreOptions)
        })
	});
	$('#dbSave').click(function() {loadStorage()});
	$('#dbRevert').click(function() {refreshStorage()});

	$('a').click(function() {chrome.tabs.create({url:'chrome-extension://'+location.hostname+'/passhashplus.html'})});
	});
	});
	});

});
