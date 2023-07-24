import { test, expect } from "vitest";
import { createOneshotTestProgram, initTestLanguageServiceWithFiles } from "../../test/testHarness";
import { createGetSymbolWalker } from "../ts/symbolWalker";
import ts from "typescript";
import { findExportRelationsOnProject } from "./relation";
import { getEffectDetectorWalker } from "./effects";
import { composeWalkers, formatCode } from "../ts/tsUtils";

export function findEffectNodes(checker: ts.TypeChecker, node: ts.Node) {
  const nodes = new Set<ts.Node>();
  const enter = getEffectDetectorWalker(checker, (node) => {
    nodes.add(node);
  });
  const composed = composeWalkers(enter);
  composed(node);
  return nodes;
}

test("effect with builtins", () => {
  const { checker, file } = createOneshotTestProgram(`
  type Ref1 = { local: number };
  const ref1: Ref1 = { local: 1 };
  const x = JSON.stringify(ref1);
  type Ref2 = {
    xxx: {
      yyy: number
    }
  };
  const ref2: Ref2  = { xxx: {yyy: 1} };
  const y = JSON.stringify(ref2.xxx);
  export {}
`);

  const walker = createGetSymbolWalker(checker)();
  const nodes = findEffectNodes(checker, file);
  for (const node of nodes) {
    const symbol = checker.getSymbolAtLocation(node);
    if (symbol) {
      walker.walkSymbol(symbol);
      const type = checker.getTypeOfSymbolAtLocation(symbol, node);
      walker.walkType(type);
    }
  }
  const visited = walker.getVisited();

  const collected = findExportRelationsOnProject(checker, visited);
  expect(
    [...collected].map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + formatCode(node.getText());
    }),
  ).toEqual([
    //
    "(TypeLiteral){ local: number }",
    "(PropertySignature)local: number",
    "(NumberKeyword)number",
    "(PropertySignature)yyy: number",
    "(NumberKeyword)number",
    "(TypeLiteral){ yyy: number }",
  ]);
});

test("effect to global assign", () => {
  const { service } = initTestLanguageServiceWithFiles({
    "src/env.d.ts": `
    declare const MyGlobal: {
      myValue: {
        x: number;
      };
    };
    `,
    "src/index.ts": `
  type Value = {
    x: number;
  };
  const t: Value = { x: 1 };
  MyGlobal.myValue = t;
`,
  });
  const checker = service.getProgram()!.getTypeChecker();
  const file = service.getProgram()!.getSourceFile("src/index.ts")!;

  const walker = createGetSymbolWalker(checker)();
  const nodes = findEffectNodes(checker, file);
  for (const node of nodes) {
    const symbol = checker.getSymbolAtLocation(node);
    if (symbol) {
      walker.walkSymbol(symbol);
      const type = checker.getTypeOfSymbolAtLocation(symbol, node);
      walker.walkType(type);
    }
  }
  const visited = walker.getVisited();

  const collected = findExportRelationsOnProject(checker, visited);
  expect(
    [...collected].map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + formatCode(node.getText());
    }),
  ).toEqual([
    //
    `(TypeLiteral){ x: number; }`,
    "(PropertySignature)x: number;",
    "(NumberKeyword)number",
  ]);
});

test("detect object rest spread", () => {
  const { service } = initTestLanguageServiceWithFiles({
    "src/index.ts": `
  type Foo = {
    x: number;
    y: number;
  }
  type Bar = {
    x: number;
  }
  const bar: Bar = {
    x: 1
  };
  export const foo: Foo = {
      ...bar,
      y: 2
  };
    `,
  });
  const checker = service.getProgram()!.getTypeChecker();
  const file = service.getProgram()!.getSourceFile("src/index.ts")!;

  const walker = createGetSymbolWalker(checker)();
  const nodes = findEffectNodes(checker, file);
  expect(nodes.size).toEqual(1);
  // console.log("nodes", nodes.size);
  for (const node of nodes) {
    const symbol = checker.getSymbolAtLocation(node);
    if (symbol) {
      walker.walkSymbol(symbol);
      const type = checker.getTypeOfSymbolAtLocation(symbol, node);
      walker.walkType(type);
    }
  }
  const visited = walker.getVisited();
  const collected = findExportRelationsOnProject(checker, visited);
  expect(
    [...collected].map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + formatCode(node.getText());
    }),
  ).toEqual(["(TypeLiteral){ x: number; }", "(PropertySignature)x: number;", "(NumberKeyword)number"]);
});
