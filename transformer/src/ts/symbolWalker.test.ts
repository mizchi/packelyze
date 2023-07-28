import "../../test/globals";
import { test, expect } from "vitest";
import { createOneshotTestProgram, createTestLanguageService } from "../../test/testHarness";
import { createGetSymbolWalker } from "./symbolWalker";
import { isSymbolInferredFromValueDeclaration } from "./tsUtils";
import path from "path";

test("symbolWalker", () => {
  const { checker, file } = createOneshotTestProgram(`
  type MyType = { p: number };
  export const v: number = 1;
  export const o: { p: number } = { p: 1 };
  export const o2: MyType = { p: 1 };
  export function f(arg: number) {
    return arg;
  }
  export type ClassInternal = {
    iv: number;
  }
  export class C {
    ci: ClassInternal = { iv: 1 };
  }
  export const instance = new C();
`);
  const getSymbolWalker = createGetSymbolWalker(checker);
  const symbolWalker = getSymbolWalker();

  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const exported of exportedSymbols) {
    symbolWalker.walkSymbol(exported);
  }

  const visited = symbolWalker.getVisited();
  const symbolSet = new Set(visited.symbols.map((s) => s.name));
  const typeSet = new Set(visited.types.map((t) => checker.typeToString(t)));
  // console.log(symbolSet);
  expect(symbolSet).toEqual(
    new Set(["f", "arg", "v", "o", "p", "o2", "ClassInternal", "C", "ci", "instance", "prototype"]),
  );
  // console.log(typeSet);
  expect(typeSet).toEqual(
    new Set([
      // xx
      "any",
      "number",
      "(arg: number) => number",
      "{ p: number; }",
      "MyType",
      "C",
      "this",
      "typeof C",
    ]),
  );
});

test("symbolWalker # partial", () => {
  const { checker, file } = createOneshotTestProgram(`
  type Partial = {
    fragment: {
      v: 1;
    }
  }

  export const v: Partial["fragment"] = { v: 1 };
`);
  const getSymbolWalker = createGetSymbolWalker(checker);
  const symbolWalker = getSymbolWalker();

  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const exported of exportedSymbols) {
    symbolWalker.walkSymbol(exported);
  }

  const visited = symbolWalker.getVisited();
  const symbolSet = new Set(visited.symbols.map((s) => s.name));
  const typeSet = new Set(visited.types.map((t) => checker.typeToString(t)));
  // console.log(symbolSet);
  // console.log(typeSet);
  expect(symbolSet).toEqual(
    new Set([
      // symbols
      "v",
    ]),
  );
  expect(typeSet).toEqual(
    new Set([
      // types
      "{ v: 1; }",
      "1",
    ]),
  );
});

test("symbolWalker # function internal", () => {
  const { checker, file } = createOneshotTestProgram(`
  function f() {
    type Internal = {
      v: number;
    }
    const v: Internal = { v: 1 };
    return v;
  }
  export const v = f();
`);
  const getSymbolWalker = createGetSymbolWalker(checker);
  const symbolWalker = getSymbolWalker();

  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const exported of exportedSymbols) {
    symbolWalker.walkSymbol(exported);
  }

  const visited = symbolWalker.getVisited();
  const symbolSet = new Set(visited.symbols.map((s) => s.name));
  const typeSet = new Set(visited.types.map((t) => checker.typeToString(t)));
  expect(symbolSet).toEqual(
    new Set([
      // symbols
      "v",
    ]),
  );
  expect(typeSet).toEqual(
    new Set([
      // types
      "number",
      "Internal",
    ]),
  );
});

test("symbolWalker # function internal partial", () => {
  const { checker, file } = createOneshotTestProgram(`
  function f() {
    type Internal = {
      partial: {
        v: number;
      }
    }
    const v: Internal = { partial: { v: 1 } };
    return v.partial;
  }
  export const v = f();
`);
  const getSymbolWalker = createGetSymbolWalker(checker);
  const symbolWalker = getSymbolWalker();

  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const exported of exportedSymbols) {
    symbolWalker.walkSymbol(exported);
  }

  const visited = symbolWalker.getVisited();
  const symbolSet = new Set(visited.symbols.map((s) => s.name));
  const typeSet = new Set(visited.types.map((t) => checker.typeToString(t)));
  expect(symbolSet).toEqual(
    new Set([
      // symbols
      "v",
    ]),
  );
  expect(typeSet).toEqual(
    new Set([
      // types
      "number",
      "{ v: number; }",
    ]),
  );
});

test("symbolWalker # typeArguments", () => {
  const { checker, file } = createOneshotTestProgram(`
    type X = {
      type: "X";
      payload: {
        d: string;
      };
    };
    function identify<T>(v: T): T {
      return v;
    }
    export const v = identify<X>({ type: "X", payload: { d: "D" } });
  `);
  const getSymbolWalker = createGetSymbolWalker(checker);
  const symbolWalker = getSymbolWalker();

  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const exported of exportedSymbols) {
    symbolWalker.walkSymbol(exported);
    // const type = checker.getTypeOfSymbol(exported);
    // console.log(
    //   "symbol",
    //   exported.name,
    //   // toReadableSymbol(exported),
    //   toReadableType(type),
    // );
  }

  const visited = symbolWalker.getVisited();
  const symbolSet = new Set(visited.symbols.map((s) => s.name));
  const typeSet = new Set(visited.types.map((t) => checker.typeToString(t)));

  // console.log(symbolSet);
  // console.log(
  //   typeSet,
  //   // visited.visitedTypes.map((t) => toReadableType(t)),
  //   visited.visitedTypes.map((t) => toReadableNode(t.symbol.declarations![0])),
  // );

  expect(symbolSet).toEqualSet(
    new Set([
      // symbols
      "v",
    ]),
  );
  expect(typeSet).toEqualSet(
    new Set([
      // types
      "X",
    ]),
  );
});

