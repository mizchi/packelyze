import ts from "typescript";
import { expect, test } from "vitest";
import { createOneshotTestProgram } from "../../test/testHarness";
import { createGetSymbolWalker } from "./symbolWalker";
import {
  getFirstNodeFromMatcher,
  isTypeInferredFromValueDeclaration,
  toReadableNode,
  toReadableSymbol,
  toReadableType,
} from "./tsUtils";

test("infer # 1", () => {
  const { program, file } = createOneshotTestProgram(`
  type X = {
    v: number;
  }
  export const x1 = { v: 1 };
  export const x2: X = { v: 2 };
  export const x3 = x1.v;
  export const x4 = x2.v;
  `);

  const checker = program.getTypeChecker();
  const matched = getFirstNodeFromMatcher(file, /\{ v: 1/)!;
  expect(matched.kind).toBe(ts.SyntaxKind.ObjectLiteralExpression);
  const symbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  expect(symbols.length).toBe(4);
  const x0s = symbols[0];
  const x0t = checker.getTypeAtLocation(x0s.valueDeclaration!);
  expect(x0t.symbol?.name).toBe("__object");

  const x1s = symbols[1];
  const x1t = checker.getTypeAtLocation(x1s.valueDeclaration!);
  expect(x1t.aliasSymbol?.name).toBe("X");

  const x2s = symbols[2];
  const x2t = checker.getTypeAtLocation(x2s.valueDeclaration!);
  expect(checker.typeToString(x2t)).toBe("number");
  const x3s = symbols[3];
  const x3t = checker.getTypeAtLocation(x3s.valueDeclaration!);
  expect(checker.typeToString(x3t)).toBe("number");
});

test("infer # 2", () => {
  const { program, file } = createOneshotTestProgram(`
  type X = {
    value: {
      v: number;
    }
  }
  export const x1: X = { value: { v: 1 } };
  export const x2 = { value: { v: 2 } };
  `);

  const checker = program.getTypeChecker();
  const symbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  {
    // typed
    const x0s = symbols[0];
    const x0t = checker.getTypeAtLocation(x0s.valueDeclaration!);
    expect(x0t.symbol?.name).toBe("__type");
    const walker = createGetSymbolWalker(checker)();
    walker.walkType(x0t);
    const visited = walker.getVisited();
    expect(
      visited.types.map((t) => {
        const symbol = t.symbol;
        return `${symbol?.name ?? "unknown"}:${checker.typeToString(t)}`;
      }),
    ).toEqual(["unknown:any", "unknown:number", "__type:X", "__type:{ v: number; }"]);
  }
  {
    const x1s = symbols[1];
    const x1t = checker.getTypeAtLocation(x1s.valueDeclaration!);
    const walker1 = createGetSymbolWalker(checker)();
    walker1.walkType(x1t);
    const visited = walker1.getVisited();
    expect(
      visited.types.map((t) => {
        const symbol = t.symbol;
        return `${symbol?.name ?? "unknown"}:${checker.typeToString(t)}`;
      }),
    ).toEqual([
      // types
      "unknown:any",
      "unknown:number",
      "__object:{ v: number; }",
      "__object:{ value: { v: number; }; }",
    ]);
  }
});

test("infer # with typed value", () => {
  const { program, file } = createOneshotTestProgram(`
  type X = {
    value: {
      v: number;
    }
  }
  const val: X['value'] = { v: 1 }
  export const x1: X = { value: val };
  export const x2 = { value: val };
  `);

  const checker = program.getTypeChecker();
  const symbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  {
    // typed
    const x0s = symbols[0];
    const x0t = checker.getTypeAtLocation(x0s.valueDeclaration!);
    expect(x0t.symbol?.name).toBe("__type");
    const walker = createGetSymbolWalker(checker)();
    walker.walkType(x0t);
    const visited = walker.getVisited();
    expect(
      visited.types.map((t) => {
        const symbol = t.symbol;
        return `${symbol?.name ?? "unknown"}:${checker.typeToString(t)}`;
      }),
    ).toEqual([
      // types
      "unknown:any",
      "unknown:number",
      "__type:X",
      "__type:{ v: number; }",
    ]);
  }
  {
    const x1s = symbols[1];
    const x1t = checker.getTypeAtLocation(x1s.valueDeclaration!);
    // expect(x1t.symbol?.name).toBe("X");
    const walker1 = createGetSymbolWalker(checker)();
    walker1.walkType(x1t);
    const visited = walker1.getVisited();
    expect(
      visited.types.map((t) => {
        const symbol = t.symbol;
        return `${symbol?.name ?? "unknown"}:${checker.typeToString(t)}`;
      }),
    ).toEqual([
      // types
      "unknown:any",
      "__type:{ v: number; }",
      "__object:{ value: { v: number; }; }",
    ]);
  }
});

test("infer # 4 with inferred", () => {
  const { program, file } = createOneshotTestProgram(`
  type X = {
    value: {
      v: number;
    }
  }
  export function x1(): X {
    return { value: { v: 1 } };
  }
  export function x2() {
    return { value: { v: 2 } };
  }
  `);

  const checker = program.getTypeChecker();
  const symbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  {
    // typed
    const x0s = symbols[0];
    const x0t = checker.getTypeAtLocation(x0s.valueDeclaration!);
    const walker = createGetSymbolWalker(checker)();
    walker.walkType(x0t);
    const visited = walker.getVisited();
    // console.log(visited.types.map((t) => `${t.symbol?.name ?? "unknown"}:` + toReadableType(t).typeName));
    expect(
      visited.types.map((t) => {
        const symbol = t.symbol;
        return `${symbol?.name ?? "unknown"}:${checker.typeToString(t)}`;
      }),
    ).toEqual([
      // types
      "unknown:number",
      "x1:() => X",
      "__type:X",
      "__type:{ v: number; }",
    ]);
  }
  {
    // inferred
    const x1s = symbols[1];
    const x1t = checker.getTypeAtLocation(x1s.valueDeclaration!);
    const walker1 = createGetSymbolWalker(checker)();
    walker1.walkType(x1t);
    const visited = walker1.getVisited();
    expect(
      visited.types.map((t) => {
        const symbol = t.symbol;
        return `${symbol?.name ?? "unknown"}:${checker.typeToString(t)}`;
      }),
    ).toEqual([
      // types
      "unknown:any",
      "unknown:number",
      "x2:() => { value: { v: number; }; }",
      "__object:{ v: number; }",
      "__object:{ value: { v: number; }; }",
    ]);

    const t3 = visited.types[3];
    const t4 = visited.types[4];
    const t4_value_symbol = checker.getTypeOfSymbol(t4.getProperties()[0]!).symbol;
    expect(t4_value_symbol).toBe(t3.symbol);
  }
});

test.skip("infer # 5 traverse with infer", () => {
  const { program, file } = createOneshotTestProgram(`
  // type X = {
  //   value: {
  //     v: number;
  //   }
  // }
  // export function x1(): X {
  //   return { value: { v: 1 } };
  // }
  // export function x2() {
  //   return { value: { v: 2 } };
  // }

  // const v1 = x1().value;
  // const v2 = v1.v;
  // console.log(v2);

  // class C {
  //   foo() {
  //     return 1
  //   }
  // }

  // const c = new C();
  // c.foo();
  // c?.foo?.();
  // const arr = [1, 2, 3];
  // arr.map((v) => ({
  //   v,
  // }));

  // const arr2 = [1, 2, 3] as const;
  // const mapped = arr2.map((v) => {
  //   return { va: v };
  // });
  // console.log(mapped);

  const v: {
    a: number;
  } = {
    a: 1
  };
  const va = v.a;

  const o = {
    a: 1,
  };
  type O = typeof o;
  const iv: O = {
    a: 1,
  }
  `);

  const checker = program.getTypeChecker();
  const out = walkWithType(checker, file);
  // console.log(out);
});

function walkWithType(checker: ts.TypeChecker, root: ts.Node) {
  // let output = "";
  function walk(node: ts.Node) {
    ts.forEachChild(node, walk);
    if (ts.isExpression(node)) {
      const type = checker.getTypeAtLocation(node);
      console.log(
        "[" + ts.SyntaxKind[node.kind] + "]",
        {
          inferred: isTypeInferredFromValueDeclaration(type),
        },
        // isTypeInferredFromValueDeclaration(type),
        // isInferred,
        "\n" + "/* " + checker.typeToString(type) + " */\n" + node.getText(),
      );
    }
  }
  walk(root);
  // return output;
}
