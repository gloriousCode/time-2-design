const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "preset_matrix_emery_real");
const OUT_FILE = path.join(OUT_DIR, "index_compare.html");

const VARIANT_LABELS = {
  analogue: "Analogue",
  analogue_comp_3: "Analogue + 3 Comp",
  analogue_comp_6: "Analogue + 6 Comp",
  digital_small: "Digital Small",
  digital_small_comp_3: "Digital Small + 3 Comp",
  digital_small_comp_6: "Digital Small + 6 Comp",
  digital_large: "Digital Large",
  digital_large_comp_3: "Digital Large + 3 Comp"
};

function titleCaseFromCamel(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function parseFile(fileName) {
  const match = fileName.match(/^(.+?)__(analogue(?:_comp_[36])?|digital_small(?:_comp_[36])?|digital_large(?:_comp_3)?)\.png$/);
  if (!match) {
    return null;
  }

  const presetKey = match[1];
  const variantKey = match[2];
  return {
    fileName,
    presetKey,
    presetLabel: titleCaseFromCamel(presetKey),
    variantKey,
    variantLabel: VARIANT_LABELS[variantKey] || variantKey
  };
}

function main() {
  const files = fs.readdirSync(OUT_DIR).filter((name) => name.endsWith(".png"));
  const entries = files.map(parseFile).filter(Boolean);
  const presets = Array.from(new Set(entries.map((e) => e.presetKey))).sort();
  const variants = Array.from(new Set(entries.map((e) => e.variantKey))).sort();

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Preset Compare</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 16px; background: #f1f1f1; color: #222; }
      h1 { margin: 0 0 12px; }
      .toolbar { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 14px; }
      label { font-size: 12px; color: #555; display: block; margin-bottom: 4px; }
      select { width: 100%; height: 36px; border-radius: 8px; border: 1px solid #ccc; background: #fff; padding: 0 10px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
      figure { margin: 0; padding: 8px; background: #fff; border: 1px solid #ddd; border-radius: 10px; }
      img { display: block; width: 100%; border-radius: 8px; image-rendering: pixelated; background: #ddd; }
      figcaption { margin-top: 8px; line-height: 1.25; }
      .name { font-weight: 700; }
      .meta { color: #444; font-size: 14px; }
    </style>
  </head>
  <body>
    <h1>Preset Compare</h1>
    <div class="toolbar">
      <div>
        <label for="groupBy">Group By</label>
        <select id="groupBy">
          <option value="none">None</option>
          <option value="preset">Preset</option>
          <option value="type">Type</option>
        </select>
      </div>
      <div>
        <label for="sortBy">Sort By</label>
        <select id="sortBy">
          <option value="preset_type">Preset then Type</option>
          <option value="type_preset">Type then Preset</option>
          <option value="file">Filename</option>
        </select>
      </div>
      <div>
        <label for="presetFilter">Preset Filter</label>
        <select id="presetFilter">
          <option value="">All presets</option>
          ${presets.map((p) => `<option value="${p}">${titleCaseFromCamel(p)}</option>`).join("\n")}
        </select>
      </div>
      <div>
        <label for="typeFilter">Type Filter</label>
        <select id="typeFilter">
          <option value="">All types</option>
          ${variants.map((v) => `<option value="${v}">${VARIANT_LABELS[v] || v}</option>`).join("\n")}
        </select>
      </div>
    </div>
    <div id="grid" class="grid"></div>
    <script>
      const data = ${JSON.stringify(entries)};
      const grid = document.getElementById("grid");
      const groupByEl = document.getElementById("groupBy");
      const sortByEl = document.getElementById("sortBy");
      const presetFilterEl = document.getElementById("presetFilter");
      const typeFilterEl = document.getElementById("typeFilter");

      function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

      function sorted(list, sortBy) {
        return list.slice().sort((a, b) => {
          if (sortBy === "file") {
            return cmp(a.fileName, b.fileName);
          }
          if (sortBy === "type_preset") {
            return cmp(a.variantKey, b.variantKey) || cmp(a.presetKey, b.presetKey);
          }
          return cmp(a.presetKey, b.presetKey) || cmp(a.variantKey, b.variantKey);
        });
      }

      function groupKey(item, mode) {
        if (mode === "preset") return item.presetLabel;
        if (mode === "type") return item.variantLabel;
        return "";
      }

      function render() {
        const groupBy = groupByEl.value;
        const sortBy = sortByEl.value;
        const presetFilter = presetFilterEl.value;
        const typeFilter = typeFilterEl.value;

        const filtered = data.filter((item) => {
          if (presetFilter && item.presetKey !== presetFilter) return false;
          if (typeFilter && item.variantKey !== typeFilter) return false;
          return true;
        });

        const list = sorted(filtered, sortBy);
        grid.innerHTML = "";

        let lastGroup = null;
        for (const item of list) {
          const g = groupKey(item, groupBy);
          if (g && g !== lastGroup) {
            const header = document.createElement("div");
            header.style.gridColumn = "1 / -1";
            header.style.fontWeight = "700";
            header.style.marginTop = "8px";
            header.textContent = g;
            grid.appendChild(header);
            lastGroup = g;
          }

          const figure = document.createElement("figure");
          figure.innerHTML = \`
            <img src="./\${item.fileName}" alt="\${item.presetLabel} \${item.variantLabel}" />
            <figcaption>
              <div class="name">\${item.presetLabel}</div>
              <div class="meta">\${item.variantLabel}</div>
            </figcaption>
          \`;
          grid.appendChild(figure);
        }
      }

      groupByEl.addEventListener("change", render);
      sortByEl.addEventListener("change", render);
      presetFilterEl.addEventListener("change", render);
      typeFilterEl.addEventListener("change", render);
      render();
    </script>
  </body>
</html>`;

  fs.writeFileSync(OUT_FILE, html, "utf8");
  process.stdout.write(`Wrote ${OUT_FILE}\n`);
}

main();
