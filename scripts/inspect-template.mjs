import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = process.argv[2];
const previewDir = process.argv[3] ?? ".tmp/template-preview";

if (!inputPath) {
  throw new Error("Usage: node scripts/inspect-template.mjs <input.xlsx> [preview-dir]");
}

await fs.mkdir(previewDir, { recursive: true });
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));

const summary = await workbook.inspect({
  kind: "workbook,sheet,table,definedName,drawing",
  maxChars: 16000,
  tableMaxRows: 12,
  tableMaxCols: 40,
  tableMaxCellChars: 120,
});
console.log("WORKBOOK_SUMMARY");
console.log(summary.ndjson);

const sheets = workbook.worksheets.items;
for (const sheet of sheets) {
  const used = sheet.getUsedRange();
  console.log(`SHEET ${sheet.name}`);
  if (used) {
    const region = await workbook.inspect({
      kind: "region",
      sheetId: sheet.name,
      range: used.address,
      maxChars: 20000,
      tableMaxRows: 50,
      tableMaxCols: 50,
      tableMaxCellChars: 160,
    });
    console.log(region.ndjson);
    const styles = await workbook.inspect({
      kind: "computedStyle",
      sheetId: sheet.name,
      range: used.address,
      maxChars: 8000,
    });
    console.log(styles.ndjson);
  }

  const preview = await workbook.render({
    sheetName: sheet.name,
    autoCrop: "all",
    scale: 1.4,
    format: "png",
  });
  const safeName = sheet.name.replaceAll(/[\\/:*?"<>|]/g, "_");
  const outputPath = path.join(previewDir, `${safeName}.png`);
  await fs.writeFile(outputPath, new Uint8Array(await preview.arrayBuffer()));
  console.log(`PREVIEW ${outputPath}`);
}
