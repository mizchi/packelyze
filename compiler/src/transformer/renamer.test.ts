import "../__vitestUtils";
import path from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";
import { RenameItem, applyRewiredRenames, collectRenameItems, getRenameAppliedChanges } from "./renamer";
import { createTestLanguageService, initTestLanguageServiceWithFiles } from "../testHarness";
import { collectScopedSymbols, collectScopedSignatures, createCollector, collectUnsafeRenameTargets } from "./analyzer";
import { preprocess } from "./transformer";
import { createSymbolBuilder } from "../symbolBuilder";
import { findFirstNode, getNodeAtPosition } from "../nodeUtils";

test("batch renaming", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent("src/index.ts", "const x: number = '';\nconst y: number = x;");

  const program = service.getProgram()!;
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const localVariables = checker.getSymbolsInScope(source, ts.SymbolFlags.BlockScopedVariable);
  const xSymbol = localVariables.find((s) => s.name === "x")!;

  const sourceFile = program.getSourceFile(normalizePath("src/index.ts"))!;
  const xRenameLocs = collectRenameItems(
    service,
    sourceFile,
    xSymbol.valueDeclaration!.getStart(),
    xSymbol.name,
    "x_changed",
  );

  const ySymbol = localVariables.find((s) => s.name === "y")!;
  const yRenameLocs = collectRenameItems(
    service,
    sourceFile,
    ySymbol.valueDeclaration!.getStart(),
    ySymbol.name,
    "y_changed",
  );

  const changedFiles = getRenameAppliedChanges(
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
  for (const change of changedFiles) {
    // const [changed, changedStart, changedEnd] = content;
    service.writeSnapshotContent(change.fileName, change.content);
  }
  expect(service.getSemanticDiagnostics(normalizePath("src/index.ts")).length).toBe(1);
  expect(service.readSnapshotContent(normalizePath("src/index.ts"))).toEqualFormatted(`
    const x_changed: number = '';
    const y_changed: number = x_changed;
  `);
});

test("shorthand", () => {
  const { service, normalizePath } = createTestLanguageService();

  service.writeSnapshotContent("src/index.ts", "function foo(): { y: 1 } { const y = 1; return { y } }");

  const regex = /y = 1/;
  const newSource = service.getCurrentSourceFile("src/index.ts")!;
  const hit = newSource.text.search(regex);
  const sourceFile = service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!;

  const renames = collectRenameItems(service, sourceFile, hit, "y", "y_renamed");

  const changedFiles = getRenameAppliedChanges(renames!, service.readSnapshotContent, normalizePath);
  for (const change of changedFiles) {
    service.writeSnapshotContent(change.fileName, change.content);
  }
  expect(service.readSnapshotContent(normalizePath("src/index.ts"))).toBe(
    `function foo(): { y: 1 } { const y_renamed = 1; return { y: y_renamed } }`,
  );
});

test("rename exported", () => {
  const { service, normalizePath } = initTestLanguageServiceWithFiles({
    "src/index.ts": preprocess(`
    const xxx = 1;

    const yyy = 2;
    export {
      xxx,
      yyy as zzz
    }
    `),
  });
  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const renameItems = collectRenameItemsForScopedFromFile(service, source);
  const changes = getRenameAppliedChanges(
    renameItems,
    (fname) => {
      const source = program.getSourceFile(fname);
      return source && source.text;
    },
    normalizePath,
  );
  const result = changes[0].content;
  expect(result).toEqualFormatted(`const k = 1;
const x = 2;
export { k as xxx, x as zzz };
`);
});

test("TS: rename propertyAssignment and propertySignature both", () => {
  const { service, normalizePath } = createTestLanguageService();
  const code = `
type Local = {
  local: number;
};
const lll: Local = {
  local: 1
}
export const x = fff();
`;
  // const preprocessed = preprocess(code);

  service.writeSnapshotContent(normalizePath("src/index.ts"), code);
  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;

  {
    // rename property signature
    const localSignaturePos = source.text.search(/local\: number/);
    const localSignatureNode = findFirstNode(program, normalizePath("src/index.ts"), "local: number")!.parent!;
    expect(localSignatureNode.getText()).toBe("local: number;");
    expect(ts.SyntaxKind[localSignatureNode.kind]).toBe("PropertySignature");

    const renames = service.findRenameLocations(normalizePath("src/index.ts"), localSignaturePos, false, false, {
      providePrefixAndSuffixTextForRename: true,
    });
    const renameItems: RenameItem[] = renames?.map((r) => {
      return {
        ...r,
        source: "local",
        to: "local_renamed",
      };
    })!;
    // console.log(renameItems);
    const [changed] = applyRewiredRenames(source.text, renameItems);
    // console.log(changed);
    expect(changed).toEqualFormatted(`
type Local = {
  local_renamed: number;
};
const lll: Local = {
  local_renamed: 1
}
export const x = fff();
`);
  }

  {
    // rename PropertyAssignment
    const localAssignmentPos = source.text.search(/local\: 1/);
    const localAssignmentNode = findFirstNode(program, normalizePath("src/index.ts"), "local: 1")!.parent!;
    expect(localAssignmentNode.getText()).toBe("local: 1");
    expect(ts.SyntaxKind[localAssignmentNode.kind]).toBe("PropertyAssignment");

    const renames = service.findRenameLocations(normalizePath("src/index.ts"), localAssignmentPos, false, false, {
      providePrefixAndSuffixTextForRename: true,
    });
    const renameItems: RenameItem[] = renames?.map((r) => {
      return {
        ...r,
        source: "local",
        to: "local_renamed",
      };
    })!;
    // console.log(renameItems);
    const [changed] = applyRewiredRenames(source.text, renameItems);
    // console.log(changed);
    expect(changed).toEqualFormatted(`
type Local = {
  local_renamed: number;
};
const lll: Local = {
  local_renamed: 1
}
export const x = fff();
`);
  }
});

