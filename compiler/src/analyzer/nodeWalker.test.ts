import { test, expect } from "vitest";
import { createOneshotTestProgram } from "../__tests/testHarness";
import { createGetSymbolWalker } from "./symbolWalker";
import ts from "typescript";
import { findDeclarationsFromSymbolWalkerVisited } from "./nodeWalker";

test("nodeWalker", () => {
  const { checker, file } = createOneshotTestProgram(`
  type Hidden = {
    __hidden: number;
  }
  type LocalRef = {
    local: number;
  }
  export type MyType = {
    ref: LocalRef,
    f1(): void;
    f2(): { fx: 1 }
  };
  export const myValue: MyType = { ref: { local: 1 }, f1() {}, f2() { return { fx: 1 } } };
`);
  const walker = createGetSymbolWalker(checker)();
  const symbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const symbol of symbols) {
    walker.walkSymbol(symbol);
  }
  const visited = walker.getVisited();
  const collected = findDeclarationsFromSymbolWalkerVisited(visited);
  expect(
    [...collected].map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + node.getText();
    }),
  ).toEqual([
    `(TypeAliasDeclaration)export type MyType = {
    ref: LocalRef,
    f1(): void;
    f2(): { fx: 1 }
  };`,
    `(TypeLiteral){
    ref: LocalRef,
    f1(): void;
    f2(): { fx: 1 }
  }`,
    "(PropertySignature)ref: LocalRef,",
    "(TypeReference)LocalRef",
    "(MethodSignature)f1(): void;",
    "(MethodSignature)f2(): { fx: 1 }",
    "(PropertySignature)local: number;",
    "(NumberKeyword)number",
    "(PropertySignature)fx: 1",
    "(LiteralType)1",
  ]);
  //   "(PropertySignature)ref: LocalRef,",
  //   "(TypeReference)LocalRef",
  //   "(PropertySignature)local: number;",
  //   "(NumberKeyword)number",
  //   "(MethodSignature)f1(): void;",
  //   "(MethodSignature)f2(): { fx: 1 }",
  //   "(PropertySignature)fx: 1",
  //   "(LiteralType)1",
  // ]);
});