test("symbolWalker # class", () => {
  const { checker, file } = createOneshotTestProgram(`
  type MyType = {
    pubVal: {
      pub: number;
    };
    privVal: {
      pv: number;
    };
  };
  export class C {
    private v: MyType;
    static sv: number = 1;
    #hardPriv: number = 2;
    private static svp: number = 2;
    static sfoo() {
      return this.spfoo();
    }
    private static spfoo() {
      return this.svp;
    }
    constructor(v: number) {
      this.#hardPriv;
      this.v = { pubVal: { pub: v }, privVal: { pv: v + this.#hardPriv } };
    }
    foo() {
      return this.v.pubVal;
    }
    private priv() {
      return this.v.privVal;
    }
  }  
  `);
  const getSymbolWalker = createGetSymbolWalker(checker);
  const symbolWalker = getSymbolWalker();

  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const exported of exportedSymbols) {
    symbolWalker.walkSymbol(exported);
  }

  const visited = symbolWalker.getVisited();
  const symbolSet = new Set(visited.symbols.map((s) => s.name));
  const typeSet = new Set(visited.types.map((t) => checker.typeToString(t)));

  // console.log(symbolSet);
  // console.log(typeSet);

  expect(symbolSet).toEqualSet(
    new Set([
      // symbols
      "C",
      "v",
      "sv",
      // "svp",
      "sfoo",
      // "pubVal",
      // "privVal",
      "foo",
      // "priv",
      "pub",
      "prototype",
    ]),
  );
  expect(typeSet).toEqualSet(
    new Set([
      // types
      "number",
      "typeof C",
      "C",
      "this",
      // "MyType",
      "{ pub: number; }",
      // "{ priv: number; }",
      "() => number",
      "() => { pub: number; }",
      // "() => { priv: number; }",
    ]),
  );
});

test.skip("symbolWalker # tsx", () => {
  const projectPath = path.resolve(__dirname, "../../test/minimum-react");
  const { service } = createTestLanguageService(projectPath);
  service.writeSnapshotContent(
    "src/index.tsx",
    `
  export function MyComponent() {
    return <div>hello</div>;
  }
  `,
  );

  const checker = service.getProgram()!.getTypeChecker();
  const file = service.getProgram()!.getSourceFile("src/index.tsx")!;

  const getSymbolWalker = createGetSymbolWalker(checker);
  const symbolWalker = getSymbolWalker();

  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const exported of exportedSymbols) {
    symbolWalker.walkSymbol(exported);
  }

  const visited = symbolWalker.getVisited();
  const symbolSet = new Set(visited.symbols.map((s) => s.name));
  const typeSet = new Set(visited.types.map((t) => checker.typeToString(t)));

  const diagnostics = service.getSemanticDiagnostics("src/index.tsx");

  console.log(diagnostics);
  expect(diagnostics.length).toBe(0);

  console.log(symbolSet);
  // console.log(typeSet);
  // expect(symbolSet).toEqual(
  //   new Set([
  //     // symbols
  //     "v",
  //   ]),
  // );
  // expect(typeSet).toEqual(
  //   new Set([
  //     // types
  //     "number",
  //     "Internal",
  //   ]),
  // );
});

test("symbolWalker # infer", () => {
  const { checker, file } = createOneshotTestProgram(`
  const vvv = {
    aaa: 1,
  };
  export const yyy = vvv;

  type Z = {
    z: number;
  }
  export const zzz: Z = { z: 1 };
  `);
  const getSymbolWalker = createGetSymbolWalker(checker);
  const symbolWalker = getSymbolWalker();

  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  for (const exported of exportedSymbols) {
    symbolWalker.walkSymbol(exported);
  }

  const visited = symbolWalker.getVisited();
  const symbolSet = new Set(visited.symbols.map((s) => s.name));
  const typeSet = new Set(visited.types.map((t) => checker.typeToString(t)));

  expect(symbolSet).toEqualSet(
    new Set([
      // symbols
      "yyy",
      "zzz",
      "z",
      "__object",
      "aaa",
    ]),
  );
  expect(typeSet).toEqualSet(
    new Set([
      // types
      "any",
      "{ aaa: number; }",
      "number",
      "Z",
    ]),
  );

  {
    const ySymbol = exportedSymbols[0];
    expect(isSymbolInferredFromValueDeclaration(checker, ySymbol)).toBe(true);
    // const yType = checker.getTypeOfSymbol(ySymbol);
    // console.log("symbol(yyy)", toReadableSymbol(ySymbol));
    // console.log("type(yyy)", checker.typeToString(yType), toReadableType(yType));
    // console.log("isTypeInferredFromValueDeclaration(yyy)", isSymbolInferredFromValueDeclaration(checker, ySymbol));
  }
  {
    const zSymbol = exportedSymbols[1];
    expect(isSymbolInferredFromValueDeclaration(checker, zSymbol)).toBe(false);
    // const zType = checker.getTypeOfSymbol(zSymbol);
    // console.log("symbol(zzz)", toReadableSymbol(zSymbol));
    // console.log("type(zzz)", toReadableType(zType));
    // console.log("isTypeInferredFromValueDeclaration(yyy)", isSymbolInferredFromValueDeclaration(checker, zSymbol));
  }
});
