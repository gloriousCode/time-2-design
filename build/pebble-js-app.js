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
/***/ (function(module, exports, __webpack_require__) {

	const { buildPebblePalette } = __webpack_require__(3);
	const { buildConfigDataUrl } = __webpack_require__(5);
	const {
	  loadConfig,
	  saveConfig,
	  normaliseConfig,
	  parseConfigPayload,
	  sendConfigToWatch
	} = __webpack_require__(7);
	
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


/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

	const { GROUP_ORDER } = __webpack_require__(4);
	
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
	
	module.exports = {
	  buildPebblePalette,
	  snapToPebblePalette
	};


/***/ }),
/* 4 */
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
	  hourHandColour: "#000000",
	  minuteHandColour: "#000000",
	  complicationBgColour: "#ffffaa",
	  complicationBorderColour: "#ff5500",
	  complicationTextColour: "#5555aa",
	  showHands: true,
	  showDateComplication: false,
	  faceMode: FACE_MODES.HANDS,
	  showDateTiles: false
	};
	
	const PRESETS_BASE = {
	  sunsetPetal: {
	    label: "Sunset Petal",
	    bgColour: "#ffaa55",
	    hourColour: "#ff5555",
	    minuteColour: "#aa55aa"
	  },
	  canyonShell: {
	    label: "Canyon Shell",
	    bgColour: "#ff5555",
	    hourColour: "#aa5500",
	    minuteColour: "#ffaaaa"
	  },
	  coastalDust: {
	    label: "Coastal Dust",
	    bgColour: "#00aaaa",
	    hourColour: "#aaaaff",
	    minuteColour: "#aa55aa"
	  },
	  blushPop: {
	    label: "Blush Pop",
	    bgColour: "#ffaaaa",
	    hourColour: "#ff55aa",
	    minuteColour: "#ff0055"
	  },
	  coralCandy: {
	    label: "Coral Candy",
	    bgColour: "#ff55aa",
	    hourColour: "#ff5555",
	    minuteColour: "#ffaaaa"
	  },
	  mangoCream: {
	    label: "Mango Cream",
	    bgColour: "#ffaaaa",
	    hourColour: "#ffaa00",
	    minuteColour: "#ffffaa"
	  },
	  tealSage: {
	    label: "Teal Sage",
	    bgColour: "#00aaaa",
	    hourColour: "#0055aa",
	    minuteColour: "#aaffaa"
	  },
	  glacierNavy: {
	    label: "Glacier Navy",
	    bgColour: "#aaffff",
	    hourColour: "#55aaff",
	    minuteColour: "#0055aa"
	  },
	  indigoOrchid: {
	    label: "Indigo Orchid",
	    bgColour: "#5555aa",
	    hourColour: "#55aaff",
	    minuteColour: "#aa55aa"
	  },
	  violetFloss: {
	    label: "Violet Floss",
	    bgColour: "#aa55ff",
	    hourColour: "#ff55aa",
	    minuteColour: "#ff00aa"
	  },
	  stonePeach: {
	    label: "Stone Peach",
	    bgColour: "#aaaaaa",
	    hourColour: "#555555",
	    minuteColour: "#ffaaaa"
	  },
	  mistCoralSlate: {
	    label: "Mist Coral Slate",
	    bgColour: "#aaffff",
	    hourColour: "#ffaaaa",
	    minuteColour: "#5555aa"
	  },
	  aquaLemonMint: {
	    label: "Aqua Lemon Mint",
	    bgColour: "#00aaaa",
	    hourColour: "#ffff55",
	    minuteColour: "#aaffaa"
	  },
	  mintAmberSand: {
	    label: "Mint Amber Sand",
	    bgColour: "#55ffaa",
	    hourColour: "#ffaa00",
	    minuteColour: "#ffffaa"
	  },
	  roseApricotShell: {
	    label: "Rose Apricot Shell",
	    bgColour: "#ff55aa",
	    hourColour: "#ff5555",
	    minuteColour: "#ffaaaa"
	  },
	  coralOliveShell: {
	    label: "Coral Olive Shell",
	    bgColour: "#ff5555",
	    hourColour: "#aaaa55",
	    minuteColour: "#ffaaaa"
	  }
	};
	
	const EXTENSION_COLOUR_POOL = [
	  "#000000",
	  "#ffffff",
	  "#0055aa",
	  "#00aaaa",
	  "#55aaff",
	  "#55ffaa",
	  "#55ff55",
	  "#aaff55",
	  "#ffff55",
	  "#ffaa00",
	  "#ff5555",
	  "#ff55aa",
	  "#aa55aa",
	  "#5555aa",
	  "#aaaaaa",
	  "#555555",
	  "#aa5500",
	  "#00aa55",
	  "#aa0000",
	  "#005555"
	];
	
	function hashString(text) {
	  let hash = 0;
	
	  for (let i = 0; i < text.length; i += 1) {
	    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
	  }
	
	  return hash;
	}
	
	function parseHexChannel(hex, start) {
	  return parseInt(hex.slice(start, start + 2), 16);
	}
	
	function hexToRgb(hex) {
	  return [
	    parseHexChannel(hex, 1),
	    parseHexChannel(hex, 3),
	    parseHexChannel(hex, 5)
	  ];
	}
	
	function toLinearChannel(channel) {
	  const srgb = channel / 255;
	  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
	}
	
	function relativeLuminance(hex) {
	  const [r, g, b] = hexToRgb(hex);
	  const rl = toLinearChannel(r);
	  const gl = toLinearChannel(g);
	  const bl = toLinearChannel(b);
	  return (0.2126 * rl) + (0.7152 * gl) + (0.0722 * bl);
	}
	
	function contrastRatio(a, b) {
	  const aLum = relativeLuminance(a);
	  const bLum = relativeLuminance(b);
	  const light = Math.max(aLum, bLum);
	  const dark = Math.min(aLum, bLum);
	  return (light + 0.05) / (dark + 0.05);
	}
	
	function minContrastAgainst(colour, others) {
	  let min = Number.POSITIVE_INFINITY;
	
	  for (let i = 0; i < others.length; i += 1) {
	    min = Math.min(min, contrastRatio(colour, others[i]));
	  }
	
	  return min;
	}
	
	function pickDistinctColour(used, offset) {
	  for (let i = 0; i < EXTENSION_COLOUR_POOL.length; i += 1) {
	    const colour = EXTENSION_COLOUR_POOL[(offset + i) % EXTENSION_COLOUR_POOL.length];
	
	    if (!used.has(colour)) {
	      used.add(colour);
	      return colour;
	    }
	  }
	
	  return "#000000";
	}
	
	function pickDistinctColourByScore(used, scoreFn, fallback) {
	  let bestColour = null;
	  let bestScore = Number.NEGATIVE_INFINITY;
	
	  for (let i = 0; i < EXTENSION_COLOUR_POOL.length; i += 1) {
	    const colour = EXTENSION_COLOUR_POOL[i];
	
	    if (used.has(colour)) {
	      continue;
	    }
	
	    const score = scoreFn(colour);
	
	    if (score > bestScore) {
	      bestScore = score;
	      bestColour = colour;
	    }
	  }
	
	  if (!bestColour) {
	    return fallback;
	  }
	
	  used.add(bestColour);
	  return bestColour;
	}
	
	function extendPreset(key, preset) {
	  const used = new Set([preset.bgColour, preset.hourColour, preset.minuteColour]);
	  const seed = hashString(key);
	  const baseColours = [preset.bgColour, preset.hourColour, preset.minuteColour];
	
	  const hourHandColour = pickDistinctColour(used, seed % EXTENSION_COLOUR_POOL.length);
	  const minuteHandColour = pickDistinctColour(used, (seed + 3) % EXTENSION_COLOUR_POOL.length);
	  const complicationBgColour = pickDistinctColourByScore(
	    used,
	    function(colour) {
	      return minContrastAgainst(colour, baseColours);
	    },
	    "#000000"
	  );
	  const complicationTextColour = pickDistinctColourByScore(
	    used,
	    function(colour) {
	      return contrastRatio(colour, complicationBgColour);
	    },
	    "#ffffff"
	  );
	  const complicationBorderColour = pickDistinctColourByScore(
	    used,
	    function(colour) {
	      const againstBackground = contrastRatio(colour, complicationBgColour);
	      const againstFace = minContrastAgainst(colour, baseColours);
	      return Math.min(againstBackground, againstFace);
	    },
	    "#ffffff"
	  );
	
	  return {
	    label: preset.label,
	    bgColour: preset.bgColour,
	    hourColour: preset.hourColour,
	    minuteColour: preset.minuteColour,
	    hourHandColour,
	    minuteHandColour,
	    complicationBgColour,
	    complicationBorderColour,
	    complicationTextColour
	  };
	}
	
	const PRESETS = Object.keys(PRESETS_BASE).reduce(function(acc, key) {
	  acc[key] = extendPreset(key, PRESETS_BASE[key]);
	  return acc;
	}, {});
	
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
	
	module.exports = {
	  STORAGE_KEY,
	  FACE_MODES,
	  defaults,
	  PRESETS,
	  GROUP_ORDER
	};


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

	const { PRESETS, GROUP_ORDER } = __webpack_require__(4);
	const { buildConfigPageScript } = __webpack_require__(6);
	
	function buildPresetOptionsHtml() {
	  return Object.keys(PRESETS).map(function(key) {
	    const preset = PRESETS[key];
	    return `<option value="${key}">${preset.label}</option>`;
	  }).join("");
	}
	
	function buildConfigDataUrl(config, palette) {
	  const presetOptionsHtml = buildPresetOptionsHtml();
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
	      <label><input id="showHands" type="checkbox" /> Show analogue hands</label>
	      <div class="help">Disable this to keep analogue mode without hands.</div>
	    </div>
	
	    <div class="row">
	      <label><input id="showDateTiles" type="checkbox" /> Show day/date tiles</label>
	      <div class="help">Hide this if you want a cleaner face.</div>
	    </div>
	
	    <div class="row">
	      <label><input id="showDateComplication" type="checkbox" /> Show date complication (3 o'clock)</label>
	      <div class="help">Available in Analogue and Digital Small modes.</div>
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
	
	    <div class="row">
	      <label class="colour-label" for="hourHandColour">Hour hand colour <span class="swatch" id="hourHandSwatch"></span></label>
	      <select id="hourHandColour"></select>
	    </div>
	
	    <div class="row">
	      <label class="colour-label" for="minuteHandColour">Minute hand colour <span class="swatch" id="minuteHandSwatch"></span></label>
	      <select id="minuteHandColour"></select>
	    </div>
	
	    <div class="row">
	      <label class="colour-label" for="complicationBgColour">Complication background <span class="swatch" id="complicationBgSwatch"></span></label>
	      <select id="complicationBgColour"></select>
	    </div>
	
	    <div class="row">
	      <label class="colour-label" for="complicationBorderColour">Complication border <span class="swatch" id="complicationBorderSwatch"></span></label>
	      <select id="complicationBorderColour"></select>
	    </div>
	
	    <div class="row">
	      <label class="colour-label" for="complicationTextColour">Complication text <span class="swatch" id="complicationTextSwatch"></span></label>
	      <select id="complicationTextColour"></select>
	    </div>
	
	    <div class="actions">
	      <button id="cancel" type="button">Cancel</button>
	      <button id="apply" type="button">Apply</button>
	      <button id="save" type="button">Save</button>
	    </div>
	    <div class="status" id="status"></div>
	
	    ${buildConfigPageScript(presetJson, paletteJson, JSON.stringify(GROUP_ORDER), initialConfig)}
	  </body>
	</html>`;
	
	  // Guard against clients that append raw return_to text into the data payload.
	  // Leaving an open HTML comment at the end swallows that suffix from rendering.
	  return `data:text/html;charset=utf-8,${encodeURIComponent(`${html}\n<!--`)}`;
	}
	
	module.exports = {
	  buildConfigDataUrl
	};


/***/ }),
/* 6 */
/***/ (function(module, exports) {

	function buildConfigPageScript(presetJson, paletteJson, groupOrderJson, initialConfig) {
	  return `<script>
	      var presets = ${presetJson};
	      var groupedPalette = ${paletteJson};
	      var groupOrder = ${groupOrderJson};
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
	        document.getElementById("hourHandSwatch").style.backgroundColor = document.getElementById("hourHandColour").value;
	        document.getElementById("minuteHandSwatch").style.backgroundColor = document.getElementById("minuteHandColour").value;
	        document.getElementById("complicationBgSwatch").style.backgroundColor = document.getElementById("complicationBgColour").value;
	        document.getElementById("complicationBorderSwatch").style.backgroundColor = document.getElementById("complicationBorderColour").value;
	        document.getElementById("complicationTextSwatch").style.backgroundColor = document.getElementById("complicationTextColour").value;
	        syncSelectPreview("bgColour");
	        syncSelectPreview("hourColour");
	        syncSelectPreview("minuteColour");
	        syncSelectPreview("hourHandColour");
	        syncSelectPreview("minuteHandColour");
	        syncSelectPreview("complicationBgColour");
	        syncSelectPreview("complicationBorderColour");
	        syncSelectPreview("complicationTextColour");
	      }
	
	      function applyPreset(name) {
	        if (!name || !presets[name]) {
	          return;
	        }
	
	        var preset = presets[name];
	        setColourSelectValue("bgColour", preset.bgColour, initial.bgColour);
	        setColourSelectValue("hourColour", preset.hourColour, initial.hourColour);
	        setColourSelectValue("minuteColour", preset.minuteColour, initial.minuteColour);
	        setColourSelectValue("hourHandColour", preset.hourHandColour || preset.hourColour, "#000000");
	        setColourSelectValue("minuteHandColour", preset.minuteHandColour || preset.minuteColour, "#000000");
	        setColourSelectValue("complicationBgColour", preset.complicationBgColour || preset.bgColour, initial.complicationBgColour);
	        setColourSelectValue("complicationBorderColour", preset.complicationBorderColour || preset.minuteColour, initial.complicationBorderColour);
	        setColourSelectValue("complicationTextColour", preset.complicationTextColour || preset.hourColour, initial.complicationTextColour);
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
	
	      function syncDateComplicationControl() {
	        var mode = document.getElementById("faceMode").value;
	        var toggle = document.getElementById("showDateComplication");
	        var bg = document.getElementById("complicationBgColour");
	        var border = document.getElementById("complicationBorderColour");
	        var text = document.getElementById("complicationTextColour");
	        var supported = mode === "hands" || mode === "digital";
	
	        if (!supported) {
	          toggle.checked = false;
	        }
	
	        toggle.disabled = !supported;
	        bg.disabled = !supported || !toggle.checked;
	        border.disabled = !supported || !toggle.checked;
	        text.disabled = !supported || !toggle.checked;
	      }
	
	      function syncHandControls() {
	        var mode = document.getElementById("faceMode").value;
	        var showHands = document.getElementById("showHands");
	        var hourHandColour = document.getElementById("hourHandColour");
	        var minuteHandColour = document.getElementById("minuteHandColour");
	        var isAnalogue = mode === "hands";
	        var isDigital = mode === "digital" || mode === "largedigital";
	
	        showHands.disabled = !isAnalogue;
	        hourHandColour.disabled = !isAnalogue || !showHands.checked || isDigital;
	        minuteHandColour.disabled = !isAnalogue || !showHands.checked || isDigital;
	      }
	
	      addGroupedOptions("bgColour");
	      addGroupedOptions("hourColour");
	      addGroupedOptions("minuteColour");
	      addGroupedOptions("hourHandColour");
	      addGroupedOptions("minuteHandColour");
	      addGroupedOptions("complicationBgColour");
	      addGroupedOptions("complicationBorderColour");
	      addGroupedOptions("complicationTextColour");
	
	      document.getElementById("faceMode").value = initial.faceMode;
	      document.getElementById("showHands").checked = initial.showHands !== false;
	      document.getElementById("showDateTiles").checked = !!initial.showDateTiles;
	      document.getElementById("showDateComplication").checked = !!initial.showDateComplication;
	      setColourSelectValue("bgColour", initial.bgColour, initial.bgColour);
	      setColourSelectValue("hourColour", initial.hourColour, initial.hourColour);
	      setColourSelectValue("minuteColour", initial.minuteColour, initial.minuteColour);
	      setColourSelectValue("hourHandColour", initial.hourHandColour, "#000000");
	      setColourSelectValue("minuteHandColour", initial.minuteHandColour, "#000000");
	      setColourSelectValue("complicationBgColour", initial.complicationBgColour, initial.bgColour);
	      setColourSelectValue("complicationBorderColour", initial.complicationBorderColour, initial.minuteColour);
	      setColourSelectValue("complicationTextColour", initial.complicationTextColour, initial.hourColour);
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
	        syncDateComplicationControl();
	        syncHandControls();
	      });
	
	      document.getElementById("showHands").addEventListener("change", function() {
	        syncHandControls();
	      });
	      document.getElementById("showDateComplication").addEventListener("change", function() {
	        syncDateComplicationControl();
	      });
	
	      document.getElementById("cancel").addEventListener("click", function() {
	        sendConfig(null, true);
	      });
	
	      document.getElementById("apply").addEventListener("click", function() {
	        sendConfig({
	          faceMode: document.getElementById("faceMode").value,
	          showHands: document.getElementById("showHands").checked,
	          showDateTiles: document.getElementById("showDateTiles").checked,
	          showDateComplication: document.getElementById("showDateComplication").checked,
	          bgColour: getColourSelectValue("bgColour", initial.bgColour),
	          hourColour: getColourSelectValue("hourColour", initial.hourColour),
	          minuteColour: getColourSelectValue("minuteColour", initial.minuteColour),
	          hourHandColour: getColourSelectValue("hourHandColour", "#000000"),
	          minuteHandColour: getColourSelectValue("minuteHandColour", "#000000"),
	          complicationBgColour: getColourSelectValue("complicationBgColour", initial.bgColour),
	          complicationBorderColour: getColourSelectValue("complicationBorderColour", initial.minuteColour),
	          complicationTextColour: getColourSelectValue("complicationTextColour", initial.hourColour)
	        }, false);
	      });
	
	      document.getElementById("save").addEventListener("click", function() {
	        sendConfig({
	          faceMode: document.getElementById("faceMode").value,
	          showHands: document.getElementById("showHands").checked,
	          showDateTiles: document.getElementById("showDateTiles").checked,
	          showDateComplication: document.getElementById("showDateComplication").checked,
	          bgColour: getColourSelectValue("bgColour", initial.bgColour),
	          hourColour: getColourSelectValue("hourColour", initial.hourColour),
	          minuteColour: getColourSelectValue("minuteColour", initial.minuteColour),
	          hourHandColour: getColourSelectValue("hourHandColour", "#000000"),
	          minuteHandColour: getColourSelectValue("minuteHandColour", "#000000"),
	          complicationBgColour: getColourSelectValue("complicationBgColour", initial.bgColour),
	          complicationBorderColour: getColourSelectValue("complicationBorderColour", initial.minuteColour),
	          complicationTextColour: getColourSelectValue("complicationTextColour", initial.hourColour)
	        }, true);
	      });
	
	      document.getElementById("bgColour").addEventListener("change", syncSwatches);
	      document.getElementById("hourColour").addEventListener("change", syncSwatches);
	      document.getElementById("minuteColour").addEventListener("change", syncSwatches);
	      document.getElementById("hourHandColour").addEventListener("change", syncSwatches);
	      document.getElementById("minuteHandColour").addEventListener("change", syncSwatches);
	      document.getElementById("complicationBgColour").addEventListener("change", syncSwatches);
	      document.getElementById("complicationBorderColour").addEventListener("change", syncSwatches);
	      document.getElementById("complicationTextColour").addEventListener("change", syncSwatches);
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
	      document.getElementById("complicationBgColour").addEventListener("change", function() {
	        document.getElementById("preset").value = "";
	        syncPresetPreview();
	      });
	      document.getElementById("complicationBorderColour").addEventListener("change", function() {
	        document.getElementById("preset").value = "";
	        syncPresetPreview();
	      });
	      document.getElementById("complicationTextColour").addEventListener("change", function() {
	        document.getElementById("preset").value = "";
	        syncPresetPreview();
	      });
	
	      syncDateTileControl();
	      syncDateComplicationControl();
	      syncHandControls();
	      syncSwatches();
	      syncPresetPreview();
	    </script>`;
	}
	
	module.exports = {
	  buildConfigPageScript
	};


/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

	const { STORAGE_KEY, FACE_MODES, defaults } = __webpack_require__(4);
	const { snapToPebblePalette } = __webpack_require__(3);
	
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
	    hourHandColour: defaults.hourHandColour,
	    minuteHandColour: defaults.minuteHandColour,
	    complicationBgColour: defaults.complicationBgColour,
	    complicationBorderColour: defaults.complicationBorderColour,
	    complicationTextColour: defaults.complicationTextColour,
	    showHands: defaults.showHands,
	    showDateComplication: defaults.showDateComplication,
	    faceMode: defaults.faceMode,
	    showDateTiles: defaults.showDateTiles
	  };
	}
	
	function saveConfig(config) {
	  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	}
	
	function normaliseConfig(raw) {
	  const legacyHandColour = sanitiseHandColour(raw && raw.handColour, "black");
	  const legacyHandHex = legacyHandColour === "white" ? "#ffffff" : "#000000";
	
	  return {
	    bgColour: sanitiseHex(raw && raw.bgColour, defaults.bgColour),
	    hourColour: sanitiseHex(raw && raw.hourColour, defaults.hourColour),
	    minuteColour: sanitiseHex(raw && raw.minuteColour, defaults.minuteColour),
	    hourHandColour: sanitiseHex(raw && raw.hourHandColour, legacyHandHex),
	    minuteHandColour: sanitiseHex(raw && raw.minuteHandColour, legacyHandHex),
	    complicationBgColour: sanitiseHex(raw && raw.complicationBgColour, defaults.complicationBgColour),
	    complicationBorderColour: sanitiseHex(raw && raw.complicationBorderColour, defaults.complicationBorderColour),
	    complicationTextColour: sanitiseHex(raw && raw.complicationTextColour, defaults.complicationTextColour),
	    showHands: sanitiseBool(raw && raw.showHands, defaults.showHands),
	    showDateComplication: sanitiseBool(raw && raw.showDateComplication, defaults.showDateComplication),
	    faceMode: sanitiseMode(raw && raw.faceMode, defaults.faceMode),
	    showDateTiles: sanitiseBool(raw && raw.showDateTiles, defaults.showDateTiles)
	  };
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
	
	let activeSendToken = 0;
	const MAX_SEND_ATTEMPTS = 12;
	const BASE_RETRY_DELAY_MS = 250;
	
	function buildConfigPayload(config) {
	  return {
	    BG_COLOUR: config.bgColour,
	    HOUR_COLOUR: config.hourColour,
	    MINUTE_COLOUR: config.minuteColour,
	    H_HAND_COLOUR: config.hourHandColour,
	    M_HAND_COLOUR: config.minuteHandColour,
	    C_BG_COLOUR: config.complicationBgColour,
	    C_BORDER_COLOUR: config.complicationBorderColour,
	    C_TEXT_COLOUR: config.complicationTextColour,
	    SHOW_HANDS: config.showHands ? 1 : 0,
	    SHOW_DATE_COMPLICATION: config.showDateComplication ? 1 : 0,
	    FACE_MODE: config.faceMode,
	    SHOW_DATE_TILES: config.showDateTiles ? 1 : 0
	  };
	}
	
	function retryDelayForAttempt(attempt) {
	  return BASE_RETRY_DELAY_MS * (attempt + 1);
	}
	
	function sendPayloadWithRetry(payload, sendToken, attempt) {
	  Pebble.sendAppMessage(
	    payload,
	    function() {
	      if (sendToken === activeSendToken) {
	        console.log(`Config sent on attempt ${attempt + 1}`);
	      }
	    },
	    function(error) {
	      if (sendToken !== activeSendToken) {
	        return;
	      }
	
	      if (attempt + 1 >= MAX_SEND_ATTEMPTS) {
	        console.log(`Config send failed after ${MAX_SEND_ATTEMPTS} attempts: ${JSON.stringify(error)}`);
	        return;
	      }
	
	      const delayMs = retryDelayForAttempt(attempt);
	      console.log(`Config send retry ${attempt + 2}/${MAX_SEND_ATTEMPTS} in ${delayMs}ms`);
	      setTimeout(function() {
	        sendPayloadWithRetry(payload, sendToken, attempt + 1);
	      }, delayMs);
	    }
	  );
	}
	
	function sendConfigToWatch(config) {
	  activeSendToken += 1;
	  sendPayloadWithRetry(buildConfigPayload(config), activeSendToken, 0);
	}
	
	module.exports = {
	  loadConfig,
	  saveConfig,
	  normaliseConfig,
	  parseConfigPayload,
	  sendConfigToWatch
	};


/***/ })
/******/ ]);
//# sourceMappingURL=pebble-js-app.js.map