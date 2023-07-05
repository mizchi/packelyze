import "../__vitestUtils";
import { expect, test } from "vitest";

import { createOneshotTestProgram, createTestLanguageService } from "../testHarness";
import {
  analyzeScope,
  findAcendantLocals,
  findPrimaryNodes as findPrimaryAccesses,
  getClosestBlock,
  getExplicitGlobals,
  getLocalBindings,
  getLocals,
  getLocalsInScope,
  getAllowedPureAccesses as getAllowedPureAccesses,
  getUnscopedAccesses,
  isScopedAccessOnly,
  getAccessesFromExpression,
} from "./scope";
import { findClosestBlock, getNodeAtPosition } from "../nodeUtils";
import ts from "typescript";

test("find all declarations", () => {
  const { program, file } = createOneshotTestProgram(`
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
  // const checker = program.getTypeChecker();

  const idents = getLocalBindings(file);

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
  // expect(expected).includes
  for (const ident of idents) {
    expect(expected).includes(ident.getText());
  }
});

test("scoped variables", () => {
  const { program, file } = createOneshotTestProgram(`
  export const x = 1;
  const y = 1;
  function f(arg: number) {
    const f_internal = 2;
    return;
    function internalFunc() {
      const iif = 1;
      function f2() {}
    }
  }
`);

  const checker = program.getTypeChecker();
  const result = analyzeScope(checker, file);

  expect([...result.locals].map((t) => t.name)).toEqualSet(["f", "x", "y"]);
  // expect([...result.children[0].locals].map(t => t.name)).toEqualSet(["internalFunc", "f_internal", "arguments"]);
  expect([...result.children[0].locals].map((t) => t.name)).toEqualSet([
    "arg",
    "internalFunc",
    "f_internal",
    "arguments",
  ]);
  expect([...result.children[0].children[0].locals].map((t) => t.name)).toEqualSet(["f2", "iif"]);
});

test("scoped variables: block", () => {
  const { program, file } = createOneshotTestProgram(`
  export const x = 1;
  const y = 1;
  {
    const blocked = 1;
    {
      const v1 = 1;
    }
    {
      const v2 = 1;
    }
  }
  (() => {
    const exprBlock = 2;
  })();
  `);

  const checker = program.getTypeChecker();

  const result2 = analyzeScope(checker, file);
  expect([...result2.locals].map((x) => x.name)).toEqualSet(["x", "y"]);
  expect([...result2.children[0].locals].map((x) => x.name)).toEqualSet(["blocked"]);
  expect([...result2.children[0].children[0].locals].map((x) => x.name)).toEqualSet(["v1"]);
  expect([...result2.children[0].children[1].locals].map((x) => x.name)).toEqualSet(["v2"]);
  expect([...result2.children[1].locals].map((x) => x.name)).toEqualSet(["exprBlock"]);
});

test("scoped variables: block", () => {
  const { program, file } = createOneshotTestProgram(`
  export const v0 = 1;
  {
    const v1 = 1;
    {
      const v2 = 1;
      {
        const v3 = 1;
        {
          const v4 = 1;
        }
        {
          const v5 = 1;
        }
        (() => {
          const v6 = 1;
        })();

        for (const v7 of []) {
          const v8 = 1;
        }
      }
    }
  }
  `);

  const checker = program.getTypeChecker();
  const pos = file.getText().search("v2");
  const globals = new Set(getExplicitGlobals(checker, file));
  const target = getNodeAtPosition(file, pos)!;

  const node = getClosestBlock(target.parent);
  const parent = getClosestBlock(node);
  expect(ts.isBlock(node)).toBe(true);
  expect(node.kind).toBe(ts.SyntaxKind.Block);
  const parentLocals = getLocals(checker, parent);
  const locals = getLocalsInScope(checker, globals, node);

  const parentLocalNames = new Set([...parentLocals].map((s) => s.name));
  expect(parentLocalNames.has("v0")).toBe(true);
  expect(parentLocalNames.has("v1")).toBe(true);
  expect(parentLocalNames.has("v2")).toBe(false);
  expect([...locals].map((s) => s.name)).toEqualSet(["v2"]);

  const ascendantLocals = findAcendantLocals(checker, node as ts.Block);
  expect([...ascendantLocals].map((s) => s.name)).toEqualSet(["v3", "v4", "v5", "v6", "v8", "v7"]);
});

test("scoped variables: shadowed", () => {
  const { program, file } = createOneshotTestProgram(`
  export const x = 1;
  const v = 1;
  {
    const v = 1;
    const w = 1;
  }
`);

  const checker = program.getTypeChecker();
  const result = analyzeScope(checker, file);
  expect([...result.locals].map((x) => x.name)).toEqualSet(["x", "v"]);
  // expect([...result.children[0].locals].map((x) => x.name)).toEqualSet(["v", "w"]);
});

test("scoped variables: accessing outer refs", () => {
  const { service, normalizePath } = createTestLanguageService();
  const code = `
  export const x = 1;
  declare const MyGlobal = {
    vvv: 1;
  }

  const top = 1;
  export function impure(arg: number) {
    const local = 1;
    const {xv} = {xv: 1};
    console.log(Object.keys({x: 1}));
    MyGlobal.vvv = top;
    return 1;
  }

  export function pure(arg: number) {
    const pureLocal = 1;
    return pureLocal;
  }
`;
  service.writeSnapshotContent(normalizePath("src/index.ts"), code);

  const program = service.getProgram()!;
  const checker = program.getTypeChecker();
  const file = program.getSourceFile(normalizePath("src/index.ts"))!;

  {
    // check impure func
    const symbol = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!).find((x) => x.name === "impure")!;
    expect(symbol.name).toBe("impure");
    const funcBody = (symbol.valueDeclaration as ts.FunctionDeclaration).body!;
    const primaries = findPrimaryAccesses(funcBody);
    // console.log([...primaries].map((x) => x.text));
    expect([...primaries].map((x) => x.text)).toEqualSet([
      "local",
      "xv",
      "xv",
      "console",
      "Object",
      "x",
      "MyGlobal",
      "top",
    ]);
    const accesses = getUnscopedAccesses(checker, funcBody);
    expect([...accesses].map((x) => x.name)).toEqualSet(["console", "MyGlobal", "top"]);
  }
  {
    // check pure func
    const pureSymbol = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!).find((x) => x.name === "pure")!;
    const block = (pureSymbol.valueDeclaration as ts.FunctionDeclaration).body!;
    expect(getUnscopedAccesses(checker, block).size).toBe(0);
  }
});

test("getUnscopedAccesses", () => {
  // const
  const { program, file, checker } = createOneshotTestProgram(`
  const outer = 1;
  export function f() {
    return outer;
  }
  export const v = f() > outer;
  `);

  const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  const pureSymbol = exports.find((x) => x.name === "f")!;
  const block = (pureSymbol.valueDeclaration as ts.FunctionDeclaration).body!;
  // expect(getUnscopedAccesses(checker, block).size).toBe(1);
  const primaries = findPrimaryAccesses(block);
  // console.log([...primaries].map((x) => x.text));
  expect([...primaries].map((x) => x.text)).toEqualSet(["outer"]);

  {
    // find expression
    const symbol = exports.find((x) => x.name === "v")!;
    const block = findClosestBlock(symbol.valueDeclaration as ts.VariableDeclaration);
    const primaries = findPrimaryAccesses(block, (symbol.valueDeclaration as ts.VariableDeclaration).initializer!);
    expect([...primaries].map((x) => x.text)).toEqualSet(["f", "outer"]);

    const accesses = getAccessesFromExpression(
      checker,
      (symbol.valueDeclaration as ts.VariableDeclaration).initializer!,
    );
    expect([...accesses].map((x) => x.name)).toEqualSet(["f", "outer"]);
  }
  // const checker = program.getTypeChecker();
});

test("getExpilictGlobals", () => {
  const { service, normalizePath, projectPath } = createTestLanguageService();
  const envDts = `
  declare const MyGlobal: {
    vvv: number;
  };
  declare module MyMod {
    export const vvv: number;
  }
  `;

  service.writeSnapshotContent(normalizePath("src/env.d.ts"), envDts);

  const code = `export const v = MyGlobal.vvv;`;
  service.writeSnapshotContent(normalizePath("src/index.ts"), code);

  const program = service.getProgram()!;
  const checker = program.getTypeChecker();
  const indexFile = program.getSourceFile(normalizePath("src/index.ts"))!;
  const explicitGlobals = getExplicitGlobals(checker, indexFile);
  const names = new Set(explicitGlobals.map((s) => s.name));
  // console.log(names);
  // not v
  expect(names.has("v")).toBe(false);

  // from env.d.ts
  expect(names.has("MyGlobal")).toBe(true);
  // expect(names.has("MyMod")).toBe(true);

  // node/globals.d.ts
  expect(names.has("process")).toBe(true);
  expect(names.has("eval")).toBe(true);

  expect(names.has("console")).toBe(true);
  // lib
  expect(names.has("console")).toBe(true);
  expect(names.has("TextEncoder")).toBe(true);
});
