import ts from "typescript";
import { expect, test } from "vitest";
import { createTestLanguageService } from "./__tests/testHarness";
import { createVisitScoped, composeVisitors, findFirstNode, createVisitSignature } from "./nodeUtils";

// export type Tree = {
//   value: number;
//   children: Tree[];
// };

test("visitScopedIdentifierSymbols", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
export const exported = 1;
const local = 1;
function fff(arg) {}
{
  const nested = 2;

  class Class {
    v = 1;
    constructor () {
      const cstrInternal = 1;
    }
    method () {
      const internal = 1;
    }
  }
}
`,
  );
  const symbols: ts.Symbol[] = [];
  const visitScopedIdentifierSymbols = createVisitScoped(
    service.getProgram()!.getTypeChecker(),
    (symbol, parentBlock) => {
      symbols.push(symbol);
    },
  );
  const visit = composeVisitors(visitScopedIdentifierSymbols);
  visit(service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!);
  // console.log(symbols.map(s => s.name));
  expect(symbols.map((s) => s.name)).toEqual([
    "exported",
    "local",
    "fff",
    "arg",
    "nested",
    "Class",
    "v",
    "cstrInternal",
    "method",
    "internal",
  ]);
});

test("visitScoped: type alias signatrue", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
type T = {
  vvv: number;
  foo() {};
  // "str": number;
  // get bar(): number;
  // set bar(v: number);
}
    `,
  );
  const checker = service.getProgram()!.getTypeChecker();
  const symbols: ts.Symbol[] = [];
  // const sourceFile = service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!;
  const visitScoped = createVisitScoped(checker, (symbol, parentBlock) => {
    symbols.push(symbol);
  });

  const visitSignature = createVisitSignature(checker, (symbol, parentBlock) => {
    symbols.push(symbol);
  });

  const visit = composeVisitors(visitScoped, visitSignature);
  visit(service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!);

  expect(symbols.map((s) => s.name)).toEqual(["vvv", "foo"]);
});

test("visitScoped: enum", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
enum Enum {
  aaaa = 1,
  bbbb = 2,
  cccc,
}
    `,
  );
  const symbols: ts.Symbol[] = [];
  const visitScopedIdentifierSymbols = createVisitScoped(
    service.getProgram()!.getTypeChecker(),
    (symbol, parentBlock) => {
      symbols.push(symbol);
    },
  );
  composeVisitors(visitScopedIdentifierSymbols)(service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!);

  expect(symbols.map((s) => s.name)).toEqual(["Enum", "aaaa", "bbbb", "cccc"]);
});

test("visitScoped: class", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
class Class {
  vvv: number;
  foo(arg: number) {
    const local = 1;
  };
  consturctor() {
  }
}
    `,
  );
  const symbols: ts.Symbol[] = [];
  // const visitScopedIdentifierSymbols =
  composeVisitors(
    createVisitScoped(service.getProgram()!.getTypeChecker(), (symbol, parentBlock) => {
      symbols.push(symbol);
    }),
  )(service.getCurrentSourceFile(normalizePath("src/index.ts"))!);
  expect(symbols.map((s) => s.name)).toEqual(["Class", "vvv", "foo", "arg", "local", "consturctor"]);
});

test.skip("visitLocalIdentifierSymbols: object member", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
const localObj = {
  vvv: 1,
};
export const exportedObj = {
  foo: 1,
}
    `,
  );
  const symbols: ts.Symbol[] = [];
  composeVisitors(
    createVisitScoped(service.getProgram()!.getTypeChecker(), (symbol, parentBlock) => {
      symbols.push(symbol);
    }),
  )(service.getCurrentSourceFile(normalizePath("src/index.ts"))!);
  expect(symbols.map((s) => s.name)).toEqual([
    "localObj",
    "vvv",
    "exportedObj",
    "foo",
    // "Class", "vvv", "foo", "arg", "local", "consturctor"
  ]);
});

test("visitScoped: exports", () => {
  const { service, normalizePath } = createTestLanguageService();

  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
export const exported = 1;
const local = 1;
{
  const block = 2;
}
function f(arg: number) {
  const func = 3;
}
class X {
  method() {
    const methodBlock = 4;
  }
}
  `,
  );
  const program = service.getProgram()!;

  const symbols = new Set<ts.Symbol>();
  const checker = program.getTypeChecker();
  composeVisitors(
    createVisitScoped(checker, (symbol) => {
      symbols.add(symbol);
    }),
  )(service.getCurrentSourceFile(normalizePath("src/index.ts"))!);

  expect([...symbols].map((s) => s.name)).toEqual([
    "exported",
    "local",
    "block",
    "f",
    "arg",
    "func",
    "X",
    "method",
    "methodBlock",
  ]);
});

test("visitScoped: object member", () => {
  const { service, normalizePath } = createTestLanguageService();

  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
type Local = {
  xxx: number,
};
q;const obj: Local = {
  xxx: 1,
}
  `,
  );
  const program = service.getProgram()!;

  const symbols = new Set<ts.Symbol>();
  const checker = program.getTypeChecker();
  composeVisitors(
    createVisitScoped(checker, (symbol) => {
      symbols.add(symbol);
    }),
  )(service.getCurrentSourceFile(normalizePath("src/index.ts"))!);

  // expect([...symbols].map(s => s.name)).toEqual([
  //   'Local', 'xxx', 'obj'
  //   // 'exported', 'local', 'block', "f", 'arg', 'func',  'X', 'method', 'methodBlock'
  // ]);
});
