import path from "node:path";
import { expect, test } from "vitest";
import { transform, Node, UserPreferences, parseJsonConfigFileContent, readConfigFile, sys, createDocumentRegistry, createLanguageService, SymbolFlags, SyntaxKind, Symbol, isVariableStatement, isClassDeclaration, VariableStatement, InterfaceDeclaration, TypeAliasDeclaration, TransformerFactory, TransformationContext, SourceFile, visitEachChild, Visitor, visitNode, isSourceFile, factory, isFunctionDeclaration, isTypeAliasDeclaration, isEnumDeclaration, isModuleDeclaration, isInterfaceDeclaration, Identifier, isIdentifier, createPrinter, Statement, isExportDeclaration, ExportDeclaration, isNamedExportBindings, isNamedExports, createSourceFile, ScriptTarget, Program, LanguageService } from "typescript";
import { createIncrementalLanguageServiceHost } from "./services";
import { BatchRenameItem, findRenameDetails, getRenameAppliedState } from "./rename";
import { createTestLanguageService } from "./testHarness";
import { collectUnsafeRenameTargets, findExportSymbols, findScopedSymbols } from "./analyzer";
import { AnyExportableDeclaration, findExportableDeclaration, isExportableDeclaration, isExportedDeclaration } from "./nodeUtils";
import { preprocess } from "./transformer";
import { createSymbolBuilder } from "./symbolBuilder";

test("batch renaming", () => {
  const projectPath = path.join(__dirname, "../examples");
  const {service} = createTestLanguageService(projectPath);
  const normalizePath = (fname: string) => {
    if (fname.startsWith("/")) {
      return fname;
    }
    const root = projectPath;
    return path.join(root, fname);
  };
  service.writeSnapshotContent(
    "src/index.ts",
    "const x: number = '';\nconst y: number = x;",
  );

  const program = service.getProgram()!;
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const localVariables = checker.getSymbolsInScope(
    source,
    SymbolFlags.BlockScopedVariable,
  );
  const xSymbol = localVariables.find((s) => s.name === "x")!;

  const sourceFile = program.getSourceFile(normalizePath("src/index.ts"))!;
  const xRenameLocs = findRenameDetails(
    service,
    sourceFile,
    xSymbol.valueDeclaration!.getStart(),
  );

  const ySymbol = localVariables.find((s) => s.name === "y")!;
  const yRenameLocs = findRenameDetails(
    service,
    sourceFile,
    ySymbol.valueDeclaration!.getStart(),
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
    service.readSnapshotContent,
    normalizePath,
  );
  for (const [fname, content] of changedFiles) {
    const [changed, changedStart, changedEnd] = content;
    service.writeSnapshotContent(fname, changed);
  }
  expect(
    service.getSemanticDiagnostics(
      normalizePath("src/index.ts"),
    ).length,
  ).toBe(1);
  expect(
    service.readSnapshotContent(normalizePath("src/index.ts")),
  ).toBe(`const x_changed: number = '';
const y_changed: number = x_changed;`);
});

test("shorthand", () => {
  const {
    service,
    normalizePath,
  } = createTestLanguageService();

  service.writeSnapshotContent(
    "src/index.ts",
    "function foo(): { y: 1 } { const y = 1; return { y } }",
  );

  const regex = /y = 1/;
  const newSource = service.getCurrentSourceFile("src/index.ts")!;
  const hit = newSource.text.search(regex);
  const sourceFile = service.getProgram()!.getSourceFile(
    normalizePath("src/index.ts"),
  )!;

  const renames = findRenameDetails(
    service,
    sourceFile,
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
    service.readSnapshotContent,
    normalizePath,
  );
  for (const [fname, content] of changedFiles) {
    const [changed, changedStart, changedEnd] = content;
    service.writeSnapshotContent(fname, changed);
  }
  expect(
    service.readSnapshotContent(normalizePath("src/index.ts")),
  ).toBe(
    `function foo(): { y: 1 } { const y_renamed = 1; return { y: y_renamed } }`,
  );
});

