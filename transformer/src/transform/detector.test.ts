import { test, expect } from "vitest";
import { createOneshotTestProgram, initTestLanguageServiceWithFiles } from "../../test/testHarness";
import ts from "typescript";
import { getEffectDetectorWalker } from "./detector";
import { composeWalkers, formatCode } from "../ts/tsUtils";
import { getExportedInProject } from "./mangler";

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

  const visited = getExportedInProject(checker, [file], [file]);
  expect(
    visited.nodes.map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + formatCode(node.getText());
    }),
  ).toEqual([
    //
    "(VariableDeclaration)ref1: Ref1 = { local: 1 }",
    "(TypeLiteral){ local: number }",
    "(PropertySignature)local: number",
    "(NumberKeyword)number",
    "(TypeLiteral){ yyy: number }",
    "(PropertySignature)yyy: number",
    "(NumberKeyword)number",
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
  const visited = getExportedInProject(checker, [file], [file]);
  expect(
    visited.nodes.map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + formatCode(node.getText());
    }),
  ).toEqual([
    //
    "(VariableDeclaration)t: Value = { x: 1 }",
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

  const visited = getExportedInProject(checker, [file], [file]);
  expect(
    visited.nodes.map((node) => {
      return "(" + ts.SyntaxKind[node.kind] + ")" + formatCode(node.getText());
    }),
  ).toEqual([
    "(VariableDeclaration)foo: Foo = { ...bar, y: 2 }",
    "(TypeLiteral){ x: number; y: number; }",
    "(PropertySignature)x: number;",
    "(NumberKeyword)number",
    "(PropertySignature)y: number;",
    "(NumberKeyword)number",
    "(VariableDeclaration)bar: Bar = { x: 1 }",
    "(TypeLiteral){ x: number; }",
    "(PropertySignature)x: number;",
    "(NumberKeyword)number",
  ]);
});
