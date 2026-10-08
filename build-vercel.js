"use strict";

const fs = require("fs");
const path = require("path");

const root = __dirname;
const dist = path.join(root, "dist");
const files = ["index.html", "styles.css", "arctic-theme.css", "geometry-model.js", "app.js", "landing.js", "flight3d.js"];
const assetSource = path.join(root, "assets");
const assetDestination = path.join(dist, "assets");

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

if (fs.existsSync(assetSource)) {
  fs.cpSync(assetSource, assetDestination, { recursive: true });
}

console.log(`Built Pristine Skies static site into ${dist}`);
