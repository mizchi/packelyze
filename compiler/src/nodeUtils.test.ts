import ts from "typescript";
import { expect, test } from "vitest";
import { createTestLanguageService } from "./testHarness";
import { visitScopedIdentifierSymbols, createTypeVisitor, getNodeAtPosition, findFirstNode } from "./nodeUtils";
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


test("visitLocalScoped", () => {
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
  visitScopedIdentifierSymbols(
    service.getProgram()!,
    service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!,
    (symbol, parentBlock, paths, depth) => {
      symbols.push(symbol);
    }
  );
  // console.log(symbols.map(s => s.name));
  expect(symbols.map(s => s.name)).toEqual([
    "exported", "local", "fff", "arg", "nested", "Class", "v",  "method", "cstrInternal", "internal"
  ]);
});

