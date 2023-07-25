import fs from "node:fs";
import path from "node:path";
import { aggressiveMangleValidator, createMinifier } from "../src/minifier";
import ts from "typescript";
import { MinifierProcessStep, OnWarning, Warning, WarningCode } from "../src/types";
import { BatchRenameLocationWithSource, CodeAction } from "../src/transform/transformTypes";

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

const rootFileNames = [path.join(cwd, "./src/index.ts")];

const warnings: Warning[] = [];
const onwarn: OnWarning = (waring) => {
  warnings.push(waring);
};

const minifier = createMinifier(
  cwd,
  rootFileNames,
  targets,
  parsed.options,
  undefined,
  true,
  aggressiveMangleValidator,
  onwarn,
);

const processor = minifier.createProcess();

function actionToDebug(action: CodeAction) {
  const { node } = action;
  const file = node.getSourceFile();
  const { character, line } = file.getLineAndCharacterOfPosition(node.getStart());
  const codePos = `${action.fileName}:${line + 1}:${character + 1}`;
  return {
    text: node.getText(),
    kind: ts.SyntaxKind[node.parent.kind],
    // reason: reason,
    at: codePos,
  };
}

function renameToDebug(rename: BatchRenameLocationWithSource) {
  const actionDebug = actionToDebug(rename.action);
  const source = ts.createSourceFile(
    rename.fileName,
    fs.readFileSync(rename.fileName, "utf-8"),
    ts.ScriptTarget.ESNext,
    true,
  );
  const { character, line } = source.getLineAndCharacterOfPosition(rename.textSpan.start);
  const renameAt = `${rename.fileName}:${line + 1}:${character + 1}`;
  return {
    original: rename.original,
    renameAt,
    from: actionDebug.at,
  };
}

function debugBySymbolName(renames: BatchRenameLocationWithSource[], symbolName: string) {
  console.log(
    renames
      .filter((x) => {
        return x.original === symbolName;
      })
      .filter((action) => !action.fileName.includes("__experimental"))
      .map((rename) => {
        return renameToDebug(rename);
      }),
  );
}

for (const step of processor) {
  // console.log("---[", MinifierProcessStep[step.stepName], "]---");
  switch (step.stepName) {
    case MinifierProcessStep.PreDiagnostic: {
      break;
    }
    case MinifierProcessStep.Analyze: {
      console.log(
        // types
        "[symbols]",
        // step.visited.symbols
        //   .filter((x) => {
        //     const file = x.declarations?.[0].getSourceFile();
        //     return !file?.isDeclarationFile;
        //   })
        //   .map((x) => x.name),
        "[types]",
        // step.visited.types
        //   .filter((x) => {
        //     const file = x.symbol?.declarations?.[0].getSourceFile();
        //     return !file?.isDeclarationFile;
        //   })
        //   .map((x) => x.symbol?.name),
        "[nodes]",
        // step.visited.nodes
        //   .filter((x) => {
        //     const file = x.getSourceFile();
        //     return !file?.isDeclarationFile;
        //   })
        //   .map((x) => x.getText()),
      );
      // throw "stop";
      break;
    }
    case MinifierProcessStep.CreateActionsForFile: {
      // console.log(
      //   "[",
      //   MinifierProcessStep[step.stepName],
      //   "]",
      //   // xx
      //   // "[selfhost:file-actions]",
      //   // step.fileName.replace(srcRoot + "/", ""),
      //   // step.actions
      //   //   .filter((action) => action.originalTrial.node.getText() === "symbols")
      //   //   .filter((action) => !action.fileName.includes("__experimental"))
      //   //   .map((action) => {
      //   //     return actionToDebug(action);
      //   //   }),
      // );
      break;
    }
    case MinifierProcessStep.AllActionsCreated: {
      // console.log(
      //   "[minifier:all-actions]",
      //   step.actions.length,
      // );
      break;
    }
    case MinifierProcessStep.ExpandRenameLocations: {
      debugBySymbolName(step.renames, "actions");
      break;
    }
    case MinifierProcessStep.ApplyFileChanges: {
      break;
    }
    case MinifierProcessStep.PostDiagnostic: {
      break;
    }
  }
}

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
