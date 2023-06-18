import path from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";
import { RenameItem, RenameSourceKind, collectRenameItems, getRenameAppliedState } from "./renamer";
import { createTestLanguageService } from "./testHarness";
import { collectUnsafeRenameTargets, collectExportSymbols, collectScopedSymbols, collectScopedSignatures } from "./analyzer";
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
    ts.SymbolFlags.BlockScopedVariable,
  );
  const xSymbol = localVariables.find((s) => s.name === "x")!;

  const sourceFile = program.getSourceFile(normalizePath("src/index.ts"))!;
  const xRenameLocs = collectRenameItems(
    service,
    sourceFile,
    xSymbol.valueDeclaration!.getStart(),
    RenameSourceKind.ScopedIdentifier,
    xSymbol.name,
    "x_changed",
  );

  const ySymbol = localVariables.find((s) => s.name === "y")!;
  const yRenameLocs = collectRenameItems(
    service,
    sourceFile,
    ySymbol.valueDeclaration!.getStart(),
    RenameSourceKind.ScopedIdentifier,
    
    ySymbol.name,
    "y_changed",
  );

  const changedFiles = getRenameAppliedState(
    [
      ...xRenameLocs!.map((loc) => ({
        ...loc,
        original: "x",
        to: "x_changed",
      })),
      ...yRenameLocs!.map((loc) => ({
        ...loc,
        original: "y",
        to: "y_changed",
      })),
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

  const renames = collectRenameItems(
    service,
    sourceFile,
    hit,
    RenameSourceKind.ScopedIdentifier,
    "y",
    "y_renamed",
  );

  const changedFiles = getRenameAppliedState(
    renames!,
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

  const tempSource =`
    const xxx = 1;

    const yyy = 2;
    export {
      xxx,
      yyy as zzz
    }
    `;
  const preprocessed = preprocess(tempSource);

  service.writeSnapshotContent(
    "src/index.ts",
    preprocessed,
  );
  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const renameItems = collectRenameItemsForScopedFromFile(service, source);
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


test("rename local object member", () => {
  // type Local = {
  //   xxx: number;
  // };
  // const local: Local = {
  //   xxx: 1,
  // };  
  const {
    service,
    normalizePath,
  } = createTestLanguageService();

  const code = `
    type Local = {
      xxx: number;
    };
    type Pub = {
      pub: number;
    };
    const local: Local = {
      xxx: 1,
    };
    export const pub: Pub = {
      pub: 1,
    };
    `;
  const preprocessed = preprocess(code);
  service.writeSnapshotContent(
    "src/index.ts",
    preprocessed,
  );
  const source = service.getCurrentSourceFile(normalizePath("src/index.ts"))!;

  const renameItems = collectRenameItemsForScopedFromFile(service, source);
  // console.log(renameItems);
  const state = getRenameAppliedState(renameItems, (fname) => {
    const source = service.getCurrentSourceFile(fname);
    return source && source.text;
  }, normalizePath);
  const result = state.get(normalizePath("src/index.ts"))![0];
  // console.log(result);
  expect(result).toBe(`type Local = {
    xxx: number;
};
type Pub = {
    pub: number;
};
const _: Local = { xxx: 1 };
const $: Pub = { pub: 1 };
export { $ as pub };
`);
  // return;
  {
    // try to rename signature
    const source = service.getCurrentSourceFile('src/index.ts')!;
    const renameItems = collectRenameItemsForSignatureFromFile(service, source);
    // console.log(renameItems);
    const state = getRenameAppliedState(renameItems, (fname) => {
      const source = service.getCurrentSourceFile(fname);
      return source && source.text;
    }, normalizePath);
    // const result = state.get(normalizePath("src/index.ts"))![0];
    // console.log(result);
//     expect(result).toBe(`type Local = {
//     _: number;
// };
// type Pub = {
//     $: number;
// };
// const local: Local = { _: 1 };
// const pub: Pub = { $: 1 };
// export { pub };
// `);
  }
});
  // expect(result).toBe(`type Local = {
//   expect(result).toBe(`type Local = {
//     _: number;
// };
// const $: Local = {
//     _: 1
// }
// export const exported = 1;
// `);


test("rewire exports: complex", () => {
  const {
    service,
    normalizePath,
  } = createTestLanguageService();

  const tempSource = ts.createSourceFile(
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
    ts.ScriptTarget.ESNext,
  );
  const preprocessed = preprocess(tempSource);

  service.writeSnapshotContent(
    "src/index.ts",
    preprocessed,
  );

  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const renameItems = collectRenameItemsForScopedFromFile(service, source);
  const state = getRenameAppliedState(renameItems, (fname) => {
    const source = program.getSourceFile(fname);
    return source && source.text;
  }, normalizePath);
  const result = state.get(normalizePath("src/index.ts"))![0];
  expect(result).toBe(`export { sub } from "./sub";
const _ = 1;
function $() { }
class a {
}
enum b {
}
type Ttt = number;
interface Iii {
}
const c = 1;
{
    const d = 2;
}
const e = 1;
const f = 2;
export { e as vvv, f as zzz, _ as xxx, $ as fff, a as Ccc, b as Eee, Ttt, Iii };
`);
});

test.skip("rename multi file", () => {
  const {
    service,
  } = createTestLanguageService();

  service.writeSnapshotContent(
    "src/index.ts",
    `
      import { sub } from "./sub";
      console.log(sub);
    `,
  );
  service.writeSnapshotContent(
    "src/sub.ts",
    `
      const sub = 1;
      export { sub };
    `,
  );

  const program = service.getProgram()!;
  const source = program.getSourceFile("sub/index.ts")!;
  console.log(
    collectExportSymbols(program, source),
  );
  // const renameItems = collectRenameItemsFromFile(service, source);
//   const state = getRenameAppliedState(renameItems, (fname) => {
//     const source = program.getSourceFile(fname);
//     return source && source.text;
//   }, normalizePath);
//   const result = state.get(normalizePath("src/index.ts"))![0];
//   // console.log(result);
//   expect(result).toBe(`enum _ {}
// export { _ as Eee};
// `);
});

test("rewire exports: enum", () => {
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
  const renameItems = collectRenameItemsForScopedFromFile(service, source);
  const state = getRenameAppliedState(renameItems, (fname) => {
    const source = program.getSourceFile(fname);
    return source && source.text;
  }, normalizePath);
  const result = state.get(normalizePath("src/index.ts"))![0];
  // console.log(result);
  expect(result).toBe(`enum _ {
}
export { _ as Eee };
`);
});

function collectRenameItemsForScopedFromFile(service: ts.LanguageService, file: ts.SourceFile) {
  const program = service.getProgram()!;
  const symbolBuilder = createSymbolBuilder();
  const scopedSymbols = collectScopedSymbols(program, file);
  const renameItems: RenameItem[] = [];
  const unsafeRenameTargets = collectUnsafeRenameTargets(program, file, scopedSymbols);

  for (const blockedSymbol of scopedSymbols) {
    const declaration = blockedSymbol.symbol.valueDeclaration;
    if (declaration) {
      const original = blockedSymbol.symbol.getName();
      const newName = symbolBuilder.create((newName) => !unsafeRenameTargets.has(newName));
      const locs = collectRenameItems(
        service, declaration.getSourceFile(),
        declaration.getStart(),
        RenameSourceKind.ScopedIdentifier,
        original,
        newName
      );
      locs && renameItems.push(...locs);
    }
  }
  return renameItems;  
}

export function collectRenameItemsForSignatureFromFile(service: ts.LanguageService, file: ts.SourceFile) {
  const program = service.getProgram()!;
  const symbolBuilder = createSymbolBuilder();
  const scopedSignatures = collectScopedSignatures(program, file);
  const renameItems: RenameItem[] = [];
  const unsafeRenameTargets = collectUnsafeRenameTargets(program, file, scopedSignatures);

  for (const blockedSymbol of scopedSignatures) {
    const declaration = blockedSymbol.symbol.valueDeclaration;
    if (declaration) {
      const original = blockedSymbol.symbol.getName();
      const newName = symbolBuilder.create((newName) => !unsafeRenameTargets.has(newName));
      const locs = collectRenameItems(
        service, declaration.getSourceFile(),
        declaration.getStart(),
        RenameSourceKind.ScopedSignature,
        original,
        newName
      );
      locs && renameItems.push(...locs);
    }
  }
  return renameItems;  
}

