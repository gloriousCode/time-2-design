const { buildPebblePalette } = require("./palette");
const { buildConfigDataUrl } = require("./config_page");
const {
  loadConfig,
  saveConfig,
  normaliseConfig,
  parseConfigPayload,
  sendConfigToWatch
} = require("./config");

const palette = buildPebblePalette();

Pebble.addEventListener("ready", function() {
  // Push saved settings once JS is ready so the watchface restores persisted config.
  setTimeout(function() {
    sendConfigToWatch(loadConfig());
  }, 400);
});

Pebble.addEventListener("showConfiguration", function() {
  Pebble.openURL(buildConfigDataUrl(loadConfig(), palette));
});

Pebble.addEventListener("webviewclosed", function(event) {
  if (!event || !event.response) {
    return;
  }

  const payload = parseConfigPayload(event.response);

  if (!payload) {
    console.log("Invalid config response");
    return;
  }

  const config = normaliseConfig(payload);
  saveConfig(config);
  sendConfigToWatch(config);
});
