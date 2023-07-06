import "../__tests/globals";
import { test, expect } from "vitest";
import { createOneshotTestProgram } from "../__tests/testHarness";
import { createGetSymbolWalker } from "./symbolWalker";

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
  const symbolSet = new Set(visited.visitedSymbols.map((s) => s.name));
  const typeSet = new Set(visited.visitedTypes.map((t) => checker.typeToString(t)));
  // console.log(symbolSet);
  expect(symbolSet).toEqual(
    new Set(["f", "arg", "v", "o", "p", "o2", "ClassInternal", "C", "ci", "iv", "instance", "prototype"]),
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
      "ClassInternal",
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
  const symbolSet = new Set(visited.visitedSymbols.map((s) => s.name));
  const typeSet = new Set(visited.visitedTypes.map((t) => checker.typeToString(t)));
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
  const symbolSet = new Set(visited.visitedSymbols.map((s) => s.name));
  const typeSet = new Set(visited.visitedTypes.map((t) => checker.typeToString(t)));
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
  const symbolSet = new Set(visited.visitedSymbols.map((s) => s.name));
  const typeSet = new Set(visited.visitedTypes.map((t) => checker.typeToString(t)));
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
  const symbolSet = new Set(visited.visitedSymbols.map((s) => s.name));
  const typeSet = new Set(visited.visitedTypes.map((t) => checker.typeToString(t)));

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