test("TS: shorthand with providePrefixAndSuffixTextForRename", () => {
  const { service, normalizePath } = createTestLanguageService();
  const code = `
const vvv: number = 1;
export const x = {vvv};
`;
  service.writeSnapshotContent(normalizePath("src/index.ts"), code);
  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  {
    // rename property signature
    const searchText = "vvv";
    const identPos = source.text.search(searchText);
    const identNode = findFirstNode(program, normalizePath("src/index.ts"), searchText)!;
    expect(identNode.getText()).toBe("vvv");
    expect(ts.SyntaxKind[identNode.kind]).toBe("Identifier");

    const renames = service.findRenameLocations(normalizePath("src/index.ts"), identPos, false, false, {
      providePrefixAndSuffixTextForRename: true,
    });

    const renameItems: RenameItem[] = renames?.map((r) => {
      let toName = "vvv_renamed";
      if (r.prefixText) {
        toName = `${r.prefixText}${toName}`;
      }
      if (r.suffixText) {
        toName = `${toName}${r.suffixText}`;
      }
      return {
        ...r,
        source: searchText,
        to: toName,
      };
    })!;
    const [changed] = applyRewiredRenames(source.text, renameItems);
    expect(changed).toEqualFormatted(`
const vvv_renamed: number = 1;
export const x = {vvv: vvv_renamed};
`);
  }
});

test("rename local object member", () => {
  const { service, normalizePath } = initTestLanguageServiceWithFiles({
    "src/index.ts": preprocess(`
    type Local = {
      xxx: number;
    };
    type Pub = {
      pubv: number;
    };
    const local: Local = {
      xxx: 1,
    };
    export const pub: Pub = {
      pubv: 1,
    };    
    `),
  });

  const source = service.getCurrentSourceFile(normalizePath("src/index.ts"))!;

  const renameItems = collectRenameItemsForScopedFromFile(service, source);
  const state = getRenameAppliedChanges(
    renameItems,
    (fname) => {
      const source = service.getCurrentSourceFile(fname);
      return source && source.text;
    },
    normalizePath,
  );
  const result = state[0].content;
  expect(result).toEqualFormatted(`type Local = {
    xxx: number;
};
type Pub = {
    pubv: number;
};
const k: Local = { xxx: 1 };
const x: Pub = { pubv: 1 };
export { x as pub };
`);
  // return;
  {
    // try to rename signature
    const source = service.getCurrentSourceFile("src/index.ts")!;
    const renameItems = collectRenameItemsForSignatureFromFile(service, source);
    // console.log(
    //   "renames",
    //   renameItems.map((item) => `${item.source} => ${item.target} (${item.textSpan.start}, ${item.textSpan.length})`),
    // );
    const state = getRenameAppliedChanges(
      renameItems,
      (fname) => {
        const source = service.getCurrentSourceFile(fname);
        return source && source.text;
      },
      normalizePath,
    );
    // console.log(state)
    // const result = state.get(normalizePath("src/index.ts"))![0];
    // console.log(result);
    //     expect(result).toEqualFormatted(`type Local = {
    //     _: number;
    // };
  }
});

test("rewire exports: complex", () => {
  const { service, normalizePath } = createTestLanguageService();

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

  service.writeSnapshotContent("src/index.ts", preprocessed);

  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const renameItems = collectRenameItemsForScopedFromFile(service, source);
  const state = getRenameAppliedChanges(
    renameItems,
    (fname) => {
      const source = program.getSourceFile(fname);
      return source && source.text;
    },
    normalizePath,
  );
  const result = state[0].content;
  expect(result).toEqualFormatted(`export { sub } from "./sub";
const k = 1;
function x() { }
class j {
}
enum q {
}
type Ttt = number;
interface Iii {
}
const z = 1;
{
    const p = 2;
}
const f = 1;
const y = 2;
export { f as vvv, y as zzz, k as xxx, x as fff, j as Ccc, q as Eee, Ttt, Iii };
`);
});

