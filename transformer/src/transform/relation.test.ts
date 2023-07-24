import { expect, test } from "vitest";
import { createOneshotTestProgram } from "../../test/testHarness";
import { visitedToNodes, findBindingsInFile } from "./relation";
import { createGetSymbolWalker } from "../ts/symbolWalker";
import ts from "typescript";
import { formatCode, isInferredNode, toReadableNode, toReadableType } from "../ts/tsUtils";

test("findFileBindings # complex", () => {
  const { file, checker } = createOneshotTestProgram(`
  interface X {
    x: number;
  }
  type Y = {
    y: number;
  }
  class Z {
    z: number;
    cf() {}
  }
  const x = 1;
  let y = 2, z = 3;
  const [a, b, c: d] = [1, 2, 3];
  const { i, j: k } = { i: 1, j: 2 };
  function f(param: number) {
    return param;
  }
  function Component({ p: q = 1 }, { p: number } ) {
  }
  type Nested = {
    nested: {
      x: number;
      deep: {
        y: number;
        deepf(): void;
      }
    }
  }
  module M {}
  `);
  const idents = findBindingsInFile(file);

  const expected = new Set([
    "X",
    "Y",
    "Z",
    "x",
    "y",
    "z",
    "a",
    "b",
    "c",
    "d",
    "f",
    "param",
    "Nested",
    "nested",
    "deep",
    "cf",
    "deepf",
    "i",
    "j",
    "k",
    "M",
    "Component",
    "p",
    "q",
  ]);
  for (const ident of idents) {
    expect(expected).includes(ident.getText());
  }
});

test("findFileBindings # PropertyAssignment", () => {
  const { file, checker } = createOneshotTestProgram(`
  const obj = {
    foo: 1,
    nested: {
      bar: 2
    }
  };
  `);
  const bindings = findBindingsInFile(file);
  const expected = new Set(["obj", "foo", "nested", "bar"]);
  for (const ident of bindings) {
    expect(expected).includes(ident.getText());
  }
});

test("findRootRelatedNodes # export", () => {
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
  const result = findRootRelatedNodesForTest(checker, file);
  expect(result.nodes).toEqual([
    { kind: `TypeAliasDeclaration`, text: `export type MyType = { ref: LocalRef, f1(): void; f2(): { fx: 1 } };` },
    { kind: `TypeLiteral`, text: `{ ref: LocalRef, f1(): void; f2(): { fx: 1 } }` },
    { kind: `PropertySignature`, text: `ref: LocalRef,` },
    { kind: `TypeReference`, text: `LocalRef` },
    { kind: `MethodSignature`, text: `f1(): void;` },
    { kind: `MethodSignature`, text: `f2(): { fx: 1 }` },
    { kind: `TypeLiteral`, text: `{ local: number; }` },
    { kind: `PropertySignature`, text: `local: number;` },
    { kind: `NumberKeyword`, text: `number` },
    { kind: `PropertySignature`, text: `fx: 1` },
    { kind: `LiteralType`, text: `1` },
    { kind: `TypeLiteral`, text: `{ fx: 1 }` },
  ]);
});

test("findRootRelatedNodes # union", () => {
  const { checker, file } = createOneshotTestProgram(`
  type A = {
    aaa: number;
  };
  type B = {
    bbb: number;
  }
  export type T = {
    union: A | B;
    intersection: A & B;
  };
`);
  const result = findRootRelatedNodesForTest(checker, file);
  expect(result.nodes).toEqual([
    {
      kind: "TypeAliasDeclaration",
      text: "export type T = { union: A | B; intersection: A & B; };",
    },
    {
      kind: "TypeLiteral",
      text: "{ union: A | B; intersection: A & B; }",
    },
    { kind: "PropertySignature", text: "union: A | B;" },
    { kind: "UnionType", text: "A | B" },
    { kind: "TypeReference", text: "A" },
    { kind: "TypeReference", text: "B" },
    { kind: "PropertySignature", text: "intersection: A & B;" },
    { kind: "IntersectionType", text: "A & B" },
    { kind: "TypeReference", text: "A" },
    { kind: "TypeReference", text: "B" },
  ]);
});

test("findRootRelatedNodes # as casting", () => {
  const { checker, file } = createOneshotTestProgram(`
  type A = {
    aaa: number;
  };
  type B = {
    bbb: number;
  }
  export const a = {
    aaa: 1
  } as A
`);
  const result = findRootRelatedNodesForTest(checker, file);
  expect(result.nodes).toEqual([
    { kind: "TypeLiteral", text: "{ aaa: number; }" },
    { kind: "PropertySignature", text: "aaa: number;" },
    { kind: "NumberKeyword", text: "number" },
  ]);
});

