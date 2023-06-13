import { expect, test } from "vitest";
import ts from "typescript";
import path from "node:path";

import { applyRenameLocations, createInMemoryLanguageServiceHost } from ".";

test("basic ugase", () => {
  const projectPath = path.join(__dirname, "../examples");
  const expandPath = (fname: string) => {
    if (fname.startsWith("/")) {
      return fname;
    }
    return path.join(projectPath, fname);
  };

  const tsconfig = ts.readConfigFile(
    path.join(projectPath, "tsconfig.json"),
    ts.sys.readFile,
  );
  const options = ts.parseJsonConfigFileContent(
    tsconfig.config,
    ts.sys,
    projectPath,
  );

  // console.log("options", options);

  // usage
  const prefs: ts.UserPreferences = {};
  const registory = ts.createDocumentRegistry();
  const serviceHost = createInMemoryLanguageServiceHost(
    options.fileNames,
    options.options,
    expandPath,
  );
  const languageService = ts.createLanguageService(
    serviceHost,
    registory,
  );

  // languageService.
  const snapshotManager = serviceHost.getSnapshotManager(registory);

  // write src/index.ts and check types
  const raw = snapshotManager.readFileSnapshot(expandPath("src/index.ts"));
  const newSource = snapshotManager.writeFileSnapshot(
    "src/index.ts",
    raw + "\nconst y: number = x;",
  );

  // find scoped variables

  // languageService.getSemanticDiagnostics("src/index.ts");
  const program = languageService.getProgram()!;
  const checker = program.getTypeChecker();
  const localVariables = checker.getSymbolsInScope(
    newSource,
    ts.SymbolFlags.BlockScopedVariable,
  );

  // console.log("localVariables", localVariables);

  // rename x to x_?
  const symbol = localVariables.find((s) => s.name === "x")!;
  const renameLocations = languageService.findRenameLocations(
    expandPath("src/index.ts"),
    symbol.valueDeclaration!.getStart(),
    false,
    false,
    prefs,
  );
  const targets = new Set(renameLocations!.map((loc) => loc.fileName));

  let current = snapshotManager.readFileSnapshot(expandPath("src/index.ts"))!;
  for (const target of targets) {
    const renameLocationsToTarget = renameLocations!.filter(
      (loc) => expandPath(target) === expandPath(loc.fileName),
    );
    const newSymbolName = `${symbol.name}_${
      Math.random().toString(36).slice(2)
    }`;
    current = applyRenameLocations(
      current,
      newSymbolName,
      renameLocationsToTarget,
    );
  }
  snapshotManager.writeFileSnapshot("src/index.ts", current);
  const result = languageService.getSemanticDiagnostics(
    expandPath("src/index.ts"),
  );
  console.log("post error", result.length);
  console.log(snapshotManager.readFileSnapshot(expandPath("src/index.ts")));

  const oldProgram = program;
  {
    // rename y to y_?
    const program = languageService.getProgram()!;
    const program2 = languageService.getProgram()!;
    console.log(
      "------- program updated",
      program !== oldProgram,
      program2 === program,
    );
    const checker = program.getTypeChecker();
    const newSource = program.getSourceFile(expandPath("src/index.ts"))!;
    const localVariables = checker.getSymbolsInScope(
      newSource,
      ts.SymbolFlags.BlockScopedVariable,
    );
    const symbol = localVariables.find((s) => s.name === "y")!;
    const renameLocations = languageService.findRenameLocations(
      expandPath("src/index.ts"),
      symbol.valueDeclaration!.getStart(),
      false,
      false,
      prefs,
    );
    const targets = new Set(renameLocations!.map((loc) => loc.fileName));
    let current = snapshotManager.readFileSnapshot("src/index.ts")!;
    for (const target of targets) {
      const renameLocationsToTarget = renameLocations!.filter(
        (loc) => expandPath(target) === expandPath(loc.fileName),
      );
      const newSymbolName = `${symbol.name}_${
        Math.random().toString(36).slice(2)
      }`;
      current = applyRenameLocations(
        current,
        newSymbolName,
        renameLocationsToTarget,
      );
    }
    snapshotManager.writeFileSnapshot(expandPath("src/index.ts"), current);
    const result = languageService.getSemanticDiagnostics(
      expandPath("src/index.ts"),
    );
    console.log("post error", result.length);
    console.log(snapshotManager.readFileSnapshot(expandPath("src/index.ts")));
  }
});
