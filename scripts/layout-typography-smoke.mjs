import assert from "node:assert/strict";
import fs from "node:fs/promises";

const root=new URL("../",import.meta.url);
const [html,css]=await Promise.all([
  fs.readFile(new URL("index.html",root),"utf8"),
  fs.readFile(new URL("styles.css",root),"utf8"),
]);

assert.match(html,/class="verify-toolbar"/);
assert.match(css,/\.verify-toolbar>label\{[^}]*min-width:max-content[^}]*white-space:nowrap/);
assert.match(css,/button,\.button,\.text-button[^\n]*word-break:keep-all[^\n]*white-space:nowrap/);
assert.match(css,/\.verify-compact-table th,\.transport-table th,\.rooming-table th,\.quota-table th\{[^}]*white-space:nowrap/);
assert.match(css,/@media\(max-width:700px\)\{\.verify-toolbar>label:nth-child\(1\),\.verify-toolbar>label:nth-child\(2\)/);

console.log("layout typography smoke: ok");