test("findRootRelatedNodes # class", () => {
  const { checker, file } = createOneshotTestProgram(`
  interface I {
    f1(): number;
  }
  export class X implements I {
    f1() {
      return 1;
    }
  }
  `);
  const result = findRootRelatedNodesForTest(checker, file);
  expect(result.nodes).toEqual([
    { kind: "ClassDeclaration", text: "export class X implements I { f1() { return 1; } }" },
    { kind: "MethodDeclaration", text: "f1() { return 1; }" },
    { kind: "InterfaceDeclaration", text: "interface I { f1(): number; }" },
    { kind: "MethodSignature", text: "f1(): number;" },
  ]);
});

test("findRootRelatedNodes # infer", () => {
  const { checker, file } = createOneshotTestProgram(`
  const hidden = {
    __hidden: 1,
    __hidden: 2,
  };
  export const obj = {
    foo: 1,
    nested: {
      bar: 2
    }
  };
`);

  const result = findRootRelatedNodesForTest(checker, file);
  expect(result.nodes).toEqual([
    {
      kind: "ObjectLiteralExpression",
      text: "{ foo: 1, nested: { bar: 2 } }",
    },
    {
      kind: "PropertyAssignment",
      text: "foo: 1",
    },
    {
      kind: "PropertyAssignment",
      text: "nested: { bar: 2 }",
    },
    {
      kind: "ObjectLiteralExpression",
      text: "{ bar: 2 }",
    },
    {
      kind: "PropertyAssignment",
      text: "bar: 2",
    },
  ]);
});

test("detect mangle nodes", () => {
  const { checker, file } = createOneshotTestProgram(`
  type A = {
    av: number;
  };
  export const obj = {
    foo: 1,
    nested: {
      bar: 2
    },
    a: {
      av: 1
    } as A
  };
  `);

  const walker = createGetSymbolWalker(checker)();
  const symbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const symbol of symbols) {
    walker.walkSymbol(symbol);
  }
  const visited = walker.getVisited();
  const nodes = visitedToNodes(checker, visited);
  // const result = findRootRelatedNodesForTest(checker, file);
  const result = nodes.map((node) => {
    return {
      kind: ts.SyntaxKind[node.kind],
      text: formatCode(node.getText()),
    };
  });
  expect(result).toEqual([
    {
      kind: "ObjectLiteralExpression",
      text: "{ foo: 1, nested: { bar: 2 }, a: { av: 1 } as A }",
    },
    { kind: "PropertyAssignment", text: "foo: 1" },
    { kind: "PropertyAssignment", text: "nested: { bar: 2 }" },
    { kind: "PropertyAssignment", text: "a: { av: 1 } as A" },
    { kind: "ObjectLiteralExpression", text: "{ bar: 2 }" },
    { kind: "PropertyAssignment", text: "bar: 2" },
    { kind: "TypeLiteral", text: "{ av: number; }" },
    { kind: "PropertySignature", text: "av: number;" },
    { kind: "NumberKeyword", text: "number" },
  ]);
  // console.log(
  //   nodes.map((node) => {
  //     const type = checker.getTypeAtLocation(node);
  //     return {
  //       kind: ts.SyntaxKind[node.kind],
  //       typeName: checker.typeToString(type),
  //       symbolName: type.symbol?.name,
  //       inferred: isInferredNode(checker, node),
  //     };
  //   }),
  // );
  expect(
    nodes.map((node) => {
      const type = checker.getTypeAtLocation(node);
      return {
        typeName: checker.typeToString(type),
        symbolName: type.symbol?.name,
        inferred: isInferredNode(checker, node),
      };
    }),
  ).toEqual([
    {
      typeName: "{ foo: number; nested: { bar: number; }; a: A; }",
      symbolName: "__object",
      inferred: true,
    },
    { typeName: "number", symbolName: undefined, inferred: false },
    {
      typeName: "{ bar: number; }",
      symbolName: "__object",
      inferred: false,
    },
    { typeName: "A", symbolName: "__type", inferred: false },
    {
      typeName: "{ bar: number; }",
      symbolName: "__object",
      inferred: true,
    },
    { typeName: "number", symbolName: undefined, inferred: false },
    { typeName: "A", symbolName: "__type", inferred: false },
    { typeName: "number", symbolName: undefined, inferred: false },
    { typeName: "number", symbolName: undefined, inferred: false },
  ]);
});

function findRootRelatedNodesForTest(checker: ts.TypeChecker, root: ts.SourceFile) {
  const walker = createGetSymbolWalker(checker)();
  const symbols = checker.getExportsOfModule(checker.getSymbolAtLocation(root)!);
  for (const symbol of symbols) {
    walker.walkSymbol(symbol);
  }
  const visited = walker.getVisited();
  const nodes = visitedToNodes(checker, visited);
  return {
    nodes: nodes.map((node) => {
      return {
        kind: ts.SyntaxKind[node.kind],
        text: formatCode(node.getText()),
      };
    }),
  };
}
