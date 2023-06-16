import path from "node:path";
import { expect, test } from "vitest";
import { UserPreferences, parseJsonConfigFileContent, readConfigFile, sys, createDocumentRegistry, createLanguageService, SymbolFlags } from "typescript";
import { createInMemoryLanguageServiceHost } from "./index";
import { findRenameLocations, getRenameAppliedState } from "./rename";
import { createTestLanguageService } from "./testHarness";
import { findScopedSymbols } from "./analyzer";

test("batch renaming", () => {
  const projectPath = path.join(__dirname, "../examples");
  const tsconfig = readConfigFile(
    path.join(projectPath, "tsconfig.json"),
    sys.readFile,
  );
  const options = parseJsonConfigFileContent(
    tsconfig.config,
    sys,
    projectPath,
  );
  // usage
  const prefs: UserPreferences = {};
  const registory = createDocumentRegistry();
  const serviceHost = createInMemoryLanguageServiceHost(
    projectPath,
    options.fileNames,
    options.options,
  );
  const languageService = createLanguageService(
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
    SymbolFlags.BlockScopedVariable,
  );
  const xSymbol = localVariables.find((s) => s.name === "x")!;
  const xRenameLocs = findRenameLocations(
    languageService,
    expandPath("src/index.ts"),
    xSymbol.valueDeclaration!.getStart(),
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

test("shorthand", () => {
  const {
    service,
    snapshotManager,
    normalizePath,
  } = createTestLanguageService();

  const newSource = snapshotManager.writeFileSnapshot(
    "src/index.ts",
    "function foo(): { y: 1 } { const y = 1; return { y } }",
  );

  const regex = /y = 1/;
  const hit = newSource.text.search(regex);

  const renames = findRenameLocations(
    service,
    normalizePath("src/index.ts"),
    hit,
  );

  const changedFiles = getRenameAppliedState(
    [
      {
        original: "y",
        to: "y_renamed",
        locations: renames!,
      },
    ],
    snapshotManager.readFileSnapshot,
    normalizePath,
  );
  for (const [fname, content] of changedFiles) {
    const [changed, changedStart, changedEnd] = content;
    snapshotManager.writeFileSnapshot(fname, changed);
  }
  expect(
    snapshotManager.readFileSnapshot(normalizePath("src/index.ts")),
  ).toBe(
    `function foo(): { y: 1 } { const y_renamed = 1; return { y: y_renamed } }`,
  );
});

test.only("export with as", () => {
  const {
    service,
    snapshotManager,
    normalizePath,
  } = createTestLanguageService();
  const newSource = snapshotManager.writeFileSnapshot(
    "src/index.ts",
    `
    export const xxx = 1;
    const yyy = 2;
    export { yyy };
    `,
  );
  // const regex = /y = 1/;
  // const hit = newSource.text.search(regex);
  const program = service.getProgram()!;
  const symbols = findScopedSymbols(program, newSource);
  // console.log(symbols);
  // expect(symbols.map((s) => s)).toEqual(["xxx", "yyy"]);

  // const renames = findRenameLocations(
  //   service,
  //   normalizePath("src/index.ts"),
  //   hit,
  // );

  // const changedFiles = getRenameAppliedState(
  //   [
  //     {
  //       original: "y",
  //       to: "y_renamed",
  //       locations: renames!,
  //     },
  //   ],
  //   snapshotManager.readFileSnapshot,
  //   normalizePath,
  // );
  // for (const [fname, content] of changedFiles) {
  //   const [changed, changedStart, changedEnd] = content;
  //   snapshotManager.writeFileSnapshot(fname, changed);
  // }
  // expect(
  //   snapshotManager.readFileSnapshot(normalizePath("src/index.ts")),
  // ).toBe(
  //   `function foo(): { y: 1 } { const y_renamed = 1; return { y: y_renamed } }`,
  // );
});

