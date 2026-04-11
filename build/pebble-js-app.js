/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

	__webpack_require__(1);
	module.exports = __webpack_require__(2);


/***/ }),
/* 1 */
/***/ (function(module, exports) {

	/**
	 * Copyright 2024 Google LLC
	 *
	 * Licensed under the Apache License, Version 2.0 (the "License");
	 * you may not use this file except in compliance with the License.
	 * You may obtain a copy of the License at
	 *
	 *     http://www.apache.org/licenses/LICENSE-2.0
	 *
	 * Unless required by applicable law or agreed to in writing, software
	 * distributed under the License is distributed on an "AS IS" BASIS,
	 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	 * See the License for the specific language governing permissions and
	 * limitations under the License.
	 */
	
	(function(p) {
	  if (!p === undefined) {
	    console.error('Pebble object not found!?');
	    return;
	  }
	
	  // Aliases:
	  p.on = p.addEventListener;
	  p.off = p.removeEventListener;
	
	  // For Android (WebView-based) pkjs, print stacktrace for uncaught errors:
	  if (typeof window !== 'undefined' && window.addEventListener) {
	    window.addEventListener('error', function(event) {
	      if (event.error && event.error.stack) {
	        console.error('' + event.error + '\n' + event.error.stack);
	      }
	    });
	  }
	
	})(Pebble);


/***/ }),
/* 2 */
/***/ (function(module, exports) {

	const STORAGE_KEY = "emery-colour-hands-config";
	
	const FACE_MODES = {
	  HANDS: "hands",
	  DIGITAL: "digital",
	  LARGE_DIGITAL: "largedigital"
	};
	
	const defaults = {
	  bgColour: "#ffffaa",
	  hourColour: "#5555aa",
	  minuteColour: "#ff5500",
	  handColour: "black",
	  faceMode: FACE_MODES.HANDS,
	  showDateTiles: false
	};
	
	const PRESETS = {
	  trioWayClassic: {
	    label: "TrioWay Classic",
	    bgColour: "#ffffaa",
	    hourColour: "#5555aa",
	    minuteColour: "#ff5500"
	  },
	  slateSun: {
	    label: "Slate Sun",
	    bgColour: "#d8dedf",
	    hourColour: "#5f6e77",
	    minuteColour: "#d66a2b"
	  },
	  oceanMint: {
	    label: "Ocean Mint",
	    bgColour: "#dff2ec",
	    hourColour: "#4f7f8f",
	    minuteColour: "#1b9e91"
	  },
	  duskBloom: {
	    label: "Dusk Bloom",
	    bgColour: "#f3e2de",
	    hourColour: "#8b6f86",
	    minuteColour: "#c75f6b"
	  },
	  forestClay: {
	    label: "Forest Clay",
	    bgColour: "#e8e0cf",
	    hourColour: "#6f7d5d",
	    minuteColour: "#b86d44"
	  }
	};
	
	const GROUP_ORDER = [
	  "Neutrals",
	  "Reds",
	  "Oranges & Yellows",
	  "Greens",
	  "Cyans",
	  "Blues",
	  "Purples",
	  "Pinks"
	];
	
	const palette = buildPebblePalette();
	const presetOptionsHtml = buildPresetOptionsHtml();
	
	Pebble.addEventListener("ready", function() {
	  // Push saved settings once JS is ready so the watchface restores persisted config.
	  setTimeout(function() {
	    sendConfigToWatch(loadConfig());
	  }, 400);
	});
	
	Pebble.addEventListener("showConfiguration", function() {
	  Pebble.openURL(buildConfigDataUrl(loadConfig()));
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
	
	function loadConfig() {
	  try {
	    const raw = localStorage.getItem(STORAGE_KEY);
	
	    if (!raw) {
	      return buildDefaultConfig();
	    }
	
	    return normaliseConfig(JSON.parse(raw));
	  } catch (error) {
	    return buildDefaultConfig();
	  }
	}
	
	function buildDefaultConfig() {
	  return {
	    bgColour: defaults.bgColour,
	    hourColour: defaults.hourColour,
	    minuteColour: defaults.minuteColour,
	    handColour: defaults.handColour,
	    faceMode: defaults.faceMode,
	    showDateTiles: defaults.showDateTiles
	  };
	}
	
	function saveConfig(config) {
	  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	}
	
	function normaliseConfig(raw) {
	  return {
	    bgColour: sanitiseHex(raw && raw.bgColour, defaults.bgColour),
	    hourColour: sanitiseHex(raw && raw.hourColour, defaults.hourColour),
	    minuteColour: sanitiseHex(raw && raw.minuteColour, defaults.minuteColour),
	    handColour: sanitiseHandColour(raw && raw.handColour, defaults.handColour),
	    faceMode: sanitiseMode(raw && raw.faceMode, defaults.faceMode),
	    showDateTiles: sanitiseBool(raw && raw.showDateTiles, defaults.showDateTiles)
	  };
	}
	
	function sendConfigToWatch(config) {
	  Pebble.sendAppMessage(
	    {
	      BG_COLOUR: config.bgColour,
	      HOUR_COLOUR: config.hourColour,
	      MINUTE_COLOUR: config.minuteColour,
	      HAND_COLOUR: config.handColour === "white" ? 1 : 0,
	      FACE_MODE: config.faceMode,
	      SHOW_DATE_TILES: config.showDateTiles ? 1 : 0
	    },
	    function() {
	      // Message sent.
	    },
	    function(error) {
	      console.log(`Config send failed: ${JSON.stringify(error)}`);
	    }
	  );
	}
	
	function buildConfigDataUrl(config) {
	  const initialConfig = JSON.stringify(config);
	  const presetJson = JSON.stringify(PRESETS);
	  const paletteJson = JSON.stringify(palette);
	
	  const html = `<!doctype html>
	<html>
	  <head>
	    <meta charset="utf-8" />
	    <meta name="viewport" content="width=device-width, initial-scale=1" />
	    <title>TrioWay</title>
	    <style>
	      body {
	        margin: 0;
	        padding: 16px;
	        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	        background: #f6f2e8;
	        color: #25201a;
	      }
	      h1 {
	        margin-top: 0;
	        font-size: 20px;
	      }
	      .row {
	        margin-bottom: 14px;
	      }
	      label {
	        display: block;
	        margin-bottom: 6px;
	      }
	      .colour-label {
	        display: flex;
	        align-items: center;
	        justify-content: space-between;
	        gap: 10px;
	      }
	      .swatch {
	        width: 24px;
	        height: 24px;
	        border-radius: 6px;
	        border: 1px solid #7f7568;
	        box-sizing: border-box;
	        flex: 0 0 24px;
	      }
	      select {
	        width: 100%;
	        height: 44px;
	        border: 1px solid #d8d0bd;
	        border-radius: 8px;
	        box-sizing: border-box;
	        background: #fff;
	      }
	      .help {
	        font-size: 12px;
	        line-height: 1.3;
	        color: #5a5044;
	      }
	      .preset-preview {
	        margin-top: 8px;
	        display: flex;
	        align-items: center;
	        gap: 8px;
	        font-size: 12px;
	        color: #5a5044;
	      }
	      .preset-preview .swatch {
	        width: 16px;
	        height: 16px;
	        border-radius: 4px;
	        flex: 0 0 16px;
	      }
	      .actions {
	        display: grid;
	        grid-template-columns: 1fr 1fr 1fr;
	        gap: 10px;
	      }
	      .status {
	        margin-top: 10px;
	        min-height: 16px;
	        font-size: 12px;
	        color: #5a5044;
	      }
	      button {
	        width: 100%;
	        height: 44px;
	        border: 0;
	        border-radius: 10px;
	        font-size: 16px;
	      }
	      #save {
	        background: #c45d32;
	        color: #fff;
	      }
	      #cancel {
	        background: #ded5c2;
	        color: #2e271f;
	      }
	      #apply {
	        background: #5f6e77;
	        color: #fff;
	      }
	    </style>
	  </head>
	  <body>
	    <h1>Watchface settings</h1>
	    <div class="row">
	      <label for="preset">Colour preset</label>
	      <select id="preset">
	        <option value="">Custom (keep current)</option>
	        ${presetOptionsHtml}
	      </select>
	      <div class="help">Choose a preset to auto-fill the three colours, or keep custom colours.</div>
	      <div class="preset-preview" id="presetPreview">
	        <span id="presetPreviewLabel">Custom</span>
	        <span class="swatch" id="presetBgSwatch"></span>
	        <span class="swatch" id="presetHourSwatch"></span>
	        <span class="swatch" id="presetMinuteSwatch"></span>
	      </div>
	    </div>
	
	    <div class="row">
	      <label for="faceMode">Face mode</label>
	      <select id="faceMode">
	        <option value="hands">Analogue</option>
	        <option value="digital">Digital Small</option>
	        <option value="largedigital">Digital Large</option>
	      </select>
	      <div class="help">Large Digital auto-hides day/date tiles.</div>
	    </div>
	
	    <div class="row">
	      <label for="handColour">Hand colour (Analogue)</label>
	      <select id="handColour">
	        <option value="black">Black</option>
	        <option value="white">White</option>
	      </select>
	    </div>
	
	    <div class="row">
	      <label><input id="showDateTiles" type="checkbox" /> Show day/date tiles</label>
	      <div class="help">Hide this if you want a cleaner face.</div>
	    </div>
	
	    <div class="row">
	      <label class="colour-label" for="bgColour">Base colour <span class="swatch" id="bgSwatch"></span></label>
	      <select id="bgColour"></select>
	    </div>
	
	    <div class="row">
	      <label class="colour-label" for="hourColour">Hour colour <span class="swatch" id="hourSwatch"></span></label>
	      <select id="hourColour"></select>
	    </div>
	
	    <div class="row">
	      <label class="colour-label" for="minuteColour">Minute colour <span class="swatch" id="minuteSwatch"></span></label>
	      <select id="minuteColour"></select>
	      <div class="help">Only Pebble Time palette colours are shown.</div>
	    </div>
	
	    <div class="actions">
	      <button id="cancel" type="button">Cancel</button>
	      <button id="apply" type="button">Apply</button>
	      <button id="save" type="button">Save</button>
	    </div>
	    <div class="status" id="status"></div>
	
	    <script>
	      var presets = ${presetJson};
	      var groupedPalette = ${paletteJson};
	      var groupOrder = ${JSON.stringify(GROUP_ORDER)};
	      var initial = ${initialConfig};
	
	      function getReturnToUrl() {
	        var value = null;
	        var query = window.location.search || "";
	        var match = query.match(/[?&]return_to=([^&]+)/);
	
	        if (match && match[1]) {
	          value = match[1];
	        }
	
	        if (!value) {
	          var hrefMatch = window.location.href.match(/[?&]return_to=([^&]+)/);
	          if (hrefMatch && hrefMatch[1]) {
	            value = hrefMatch[1];
	          }
	        }
	
	        return value ? decodeURIComponent(value) : null;
	      }
	
	      function buildReturnToCallback(baseUrl, encodedPayload) {
	        function endsWith(text, suffix) {
	          if (!text || !suffix) {
	            return false;
	          }
	
	          return text.slice(-suffix.length) === suffix;
	        }
	
	        var separator = baseUrl.indexOf("?") === -1
	          ? "?"
	          : (endsWith(baseUrl, "?") || endsWith(baseUrl, "&") ? "" : "&");
	
	        return baseUrl + separator + "response=" + encodedPayload;
	      }
	
	      function postReturnTo(encoded) {
	        var returnTo = getReturnToUrl();
	
	        if (!returnTo || returnTo.indexOf("http") !== 0) {
	          return false;
	        }
	
	        var callbackUrl = buildReturnToCallback(returnTo, encoded) + "&_ts=" + Date.now();
	        try {
	          var beacon = new Image();
	          beacon.src = callbackUrl;
	        } catch (error) {
	          // Keep trying with iframe below.
	        }
	
	        try {
	          var iframe = document.getElementById("applyTransportFrame");
	
	          if (!iframe) {
	            iframe = document.createElement("iframe");
	            iframe.id = "applyTransportFrame";
	            iframe.style.display = "none";
	            document.body.appendChild(iframe);
	          }
	
	          iframe.src = callbackUrl;
	        } catch (error) {
	          // Keep best-effort transport.
	        }
	
	        return true;
	      }
	
	      function sendConfig(response, closeAfter) {
	        var encoded = encodeURIComponent(JSON.stringify(response));
	        var status = document.getElementById("status");
	
	        if (!closeAfter) {
	          if (postReturnTo(encoded)) {
	            status.textContent = "Applied to emulator.";
	          } else {
	            status.textContent = "Live apply unavailable here. Use Save.";
	          }
	          return;
	        }
	
	        // Preferred path: Pebble app intercepts this scheme and closes reliably.
	        document.location = "pebblejs://close#" + encoded;
	
	        // Fallback path for emulator return_to callbacks.
	        setTimeout(function() {
	          postReturnTo(encoded);
	        }, 150);
	      }
	
	      function addGroupedOptions(selectId) {
	        var select = document.getElementById(selectId);
	
	        for (var i = 0; i < groupOrder.length; i += 1) {
	          var groupName = groupOrder[i];
	          var options = groupedPalette[groupName];
	          var optgroup = document.createElement("optgroup");
	          optgroup.label = groupName;
	
	          for (var j = 0; j < options.length; j += 1) {
	            var option = document.createElement("option");
	            option.value = options[j].colour;
	            option.textContent = options[j].colour.toUpperCase();
	            option.style.backgroundColor = options[j].colour;
	            option.style.color = getContrastText(options[j].colour);
	            option.style.fontWeight = "700";
	            optgroup.appendChild(option);
	          }
	
	          select.appendChild(optgroup);
	        }
	      }
	
	      function snapChannel(value) {
	        var steps = [0, 85, 170, 255];
	        var best = steps[0];
	        var bestDistance = Math.abs(value - best);
	
	        for (var i = 1; i < steps.length; i += 1) {
	          var distance = Math.abs(value - steps[i]);
	          if (distance < bestDistance) {
	            bestDistance = distance;
	            best = steps[i];
	          }
	        }
	
	        return best;
	      }
	
	      function toHex(value) {
	        var text = value.toString(16);
	        return text.length === 1 ? "0" + text : text;
	      }
	
	      function toPaletteColour(value, fallback) {
	        var text = String(value || "").trim().toLowerCase();
	        var match = text.match(/^#?[0-9a-f]{6}$/);
	        var source = match ? (text.charAt(0) === "#" ? text.slice(1) : text) : fallback.replace("#", "");
	        var r = parseInt(source.slice(0, 2), 16);
	        var g = parseInt(source.slice(2, 4), 16);
	        var b = parseInt(source.slice(4, 6), 16);
	
	        return "#" + toHex(snapChannel(r)) + toHex(snapChannel(g)) + toHex(snapChannel(b));
	      }
	
	      function setColourSelectValue(selectId, value, fallback) {
	        var select = document.getElementById(selectId);
	        var snapped = toPaletteColour(value, fallback);
	        select.value = snapped;
	
	        if (!select.value && select.options.length > 0) {
	          select.selectedIndex = 0;
	        }
	      }
	
	      function getColourSelectValue(selectId, fallback) {
	        var select = document.getElementById(selectId);
	        var value = select.value;
	        return toPaletteColour(value, fallback);
	      }
	
	      function syncSwatches() {
	        document.getElementById("bgSwatch").style.backgroundColor = document.getElementById("bgColour").value;
	        document.getElementById("hourSwatch").style.backgroundColor = document.getElementById("hourColour").value;
	        document.getElementById("minuteSwatch").style.backgroundColor = document.getElementById("minuteColour").value;
	        syncSelectPreview("bgColour");
	        syncSelectPreview("hourColour");
	        syncSelectPreview("minuteColour");
	      }
	
	      function applyPreset(name) {
	        if (!name || !presets[name]) {
	          return;
	        }
	
	        var preset = presets[name];
	        setColourSelectValue("bgColour", preset.bgColour, initial.bgColour);
	        setColourSelectValue("hourColour", preset.hourColour, initial.hourColour);
	        setColourSelectValue("minuteColour", preset.minuteColour, initial.minuteColour);
	      }
	
	      function findMatchingPresetKey(colours) {
	        for (var key in presets) {
	          if (!Object.prototype.hasOwnProperty.call(presets, key)) {
	            continue;
	          }
	
	          var preset = presets[key];
	          if (
	            toPaletteColour(preset.bgColour, colours.bgColour) === colours.bgColour &&
	            toPaletteColour(preset.hourColour, colours.hourColour) === colours.hourColour &&
	            toPaletteColour(preset.minuteColour, colours.minuteColour) === colours.minuteColour
	          ) {
	            return key;
	          }
	        }
	
	        return "";
	      }
	
	      function syncPresetPreview() {
	        var key = document.getElementById("preset").value;
	        var label = document.getElementById("presetPreviewLabel");
	        var bg = document.getElementById("presetBgSwatch");
	        var hour = document.getElementById("presetHourSwatch");
	        var minute = document.getElementById("presetMinuteSwatch");
	        var source = presets[key];
	
	        if (!source) {
	          label.textContent = "Custom";
	          source = {
	            bgColour: document.getElementById("bgColour").value,
	            hourColour: document.getElementById("hourColour").value,
	            minuteColour: document.getElementById("minuteColour").value
	          };
	        } else {
	          label.textContent = source.label;
	        }
	
	        bg.style.backgroundColor = toPaletteColour(source.bgColour, initial.bgColour);
	        hour.style.backgroundColor = toPaletteColour(source.hourColour, initial.hourColour);
	        minute.style.backgroundColor = toPaletteColour(source.minuteColour, initial.minuteColour);
	      }
	
	      function getContrastText(hex) {
	        var safe = String(hex || "").replace("#", "");
	
	        if (safe.length !== 6) {
	          return "#111";
	        }
	
	        var r = parseInt(safe.slice(0, 2), 16);
	        var g = parseInt(safe.slice(2, 4), 16);
	        var b = parseInt(safe.slice(4, 6), 16);
	        var luminance = (r * 299 + g * 587 + b * 114) / 1000;
	        return luminance >= 148 ? "#1f1a15" : "#ffffff";
	      }
	
	      function syncSelectPreview(selectId) {
	        var select = document.getElementById(selectId);
	        var colour = select.value || "#ffffff";
	        select.style.backgroundColor = colour;
	        select.style.color = getContrastText(colour);
	        select.style.fontWeight = "700";
	      }
	
	      function syncDateTileControl() {
	        var mode = document.getElementById("faceMode").value;
	        var dateToggle = document.getElementById("showDateTiles");
	        var largeDigital = mode === "largedigital";
	
	        if (largeDigital) {
	          dateToggle.checked = false;
	        }
	
	        dateToggle.disabled = largeDigital;
	      }
	
	      function syncHandColourControl() {
	        var mode = document.getElementById("faceMode").value;
	        var handColour = document.getElementById("handColour");
	        handColour.disabled = mode !== "hands";
	      }
	
	      addGroupedOptions("bgColour");
	      addGroupedOptions("hourColour");
	      addGroupedOptions("minuteColour");
	
	      document.getElementById("faceMode").value = initial.faceMode;
	      document.getElementById("handColour").value = initial.handColour;
	      document.getElementById("showDateTiles").checked = !!initial.showDateTiles;
	      setColourSelectValue("bgColour", initial.bgColour, initial.bgColour);
	      setColourSelectValue("hourColour", initial.hourColour, initial.hourColour);
	      setColourSelectValue("minuteColour", initial.minuteColour, initial.minuteColour);
	      document.getElementById("preset").value = findMatchingPresetKey({
	        bgColour: getColourSelectValue("bgColour", initial.bgColour),
	        hourColour: getColourSelectValue("hourColour", initial.hourColour),
	        minuteColour: getColourSelectValue("minuteColour", initial.minuteColour)
	      });
	
	      document.getElementById("preset").addEventListener("change", function(event) {
	        applyPreset(event.target.value);
	        syncSwatches();
	        syncPresetPreview();
	      });
	
	      document.getElementById("faceMode").addEventListener("change", function() {
	        syncDateTileControl();
	        syncHandColourControl();
	      });
	
	      document.getElementById("cancel").addEventListener("click", function() {
	        sendConfig(null, true);
	      });
	
	      document.getElementById("apply").addEventListener("click", function() {
	        sendConfig({
	          faceMode: document.getElementById("faceMode").value,
	          handColour: document.getElementById("handColour").value,
	          showDateTiles: document.getElementById("showDateTiles").checked,
	          bgColour: getColourSelectValue("bgColour", initial.bgColour),
	          hourColour: getColourSelectValue("hourColour", initial.hourColour),
	          minuteColour: getColourSelectValue("minuteColour", initial.minuteColour)
	        }, false);
	      });
	
	      document.getElementById("save").addEventListener("click", function() {
	        sendConfig({
	          faceMode: document.getElementById("faceMode").value,
	          handColour: document.getElementById("handColour").value,
	          showDateTiles: document.getElementById("showDateTiles").checked,
	          bgColour: getColourSelectValue("bgColour", initial.bgColour),
	          hourColour: getColourSelectValue("hourColour", initial.hourColour),
	          minuteColour: getColourSelectValue("minuteColour", initial.minuteColour)
	        }, true);
	      });
	
	      document.getElementById("bgColour").addEventListener("change", syncSwatches);
	      document.getElementById("hourColour").addEventListener("change", syncSwatches);
	      document.getElementById("minuteColour").addEventListener("change", syncSwatches);
	      document.getElementById("bgColour").addEventListener("change", function() {
	        document.getElementById("preset").value = "";
	        syncPresetPreview();
	      });
	      document.getElementById("hourColour").addEventListener("change", function() {
	        document.getElementById("preset").value = "";
	        syncPresetPreview();
	      });
	      document.getElementById("minuteColour").addEventListener("change", function() {
	        document.getElementById("preset").value = "";
	        syncPresetPreview();
	      });
	
	      syncDateTileControl();
	      syncHandColourControl();
	      syncSwatches();
	      syncPresetPreview();
	    </script>
	  </body>
	</html>`;
	
	  // Guard against clients that append raw return_to text into the data payload.
	  // Leaving an open HTML comment at the end swallows that suffix from rendering.
	  return `data:text/html;charset=utf-8,${encodeURIComponent(`${html}\n<!--`)}`;
	}
	
	function buildPebblePalette() {
	  const steps = ["00", "55", "aa", "ff"];
	  const grouped = {};
	
	  for (let i = 0; i < GROUP_ORDER.length; i += 1) {
	    grouped[GROUP_ORDER[i]] = [];
	  }
	
	  for (let r = 0; r < steps.length; r += 1) {
	    for (let g = 0; g < steps.length; g += 1) {
	      for (let b = 0; b < steps.length; b += 1) {
	        const colour = `#${steps[r]}${steps[g]}${steps[b]}`;
	        const channels = hexToRgb(colour);
	
	        grouped[classifyColourGroup(channels.r, channels.g, channels.b)].push({
	          colour,
	          weight: channels.r + channels.g + channels.b
	        });
	      }
	    }
	  }
	
	  for (let i = 0; i < GROUP_ORDER.length; i += 1) {
	    grouped[GROUP_ORDER[i]].sort(function(a, b) {
	      if (a.weight === b.weight) {
	        if (a.colour < b.colour) {
	          return -1;
	        }
	
	        if (a.colour > b.colour) {
	          return 1;
	        }
	
	        return 0;
	      }
	
	      return a.weight - b.weight;
	    });
	  }
	
	  return grouped;
	}
	
	function buildPresetOptionsHtml() {
	  return Object.keys(PRESETS).map(function(key) {
	    const preset = PRESETS[key];
	    return `<option value="${key}">${preset.label}</option>`;
	  }).join("");
	}
	
	function parseConfigPayload(rawResponse) {
	  const raw = String(rawResponse || "");
	  const candidates = [raw];
	
	  try {
	    candidates.push(decodeURIComponent(raw));
	  } catch (error) {
	    // Keep raw candidate only.
	  }
	
	  for (let i = 0; i < candidates.length; i += 1) {
	    const parsed = parseConfigCandidate(candidates[i]);
	
	    if (parsed) {
	      return parsed;
	    }
	  }
	
	  return null;
	}
	
	function parseConfigCandidate(candidate) {
	  if (!candidate || candidate === "null") {
	    return null;
	  }
	
	  const cleaned = candidate.charAt(0) === "#" ? candidate.slice(1) : candidate;
	
	  try {
	    return JSON.parse(cleaned);
	  } catch (error) {
	    // Continue to query-style fallback.
	  }
	
	  const wrapped = extractQueryValue(cleaned, "response");
	
	  if (!wrapped) {
	    return null;
	  }
	
	  try {
	    return JSON.parse(wrapped);
	  } catch (error) {
	    try {
	      return JSON.parse(decodeURIComponent(wrapped));
	    } catch (decodeError) {
	      return null;
	    }
	  }
	}
	
	function extractQueryValue(text, key) {
	  const marker = `${key}=`;
	  const index = text.lastIndexOf(marker);
	
	  if (index === -1) {
	    return null;
	  }
	
	  const start = index + marker.length;
	  const end = text.indexOf("&", start);
	
	  if (end === -1) {
	    return text.slice(start);
	  }
	
	  return text.slice(start, end);
	}
	
	function sanitiseHex(value, fallback) {
	  const text = typeof value === "string" ? value.trim() : "";
	  const match = text.match(/^#?[0-9a-fA-F]{6}$/);
	
	  if (!match) {
	    return snapToPebblePalette(fallback);
	  }
	
	  const raw = text.startsWith("#") ? text.toLowerCase() : `#${text.toLowerCase()}`;
	  return snapToPebblePalette(raw);
	}
	
	function sanitiseMode(value, fallback) {
	  const mode = String(value || "").trim().toLowerCase();
	
	  if (
	    mode === FACE_MODES.HANDS ||
	    mode === FACE_MODES.DIGITAL ||
	    mode === FACE_MODES.LARGE_DIGITAL
	  ) {
	    return mode;
	  }
	
	  return fallback;
	}
	
	function sanitiseHandColour(value, fallback) {
	  const colour = String(value || "").trim().toLowerCase();
	  if (colour === "black" || colour === "white") {
	    return colour;
	  }
	  return fallback;
	}
	
	function sanitiseBool(value, fallback) {
	  if (value === true || value === false) {
	    return value;
	  }
	
	  if (value === 1 || value === "1") {
	    return true;
	  }
	
	  if (value === 0 || value === "0") {
	    return false;
	  }
	
	  return fallback;
	}
	
	function snapToPebblePalette(hex) {
	  const safe = String(hex).replace("#", "");
	  const r = Number.parseInt(safe.slice(0, 2), 16);
	  const g = Number.parseInt(safe.slice(2, 4), 16);
	  const b = Number.parseInt(safe.slice(4, 6), 16);
	
	  return `#${toHex(snapChannel(r))}${toHex(snapChannel(g))}${toHex(snapChannel(b))}`;
	}
	
	function snapChannel(value) {
	  const steps = [0, 85, 170, 255];
	  let closest = steps[0];
	  let distance = Math.abs(value - closest);
	
	  for (let i = 1; i < steps.length; i += 1) {
	    const currentDistance = Math.abs(value - steps[i]);
	
	    if (currentDistance < distance) {
	      distance = currentDistance;
	      closest = steps[i];
	    }
	  }
	
	  return closest;
	}
	
	function toHex(value) {
	  const text = value.toString(16);
	  return text.length === 1 ? `0${text}` : text;
	}
	
	function hexToRgb(colour) {
	  const safe = String(colour).replace("#", "");
	
	  return {
	    r: parseInt(safe.slice(0, 2), 16),
	    g: parseInt(safe.slice(2, 4), 16),
	    b: parseInt(safe.slice(4, 6), 16)
	  };
	}
	
	function classifyColourGroup(r, g, b) {
	  if (r === g && g === b) {
	    return "Neutrals";
	  }
	
	  const max = Math.max(r, g, b);
	  const min = Math.min(r, g, b);
	  const delta = max - min;
	
	  if (delta === 0) {
	    return "Neutrals";
	  }
	
	  let hue;
	
	  if (max === r) {
	    hue = 60 * (((g - b) / delta) % 6);
	  } else if (max === g) {
	    hue = 60 * (((b - r) / delta) + 2);
	  } else {
	    hue = 60 * (((r - g) / delta) + 4);
	  }
	
	  if (hue < 0) {
	    hue += 360;
	  }
	
	  if (hue < 15 || hue >= 345) {
	    return "Reds";
	  }
	
	  if (hue < 70) {
	    return "Oranges & Yellows";
	  }
	
	  if (hue < 155) {
	    return "Greens";
	  }
	
	  if (hue < 200) {
	    return "Cyans";
	  }
	
	  if (hue < 255) {
	    return "Blues";
	  }
	
	  if (hue < 315) {
	    return "Purples";
	  }
	
	  return "Pinks";
	}


/***/ })
/******/ ]);
//# sourceMappingURL=pebble-js-app.js.map