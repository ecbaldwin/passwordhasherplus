var url;
var config;

function writeModel () {
    config.tag = $('#tag').val ();
    config.policy.length = $('#length').val ();
    config.policy.strength = $('#strength').val ();
    config.policy.seedRef = $('#secret').val ();
    chrome.extension.getBackgroundPage ().saveConfig (url, config);
}
window.onunload = writeModel;

function readModel () {
    chrome.extension.getBackgroundPage ().loadTags (function(tags) {
        $('#tag').val (config.tag);
        $('#tag').autocomplete ({ source: tags });
        $('#length').val (config.policy.length);
        $('#strength').val (config.policy.strength);
        $('#secret').empty()
        for(var key in config.secrets.seeds) {
            var latest = "";
            if(config.secrets.seeds[key] === config.secrets.privateSeed) {
                latest = " (latest)";
            }
            $('#secret').append(
                '<option value="' + key + '">' + key + latest + '</option>');
        }
        if(! config.policy.seedRef in config.secrets.seeds) {
            $('#secret').append(
                '<option value="' + config.policy.seedRef + '">' + config.policy.seedRef + '</option>');
        }
        $('#secret').val (config.policy.seedRef);
        if (false == config.options.backedUp) {
            $('div#compatmodeheader').html ("<b>Warning:</b>");
            $('div#compatmode').text ("You have not yet indicated that you have backed up your private key. Please do so on the Options page.");
        }
    });
}

chrome.tabs.getSelected (null, function (tab) {
    url = chrome.extension.getBackgroundPage ().grepUrl (tab.url);
    chrome.extension.getBackgroundPage ().loadConfig (url, function(c) {
        config = c;
        config.fields = toSet (config.fields);
        readModel ();
    });
});

$('#bump').click (function () {
    $("#tag").val (bump ($("#tag").val ()));
    writeModel ();
});

$('#tag').change (writeModel);
$('#length').change (writeModel);
$('#strength').change (writeModel);
$('#secret').change (writeModel);
