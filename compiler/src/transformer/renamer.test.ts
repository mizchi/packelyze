import "../__tests/globals";
import ts from "typescript";
import { expect, test } from "vitest";
import { applyBatchRenameLocations, findRenameItems, getRenamedFileChanges } from "./renamer";
import { createTestLanguageService } from "../__tests/testHarness";
import { findFirstNode } from "../typescript/utils";
import { BatchRenameLocation } from "./types";

test("batch renaming", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent("src/index.ts", "const x: number = '';\nconst y: number = x;");

  const program = service.getProgram()!;
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const localVariables = checker.getSymbolsInScope(source, ts.SymbolFlags.BlockScopedVariable);
  const xSymbol = localVariables.find((s) => s.name === "x")!;

  const sourceFile = program.getSourceFile(normalizePath("src/index.ts"))!;
  const xRenameLocs = findRenameItems(
    service.findRenameLocations,
    sourceFile.fileName,
    xSymbol.valueDeclaration!.getStart(),
    xSymbol.name,
    "x_changed",
  );

  const ySymbol = localVariables.find((s) => s.name === "y")!;
  const yRenameLocs = findRenameItems(
    service.findRenameLocations,
    sourceFile.fileName,
    ySymbol.valueDeclaration!.getStart(),
    ySymbol.name,
    "y_changed",
  );

  const changedFiles = getRenamedFileChanges(
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

test("TS: rename shorthand", () => {
  const { service, normalizePath } = createTestLanguageService();

  service.writeSnapshotContent("src/index.ts", "function foo(): { y: 1 } { const y = 1; return { y } }");

  const regex = /y = 1/;
  const newSource = service.getCurrentSourceFile("src/index.ts")!;
  const hit = newSource.text.search(regex);
  const sourceFile = service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!;

  const renames = findRenameItems(service.findRenameLocations, sourceFile.fileName, hit, "y", "y_renamed");

  const changedFiles = getRenamedFileChanges(renames!, service.readSnapshotContent, normalizePath);
  for (const change of changedFiles) {
    service.writeSnapshotContent(change.fileName, change.content);
  }
  expect(service.readSnapshotContent(normalizePath("src/index.ts"))).toBe(
    `function foo(): { y: 1 } { const y_renamed = 1; return { y: y_renamed } }`,
  );
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
    const renameItems: BatchRenameLocation[] = renames?.map((r) => {
      return {
        ...r,
        original: "local",
        to: "local_renamed",
      };
    })!;
    // console.log(renameItems);
    const [changed] = applyBatchRenameLocations(source.text, renameItems);
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
    const renameItems: BatchRenameLocation[] = renames?.map((r) => {
      return {
        ...r,
        original: "local",
        to: "local_renamed",
      };
    })!;
    // console.log(renameItems);
    const [changed] = applyBatchRenameLocations(source.text, renameItems);
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

    const renameItems: BatchRenameLocation[] = renames?.map((r) => {
      let toName = "vvv_renamed";
      if (r.prefixText) {
        toName = `${r.prefixText}${toName}`;
      }
      if (r.suffixText) {
        toName = `${toName}${r.suffixText}`;
      }
      return {
        ...r,
        original: searchText,
        to: toName,
      };
    })!;
    const [changed] = applyBatchRenameLocations(source.text, renameItems);
    expect(changed).toEqualFormatted(`
const vvv_renamed: number = 1;
export const x = {vvv: vvv_renamed};
`);
  }
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
  const renameItems: BatchRenameLocation[] = renames?.map((r) => {
    return {
      ...r,
      original: "sub",
      to: "sub_renamed",
    };
  })!;

  if (!renameItems) throw new Error("unexpected");

  const state = getRenamedFileChanges(
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
