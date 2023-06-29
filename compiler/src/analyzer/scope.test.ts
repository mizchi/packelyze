import {expect, test} from "vitest";
import { createOneshotTestProgram } from "../testHarness";
import { analyzeScope, findAcendantLocals, getClosestBlock, getGlobalsFromFile, getLocalBindings, getLocals, getLocalsInScope } from "./scope";
import { getNodeAtPosition } from "../nodeUtils";
import ts from "typescript";

// check module spec

module M1 {
  const x = 1;
  export const y = 2;
}
{
  if (false as any) {
    // @ts-expect-error
    M1.x;
    M1.y;
  }
}

declare module M2 {
  const x = 1;
  export const y = 2;
}  
if (false as any) {
  M2.x;
  M2.y;
}

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

  const expected = new Set(
    [
      "X", "Y", "Z", "x", "y", "z", "a", "b", "c", "d", "f", "param", "Nested", "nested", "deep", "cf", "deepf", "i", "j", "k", "M",
      "Component", "p", "q"
    ]
  );
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

  expect([...result.locals].map(t=>t.name)).toEqual(["f", "x", "y"]);
  // expect([...result.children[0].locals].map(t => t.name)).toEqual(["internalFunc", "f_internal", "arguments"]);
  expect([...result.children[0].locals].map(t => t.name)).toEqual(["arg", "internalFunc", "f_internal", "arguments"]);

  expect([...result.children[0].children[0].locals].map(t => t.name)).toEqual(["f2", "iif"]);
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
  expect([...result2.locals].map(x => x.name)).toEqual(["x", "y"]);
  expect([...result2.children[0].locals].map(x => x.name)).toEqual(["blocked"]);
  expect([...result2.children[0].children[0].locals].map(x => x.name)).toEqual(["v1"]);
  expect([...result2.children[0].children[1].locals].map(x => x.name)).toEqual(["v2"]);
  expect([...result2.children[1].locals].map(x => x.name)).toEqual(["exprBlock"]);
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
  const globals = getGlobalsFromFile(checker, file);
  const target = getNodeAtPosition(file, pos)!;

  const node = getClosestBlock(target.parent);
  const parent = getClosestBlock(node);
  expect(ts.isBlock(node)).toBe(true);
  expect(node.kind).toBe(ts.SyntaxKind.Block);
  const parentLocals = getLocals(checker, parent);
  const locals = getLocalsInScope(checker, globals, node);

  const parentLocalNames = new Set([...parentLocals].map(s => s.name));
  expect(parentLocalNames.has("v0")).toBe(true);
  expect(parentLocalNames.has("v1")).toBe(true);
  expect(parentLocalNames.has("v2")).toBe(false);
  expect([...locals].map(s => s.name)).toEqual(["v2"]);

  const ascendantLocals = findAcendantLocals(checker, node as ts.Block);
  expect([...ascendantLocals].map(s => s.name)).toEqual([
    'v3', 'v4', 'v5', 'v6', 'v8', 'v7'
  ]);
});
