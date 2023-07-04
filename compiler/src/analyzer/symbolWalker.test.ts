import { test, expect } from "vitest";
import { createOneshotTestProgram } from "../testHarness";
import { createGetSymbolWalker } from "./symbolWalker";

test("originalSymbolWalker", () => {
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
  // console.log(typeSet);
  expect(symbolSet).toEqual(
    new Set(["f", "arg", "v", "o", "p", "o2", "ClassInternal", "C", "ci", "instance", "prototype"]),
  );
  expect(typeSet).toEqual(
    new Set(["any", "number", "(arg: number) => number", "{ p: number; }", "MyType", "typeof C", "C", "this"]),
  );
});

test("originalSymbolWalker # partial", () => {
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

test("originalSymbolWalker # function internal", () => {
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

test("originalSymbolWalker # function internal partial", () => {
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
