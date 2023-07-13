import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createMinifier } from "../src/minifier";
import ts from "typescript";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const cwd = path.join(__dirname, "..");

console.log("[project]", cwd);

const tsconfigPath = path.join(cwd, "./tsconfig.json");
const tsconfig = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(tsconfig.config, ts.sys, cwd);

const srcRoot = path.join(cwd, "./src");
const targets = parsed.fileNames.filter(
  (fname) => fname.startsWith(srcRoot) && !fname.endsWith(".d.ts") && !fname.endsWith(".test.ts"),
);

const rootFileNames = [
  path.join(process.cwd(), "./src/transformer/types.ts"),
  // path.join(process.cwd(), "./src/typescript/types.ts"),
  // path.join(cwd, "./src/types.ts"),
  path.join(cwd, "./src/index.ts"),
];

const minifier = createMinifier(cwd, rootFileNames, targets, parsed.options);

minifier.process();

for (const fileName of targets) {
  const content = minifier.readFile(fileName);
  if (content) {
    const original = fs.readFileSync(fileName, "utf-8");
    console.log("[selfhost:gen]", fileName.replace(srcRoot + "/", "__src/"), content.length, original.length);

    const tmpFile = fileName.replace("/src/", "/__src/");
    const outDirName = path.dirname(tmpFile);
    if (!fs.existsSync(outDirName)) {
      fs.mkdirSync(outDirName, { recursive: true });
    }

    fs.writeFileSync(tmpFile, content);
    // minifier.notifyChange(fileName, content);
  }
}
