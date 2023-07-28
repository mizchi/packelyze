import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { createMinifier, withTerserMangleValidator } from "../src/minifier";
import { OnWarning, Warning } from "../src/types";
// import { BatchRenameLocationWithSource, CodeAction } from "../src/transform/transformTypes";
import { createIncrementalLanguageService, createIncrementalLanguageServiceHost } from "../src/ts/services";

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
  path.join(cwd, "./src/index.ts"),
  //xx
  // path.join(cwd, "./src/types.ts")
];

const warnings: Warning[] = [];
const onwarn: OnWarning = (waring) => {
  warnings.push(waring);
};

const host = createIncrementalLanguageServiceHost(cwd, rootFileNames, parsed.options);
const registory = ts.createDocumentRegistry();
const service = createIncrementalLanguageService(host, registory);

const minifier = createMinifier(service, cwd, rootFileNames, targets, true, withTerserMangleValidator, onwarn);

// function actionToDebug(action: CodeAction) {
//   const { node } = action;
//   const file = node.getSourceFile();
//   const { character, line } = file.getLineAndCharacterOfPosition(node.getStart());
//   const fileName = action.node.getSourceFile().fileName;
//   const codePos = `${fileName}:${line + 1}:${character + 1}`;
//   return {
//     text: node.getText(),
//     kind: ts.SyntaxKind[node.parent.kind],
//     // reason: reason,
//     at: codePos,
//   };
// }

// function renameToDebug(rename: BatchRenameLocationWithSource) {
//   const actionDebug = actionToDebug(rename.action);
//   const source = ts.createSourceFile(
//     rename.fileName,
//     fs.readFileSync(rename.fileName, "utf-8"),
//     ts.ScriptTarget.ESNext,
//     true,
//   );
//   const { character, line } = source.getLineAndCharacterOfPosition(rename.textSpan.start);
//   const renameAt = `${rename.fileName}:${line + 1}:${character + 1}`;
//   return {
//     original: rename.original,
//     renameAt,
//     from: actionDebug.at,
//   };
// }

// function debugBySymbolName(renames: BatchRenameLocationWithSource[], symbolName: string) {
//   console.log(
//     renames
//       .filter((x) => {
//         return x.original === symbolName;
//       })
//       .filter((action) => !action.fileName.includes("__experimental"))
//       .map((rename) => {
//         return renameToDebug(rename);
//       }),
//   );
// }

minifier.process();

for (const fileName of targets) {
  const content = minifier.readFile(fileName);
  if (content) {
    // const original = fs.readFileSync(fileName, "utf-8");
    // console.log("[selfhost:gen]", fileName.replace(srcRoot + "/", "__src/"), content.length, original.length);
    const tmpFile = fileName.replace("/src/", "/__src/");
    const outDirName = path.dirname(tmpFile);
    if (!fs.existsSync(outDirName)) {
      fs.mkdirSync(outDirName, { recursive: true });
    }
    fs.writeFileSync(tmpFile, content);
    // minifier.notifyChange(fileName, content);
  }
}

// console.log("--- waring ---");
// console.log(
//   "warnings",
//   warnings.map((x) => {
//     return {
//       // code: WarningCode[x.code],
//       message: x.message,
//       // at: `${x.fileName}:${x.line}:${x.character}`,
//     };
//   }),
// );
