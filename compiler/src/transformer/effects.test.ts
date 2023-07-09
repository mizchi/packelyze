import { test, expect } from "vitest";
import { createOneshotTestProgram, initTestLanguageServiceWithFiles } from "../__tests/testHarness";
import { createGetSymbolWalker } from "../analyzer/symbolWalker";
import ts from "typescript";
import { findSideEffectSymbols } from "./effects";
import { findDeclarationsFromSymbolWalkerVisited } from "./mangler";

test("effect", () => {
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
  const nodes = findSideEffectSymbols(checker, file);
  for (const node of nodes) {
    const symbol = checker.getSymbolAtLocation(node);
    if (symbol) {
      walker.walkSymbol(symbol);
      const type = checker.getTypeOfSymbolAtLocation(symbol, node);
      walker.walkType(type);
    }
  }
  const visited = walker.getVisited();

  const collected = findDeclarationsFromSymbolWalkerVisited(visited);
  expect(
    [...collected].map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + node.getText();
    }),
  ).toEqual([
    //
    "(PropertySignature)local: number",
    "(NumberKeyword)number",
    "(PropertySignature)yyy: number",
    "(NumberKeyword)number",
  ]);
});

test("effect", () => {
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
  const nodes = findSideEffectSymbols(checker, file);
  for (const node of nodes) {
    const symbol = checker.getSymbolAtLocation(node);
    if (symbol) {
      walker.walkSymbol(symbol);
      const type = checker.getTypeOfSymbolAtLocation(symbol, node);
      walker.walkType(type);
    }
  }
  const visited = walker.getVisited();

  const collected = findDeclarationsFromSymbolWalkerVisited(visited);
  expect(
    [...collected].map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + node.getText();
    }),
  ).toEqual([
    //
    "(PropertySignature)x: number;",
    "(NumberKeyword)number",
  ]);
});