test("rename exported", () => {
  const {
    service,
    normalizePath,
  } = createTestLanguageService();

  const tempSource = createSourceFile(
    "src/index.ts",
    `
    const xxx = 1;

    const yyy = 2;
    export {
      xxx,
      yyy as zzz
    }
    `,
    ScriptTarget.ESNext,
  );
  const preprocessed = preprocess(tempSource);

  service.writeSnapshotContent(
    "src/index.ts",
    preprocessed,
  );
  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const renameItems = collectRenameItemsInFile(service, source);
  const state = getRenameAppliedState(renameItems, (fname) => {
    const source = program.getSourceFile(fname);
    return source && source.text;
  }, normalizePath);
  const result = state.get(normalizePath("src/index.ts"))![0];
  expect(result).toBe(`const _ = 1;
const $ = 2;
export { _ as xxx, $ as zzz };
`);
});

test("rewire exports: complex", () => {
  const {
    service,
    normalizePath,
  } = createTestLanguageService();

  const tempSource = createSourceFile(
    "src/index.ts",
    `
    export { sub } from "./sub";
    export const xxx = 1;
    export function fff() {}
    export class Ccc {}
    export enum Eee {}

    export type Ttt = number;
    export interface Iii {}

    const local = 1;
    {
      const nested = 2;
    }

    const vvv = 1;
    const yyy = 2;
    export {
      vvv,
      yyy as zzz
    }
    `,
    ScriptTarget.ESNext,
  );
  const preprocessed = preprocess(tempSource);

  service.writeSnapshotContent(
    "src/index.ts",
    preprocessed,
  );

  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const renameItems = collectRenameItemsInFile(service, source);
  const state = getRenameAppliedState(renameItems, (fname) => {
    const source = program.getSourceFile(fname);
    return source && source.text;
  }, normalizePath);
  const result = state.get(normalizePath("src/index.ts"))![0];
  // console.log(result);
  // return
  expect(result).toBe(`export { sub } from "./sub";
const _ = 1;
function e() { }
class $ {
}
enum a {
}
type Ttt = number;
interface Iii {
}
const b = 1;
{
    const f = 2;
}
const c = 1;
const d = 2;
export { c as vvv, d as zzz, _ as xxx, e as fff, $ as Ccc, a as Eee, Ttt, Iii };
`);
});

test.skip("rewire exports: enum", () => {
  const {
    service,
    normalizePath,
  } = createTestLanguageService();

  const preprocessed = preprocess(`
    export enum Eee {}
  `);

  service.writeSnapshotContent(
    "src/index.ts",
    preprocessed,
  );

  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const renameItems = collectRenameItemsInFile(service, source);
  const state = getRenameAppliedState(renameItems, (fname) => {
    const source = program.getSourceFile(fname);
    return source && source.text;
  }, normalizePath);
  const result = state.get(normalizePath("src/index.ts"))![0];
  // console.log(result);
  expect(result).toBe(`enum _ {}
export { _ as Eee};
`);
});


function collectRenameItemsInFile(service: LanguageService, file: SourceFile) {
  const program = service.getProgram()!;
  const symbolBuilder = createSymbolBuilder();
  const scopedSymbols = findScopedSymbols(program, file);
  const renameItems: BatchRenameItem[] = [];
  const unsafeRenameTargets = collectUnsafeRenameTargets(program, file, scopedSymbols);

  for (const blockedSymbol of scopedSymbols) {
    const declaration = blockedSymbol.symbol.valueDeclaration;
    if (declaration) {
      const locs = findRenameDetails(service, declaration.getSourceFile(), declaration.getStart());
      if (locs) {
        const newName = symbolBuilder.create((newName) => !unsafeRenameTargets.has(newName));
        renameItems.push({
          original: blockedSymbol.symbol.getName(),
          to: newName,
          locations: locs!,
        });  
      }
    }
  }
  return renameItems;  
}
