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
 * Contributor(s): (none)
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

var debug = false;

String.prototype.startsWith = function (str) {
	return (this.match ("^" + str) == str);
}

String.prototype.substringAfter = function (str) {
	return (this.substring (this.indexOf (str) + str.length));
}

var Set = function () {}
Set.prototype.add = function (o) { this[o] = true; }
Set.prototype.remove = function (o) { delete this[o]; }

function toSet (array) {
	var s = new Set ();
	for (var i = 0; i < array.length; ++i) {
		s.add (array[i]);
	}
	return s;
}

function toArray (s) {
	return Object.keys (s);
}

var default_length = 8;
var default_strength = 2;

function generateGuid () {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace (/[xy]/g, function(c) {
		var r = Math.random ()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
		return v.toString (16);
	}).toUpperCase ();
}

function generateHash (config, input) {
	var tag = config.tag;

	var seed = config.policy.seed;
	if (!seed) {
		var seedRef = config.policy.seedRef;
		if (seedRef) {
			seed = config.options.seeds[seedRef];
		}
	}
	if (false == config.options.compatibilityMode && null != seed) {
		tag = PassHashCommon.generateHashWord (
			seed,
			tag,
			24,
			true, // require digits
			true, // require punctuation
			true, // require mixed case
			false, // no special characters
			false // only digits
		);
	}

	return PassHashCommon.generateHashWord (
		tag,
		input,
		config.policy.length,
		true, // require digits
		config.policy.strength > 1, // require punctuation
		true, // require mixed case
		config.policy.strength < 2, // no special characters
		config.policy.strength == 0 // only digits
	);
}

function bump (tag) {
	var re = new RegExp ("^([^:]+?)(:([0-9]+))?$");
	var compatible = false;
	if (tag.startsWith ("compatible:")) {
		tag = tag.substringAfter ("compatible:");
		compatible = true;
	}
	var matcher = re.exec (tag);
	var bump = 1;
	if (null != matcher[3]) {
		tag = matcher[1];
		bump += parseInt (matcher[3]);
	}
	if (compatible) {
		tag = "compatible:" + tag;
	}
	return tag + ":" + bump;
}

function grepUrl (url) {
	//^(?:[^.]+\.){0,1}((?:[^.]+\.)*(?:[^.]+))\.(?:[^.]{2,15})$
	//http://www.regexplanet.com/simple/index.html
	var reg = new RegExp ("^https?://(?:([^:\\./ ]+?)|([0-9]{1,3}(?:\\.[0-9]{1,3}){3})|(?:[^:./ ]+\\.){0,1}((?:[^:./ ]+\\.)*(?:[^:. /]+))\\.(?:[^:. /]{2,15}))(?::\\d+)?/.*$");
	var m = reg.exec (url);
	try {
		for (var i = 0; i < 3; ++i) {
			if (null != m[i+1]) {
				return m[i+1];
			}
		}
		throw "unmatched";
	} catch (e) {
		return "chrome";
	}
}
