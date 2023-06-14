import { expect, test } from "vitest";
import ts from "typescript";
import path from "node:path";

import { createInMemoryLanguageServiceHost } from ".";
import { getRenameAppliedState } from "./rename";

test("batch renaming", () => {
  const projectPath = path.join(__dirname, "../examples");
  const tsconfig = ts.readConfigFile(
    path.join(projectPath, "tsconfig.json"),
    ts.sys.readFile,
  );
  const options = ts.parseJsonConfigFileContent(
    tsconfig.config,
    ts.sys,
    projectPath,
  );
  // usage
  const prefs: ts.UserPreferences = {};
  const registory = ts.createDocumentRegistry();
  const serviceHost = createInMemoryLanguageServiceHost(
    projectPath,
    options.fileNames,
    options.options,
  );
  const languageService = ts.createLanguageService(
    serviceHost,
    registory,
  );

  const expandPath = (fname: string) => {
    if (fname.startsWith("/")) {
      return fname;
    }
    const root = projectPath;
    return path.join(root, fname);
  };

  const snapshotManager = serviceHost.getSnapshotManager(registory);

  const newSource = snapshotManager.writeFileSnapshot(
    "src/index.ts",
    "const x: number = '';\nconst y: number = x;",
  );

  const program = languageService.getProgram()!;
  const checker = program.getTypeChecker();
  const localVariables = checker.getSymbolsInScope(
    newSource,
    ts.SymbolFlags.BlockScopedVariable,
  );
  const xSymbol = localVariables.find((s) => s.name === "x")!;
  const xRenameLocs = languageService.findRenameLocations(
    expandPath("src/index.ts"),
    xSymbol.valueDeclaration!.getStart(),
    false,
    false,
    prefs,
  );

  const ySymbol = localVariables.find((s) => s.name === "y")!;
  const yRenameLocs = languageService.findRenameLocations(
    expandPath("src/index.ts"),
    ySymbol.valueDeclaration!.getStart(),
    false,
    false,
    prefs,
  );

  const changedFiles = getRenameAppliedState(
    [
      {
        original: "x",
        to: "x_changed",
        locations: xRenameLocs!,
      },
      {
        original: "y",
        to: "y_changed",
        locations: yRenameLocs!,
      },
    ],
    snapshotManager.readFileSnapshot,
    expandPath,
  );
  for (const [fname, content] of changedFiles) {
    const [changed, changedStart, changedEnd] = content;
    // TODO: use changedStart and changedEnd
    snapshotManager.writeFileSnapshot(fname, changed);
  }
  expect(
    languageService.getSemanticDiagnostics(
      expandPath("src/index.ts"),
    ).length,
  ).toBe(1);
  expect(
    snapshotManager.readFileSnapshot(expandPath("src/index.ts")),
  ).toBe(`const x_changed: number = '';
const y_changed: number = x_changed;`);
});
