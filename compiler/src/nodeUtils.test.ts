import ts from "typescript";
import { expect, test } from "vitest";
import { createTestLanguageService } from "./testHarness";
import { createVisitScoped, composeVisitors, createTypeVisitor, getNodeAtPosition, findFirstNode } from "./nodeUtils";
import { collectExportSymbols } from "./analyzer";

const code1 = `
// export const local: number = 1;
// export const str: string = "x";

export type Tree = {
  value: number;
  children: Tree[];
}

// type Arg ={
//   input: string
// }
// type Result = {
//   v: number;
// }
// export function fff(arg: Arg): Result {
//   return { v: number };
// }
`;
export type Tree = {
  value: number;
  children: Tree[];
}

test("createTypeVisitor", () => {
  const { service, normalizePath } = createTestLanguageService();
  const code = `

  type LocalType = {
    vvv: number;
  }

  type Tree = {
    value: number;
    children: Tree[];
  }
  
  export const tree: Tree = {
    value: 1,
    children: []
  };  
  `;
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    code
  );
  const program = service.getProgram()!;

  const exportedSymbols = collectExportSymbols(
    program,
    service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!,
  );
  const checker = program.getTypeChecker();

  const valueNode = findFirstNode(program, normalizePath("src/index.ts"), /Tree/);
  const valueSymbol = checker.getSymbolAtLocation(valueNode!)!;

  const xxxNode = findFirstNode(program, normalizePath("src/index.ts"), /xxx/)!;
  const xxxSymbol = checker.getSymbolAtLocation(xxxNode)!;

  const types: Set<ts.Type> = new Set();
  const symbols: Set<ts.Symbol> = new Set();

  for (const symbol of exportedSymbols) {
    const type = program.getTypeChecker().getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
    // console.log("------", symbol.name, checker.typeToString(type));
    const visitor = createTypeVisitor(checker);
    visitor(type,
      (type) => {
        types.add(type);
      },
      (symbol) => {
        symbols.add(symbol);
      }  
    );
  }
  const names = [...types].map(t => checker.typeToString(t));
  expect(names.includes("Tree")).toBe(true);
  expect(symbols.has(valueSymbol)).toBe(true);
  expect(symbols.has(xxxSymbol)).toBe(false);
});


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
`
  );
  const symbols: ts.Symbol[] = [];
  const visitScopedIdentifierSymbols = createVisitScoped(service.getProgram()!.getTypeChecker(), (symbol, parentBlock) => {
    symbols.push(symbol);
  });
  const visit = composeVisitors(
    visitScopedIdentifierSymbols,
  );
  visit(service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!);
  // console.log(symbols.map(s => s.name));
  expect(symbols.map(s => s.name)).toEqual([
    "exported", "local", "fff", "arg", "nested", "Class", "v",  "cstrInternal", "method", "internal"
  ]);
});

test("visitLocalIdentifierSymbols: type alias signatrue", () => {
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
    `
  );
  const symbols: ts.Symbol[] = [];
  const visitScopedIdentifierSymbols = createVisitScoped(service.getProgram()!.getTypeChecker(), (symbol, parentBlock) => {
    symbols.push(symbol);
  });

  const visit = composeVisitors(
    visitScopedIdentifierSymbols,
  );
  visit(service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!);

  expect(symbols.map(s => s.name)).toEqual([
    "vvv", "foo"
  ]);
});

test("visitLocalIdentifierSymbols: enum", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
enum Enum {
  aaaa = 1,
  bbbb = 2,
  cccc,
}
    `
  );
  const symbols: ts.Symbol[] = [];
  const visitScopedIdentifierSymbols = createVisitScoped(service.getProgram()!.getTypeChecker(), (symbol, parentBlock) => {
    symbols.push(symbol);
  });
  composeVisitors(
    visitScopedIdentifierSymbols,
  )(service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!);

  expect(symbols.map(s => s.name)).toEqual([
    "Enum", "aaaa", "bbbb", "cccc"
  ]);
});


test("visitLocalIdentifierSymbols: class", () => {
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
    `
  );
  const symbols: ts.Symbol[] = [];
  // const visitScopedIdentifierSymbols = 
  composeVisitors(
    createVisitScoped(service.getProgram()!.getTypeChecker(), (symbol, parentBlock) => {
      symbols.push(symbol);
    })
  )(service.getCurrentSourceFile(normalizePath("src/index.ts"))!);
  expect(symbols.map(s => s.name)).toEqual([
    "Class", "vvv", "foo", "arg", "local", "consturctor"
  ]);
});


test("visitLocalIdentifierSymbols: object member", () => {
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
    `
  );
  const symbols: ts.Symbol[] = [];
  composeVisitors(
    createVisitScoped(service.getProgram()!.getTypeChecker(), (symbol, parentBlock) => {
      symbols.push(symbol);
    })
  )(service.getCurrentSourceFile(normalizePath("src/index.ts"))!);
  expect(symbols.map(s => s.name)).toEqual([
    "localObj", "vvv", "exportedObj", "foo"
    // "Class", "vvv", "foo", "arg", "local", "consturctor"
  ]);
});