test("TS: rename multi file", () => {
  const { service, normalizePath } = createTestLanguageService();

  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
      import { sub } from "./sub";
      console.log(sub.sub);
    `,
  );
  service.writeSnapshotContent(
    normalizePath("src/sub.ts"),
    `
      type SubLocal = {
        sub: number;
      }
      const sub: SubLocal = { sub: 1 };
      export { sub };
    `,
  );
  const program = service.getProgram()!;
  // const index = service.getCurrentSourceFile("src/index.ts")!;
  const sub = service.getCurrentSourceFile("src/sub.ts")!;

  const subSignatureNode = findFirstNode(program, normalizePath("src/sub.ts"), "sub: number")!.parent!;
  // console.log()
  expect(subSignatureNode.getText()).toBe("sub: number;");
  expect(ts.SyntaxKind[subSignatureNode.kind]).toBe("PropertySignature");

  // const pos = subSignatureNode;
  if (!(ts.isPropertySignature(subSignatureNode) && subSignatureNode.pos)) {
    throw new Error("unexpected");
  }
  expect(ts.SyntaxKind[subSignatureNode.kind]).toBe("PropertySignature");
  const renames = service.findRenameLocations(
    // ar
    normalizePath("src/sub.ts"),
    33,
    false,
    false,
    {
      providePrefixAndSuffixTextForRename: true,
    },
  );
  const renameItems: RenameItem[] = renames?.map((r) => {
    return {
      ...r,
      source: "sub",
      to: "sub_renamed",
    };
  })!;

  if (!renameItems) throw new Error("unexpected");

  const state = getRenameAppliedChanges(
    renameItems,
    (fname) => {
      const source = program.getSourceFile(fname);
      return source && source.text;
    },
    normalizePath,
  );
  const indexCode = state.find((x) => x.fileName.endsWith("src/index.ts"))!.content;
  expect(indexCode).toEqualFormatted(`
  import { sub } from "./sub";
  console.log(sub.sub_renamed);
  `);

  const subCode = state.find((x) => x.fileName.endsWith("src/sub.ts"))!.content;
  expect(subCode).toEqualFormatted(`
  type SubLocal = {
    sub_renamed: number;
  };
  const sub: SubLocal = { sub_renamed: 1 };
  export { sub };
  `);
});

test("rewire exports: enum", () => {
  const { service, normalizePath } = createTestLanguageService();

  const preprocessed = preprocess(`
    export enum Eee {}
  `);

  service.writeSnapshotContent("src/index.ts", preprocessed);

  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const renameItems = collectRenameItemsForScopedFromFile(service, source);
  const state = getRenameAppliedChanges(
    renameItems,
    (fname) => {
      const source = program.getSourceFile(fname);
      return source && source.text;
    },
    normalizePath,
  );
  // const result = state.get(normalizePath("src/index.ts"))![0];
  const result = state[0].content;

  // console.log(result);
  expect(result).toEqualFormatted(`
enum k {}
export { k as Eee };
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
      const locs = collectRenameItems(service, declaration.getSourceFile(), declaration.getStart(), original, newName);
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

  // console.log("scopedSignature", scopedSignatures);
  for (const blockedSymbol of scopedSignatures) {
    const declaration = blockedSymbol.symbol.valueDeclaration;
    if (declaration) {
      const original = blockedSymbol.symbol.getName();
      const newName = symbolBuilder.create((newName) => !unsafeRenameTargets.has(newName));
      const locs = collectRenameItems(service, declaration.getSourceFile(), declaration.getStart(), original, newName);
      locs && renameItems.push(...locs);
    }
  }
  return renameItems;
}

function isExportedAncestor(node: ts.Node, finder = (node: ts.Node) => true) {
  let cur = node;
  while ((cur = cur.parent)) {
    // force stop
    if (ts.isSourceFile(cur) || ts.isBlock(cur)) {
      break;
    }
    // only checkable nodes. not stoppable
    if (ts.isTypeLiteralNode(cur) || ts.isTupleTypeNode(cur)) {
      if (finder(cur)) {
        return true;
      }
    }
    // terminater
    if (ts.isTypeAliasDeclaration(cur) || ts.isInterfaceDeclaration(cur)) {
      // console.log('decl', ts.SyntaxKind[cur.kind], cur === pubTypeNode);
      return finder(cur);
      break;
    }
  }
  return false;
}
