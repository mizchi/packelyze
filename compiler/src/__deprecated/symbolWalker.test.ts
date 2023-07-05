import { test, expect, vi } from "vitest";
import ts from "typescript";
import { createOneshotTestProgram, createTestLanguageService } from "../__tests/testHarness";

function hasExplicitTypeDeclaration(type: ts.Type) {
  return type.symbol.valueDeclaration !== type.symbol.declarations?.[0];
}

type VisitableNode =
  | ts.TypeLiteralNode
  | ts.PropertySignature
  | ts.MethodSignature
  | ts.ParameterDeclaration
  | ts.TypeNode
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

function isVisitableNode(node: ts.Node): node is VisitableNode {
  return (
    ts.isTypeNode(node) ||
    ts.isTypeLiteralNode(node) ||
    ts.isPropertySignature(node) ||
    ts.isMethodSignature(node) ||
    ts.isParameter(node) ||
    ts.isGetAccessor(node) ||
    ts.isSetAccessor(node)
  );
}

function getTypeLiteralFromSymbol(symbol: ts.Symbol): ts.TypeLiteralNode {
  for (const decl of symbol.declarations ?? []) {
    if (ts.isTypeLiteralNode(decl)) {
      return decl;
    }
  }
  throw new Error("not found");
}
function getSymbolWalker(checker: ts.TypeChecker, globals: Set<ts.Symbol>, debug = false) {
  const visitedTypes = new Set<ts.Type>();
  const visitedSymbols = new Set<ts.Symbol>();
  const visitedNodes = new Set<VisitableNode>();

  for (const primitiveType of [
    checker.getNumberType(),
    checker.getStringType(),
    checker.getBooleanType(),
    checker.getVoidType(),
    checker.getUndefinedType(),
    checker.getNullType(),
  ]) {
    const members = primitiveType.getProperties();
    for (const member of members) {
      globals.add(member);
    }
    // visitType(primitiveType, 0);
  }

  const log = debug ? console.log : () => {};

  return {
    walkSymbol: (symbol: ts.Symbol) => {
      visitSymbol(symbol);
      return getVisited();
    },
    walkType: (type: ts.Type) => {
      visitType(type, 0);
      return getVisited();
    },
    walkNode: (node: VisitableNode) => {
      visitNode(node, 0);
      return getVisited();
    },
    getVisited: () => {
      return {
        visitedTypes,
        visitedSymbols,
        visitedNodes,
      };
    },
    // for debug
    getReadableVisited: () => {
      return {
        visitedTypes: new Set(
          Array.from(visitedTypes)
            .map((t) => {
              return checker.typeToString(t);
            })
            .map(format)
            .sort(),
        ),
        visitedSymbols: new Set(
          Array.from(visitedSymbols)
            .map((s) => {
              if (s.name === "__type") {
                return (
                  s.declarations
                    ?.map((d) => {
                      if (ts.isTypeLiteralNode(d)) {
                        return "(TypeLiteral)" + d.getText();
                      }
                      const kind = ts.SyntaxKind[d.kind];
                      return `(unknown:${kind})` + d.getText();
                    })
                    .join(" | ") ?? s.name
                );
              }
              return `(Symbol)${s.name}`;
            })
            .map(format)
            .sort(),
        ),
        visitedNodes: new Set(
          Array.from(visitedNodes)
            .map((n) => `(${ts.SyntaxKind[n.kind]})${n.getText()}`)
            .map(format)
            .sort(),
        ),
      };
      function format(s: string) {
        return (
          s
            // .replace(/[\;\{\:,]/g, (s) => `${s} `)
            // .replace(/\{/g, " { ")
            .replace(/\=\>/g, " => ")
            .replace(/[\n\s]+/g, " ")
            .replace(/;\s+$/g, "")
        );
      }
    },
  };
  function getVisited() {
    return {
      visitedTypes,
      visitedSymbols,
      visitedNodes,
    };
  }

  function visitSymbol(symbol: ts.Symbol) {
    if (visitedSymbols.has(symbol)) return;
    if (isGlobalSymbol(symbol)) return;
    visitedSymbols.add(symbol);
  }

  function visitType(type: ts.Type, depth: number) {
    log(
      "  ".repeat(depth) + "[Type]",
      // detail
      checker.typeToString(type),
      visitedTypes.has(type),
      isGlobalSymbolType(type),
      // {
      //   ...type,
      //   checker: undefined,
      // },
    );
    if (visitedTypes.has(type)) return;

    // Array item before global check

    if (isGlobalSymbolType(type)) {
      // const numberIndexedType = checker.getIndexTypeOfType(type, ts.IndexKind.Number);
      // if (numberIndexedType) {
      //   visitType(numberIndexedType, depth + 1);
      // }

      // const stringIndexedType = checker.getIndexTypeOfType(type, ts.IndexKind.String);
      // if (stringIndexedType) {
      //   visitType(stringIndexedType, depth + 1);
      // }

      // walk only type arguments
      // console.log(
      //   "  ".repeat(depth) + "[Skip] global symbol",
      //   checker.typeToString(type),
      //   checker
      //     .getTypeArguments(type as ts.TypeReference)
      //     .map((t) => checker.typeToString(t))
      //     .join(", "),
      // );
      // for (const arg of checker.getTypeArguments(type as ts.TypeReference)) {
      //   visitType(arg, depth + 1);
      // }
      // for (const arg of type.aliasTypeArguments ?? []) {
      //   visitType(arg, depth + 1);
      // }
      return;
    }
    visitedTypes.add(type);

    if (type.symbol) {
      visitSymbol(type.symbol);
    }

    // as alias
    if (type.aliasSymbol) {
      visitSymbol(type.aliasSymbol);
    }
    if (type.aliasTypeArguments) {
      for (const arg of type.aliasTypeArguments) {
        visitType(arg, depth + 1);
      }
    }

    if (type.isUnionOrIntersection()) {
      for (const ctype of type.types) {
        // if (isGlobalSymbol(ctype.symbol)) {
        // skip
        // } else {
        visitType(ctype, depth + 1);
        // }
      }
    }

    if (type.flags & ts.TypeFlags.Object) {
      for (const prop of type.getProperties()) {
        // assertIsSingleDeclaration(prop);
        for (const decl of prop.declarations ?? []) {
          if (isVisitableNode(decl)) {
            visitNode(decl, depth + 1);
          }
        }

        const type = checker.getTypeOfSymbol(prop);
        if (type) {
          visitType(type, depth + 1);
        }
      }
    }

    const sigatures = type.getCallSignatures();
    // as function
    for (const sig of sigatures) {
      /** parameters */
      for (const param of sig.getParameters()) {
        const paramType = checker.getTypeOfSymbol(param);
        visitType(paramType, depth + 1);
        for (const decl of param.declarations ?? []) {
          visitNode(decl, depth + 1);
        }
      }
      /** return types */
      visitType(sig.getReturnType(), depth + 1);
    }
  }
  function visitNode(node: ts.Node, depth: number) {
    log("  ".repeat(depth) + "[Node:" + ts.SyntaxKind[node.kind] + "]", node.getText().slice(0, 10) + "...");

    if (!isVisitableNode(node)) return;
    if (visitedNodes.has(node)) return;
    visitedNodes.add(node);

    if (ts.isTypeNode(node)) {
      const type = checker.getTypeFromTypeNode(node);
      visitType(type, depth + 1);
    }

    if (ts.isParameter(node)) {
      if (node.type) {
        visitNode(node.type, depth + 1);
      }
    }

    if (ts.isPropertySignature(node)) {
      if (node.type) {
        visitNode(node.type, depth + 1);
      }
    }
    if (ts.isMethodSignature(node)) {
      for (const param of node.parameters) {
        visitNode(param, depth + 1);
      }
    }
    if (ts.isGetAccessor(node)) {
      for (const param of node.parameters) {
        visitNode(param, depth + 1);
      }
    }
    if (ts.isSetAccessor(node)) {
      for (const param of node.parameters) {
        visitNode(param, depth + 1);
      }
    }
  }

  function isGlobalSymbol(symbol: ts.Symbol) {
    return globals.has(symbol);
  }
  function isGlobalSymbolType(type: ts.Type): boolean {
    // TODO: why?
    if (type.isUnionOrIntersection()) {
      return type.types.every((t) => isGlobalSymbolType(t));
    }
    return isGlobalSymbol(type.symbol);
  }
}

function getGlobalSymbols(checker: ts.TypeChecker, file: ts.SourceFile) {
  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  const s0 = exportedSymbols[0];
  const t0 = checker.getTypeOfSymbol(s0);

  const globalSymbolWalker = getSymbolWalker(checker, new Set());
  const globalSymbols = getGlobalsFromFile(checker, file);
  for (const g of globalSymbols) {
    globalSymbolWalker.walkSymbol(g);
  }
  return globalSymbolWalker.getVisited().visitedSymbols;
}

test("hasExplicitTypeDeclarartion", () => {
  const { program, file } = createOneshotTestProgram(`
  type X = {
    x: number;
  }
  export const x1: X = {
    x: 1,
  };
  export const x2 = { x: 1 } as X;
  export const y = {
    y: 1,
  };
  export const g = function *() { yield 1; }
  `);
  const checker = program.getTypeChecker();

  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  const s0 = exportedSymbols[0];
  const t0 = checker.getTypeOfSymbol(s0);
  expect(hasExplicitTypeDeclaration(t0)).toBeTruthy();

  const s1 = exportedSymbols[1];
  const t1 = checker.getTypeOfSymbol(s1);
  expect(hasExplicitTypeDeclaration(t1)).toBeTruthy();
  expect(t0 === t1).toBeTruthy();

  const s2 = exportedSymbols[2];
  const t2 = checker.getTypeOfSymbol(s2);
  expect(hasExplicitTypeDeclaration(t2)).toBeFalsy();

  const s3 = exportedSymbols[3];
  const t3 = checker.getTypeOfSymbol(s3);
  expect(hasExplicitTypeDeclaration(t3)).toBeFalsy();
});

function getGlobalsFromFile(checker: ts.TypeChecker, file: ts.SourceFile): Set<ts.Symbol> {
  const globals = new Set(
    checker
      .getSymbolsInScope(file, ts.SymbolFlags.Value | ts.SymbolFlags.Type)
      .filter((s) => s.declarations?.some((d) => d.getSourceFile() !== file)),
  );
  globals.add(checker.getNumberType().symbol);
  globals.add(checker.getStringType().symbol);
  globals.add(checker.getBooleanType().symbol);
  globals.add(checker.getVoidType().symbol);
  globals.add(checker.getUndefinedType().symbol);
  globals.add(checker.getNullType().symbol);

  // const
  const symbolWalker = getSymbolWalker(checker, new Set());
  for (const g of globals) {
    symbolWalker.walkSymbol(g);
  }

  return globals;
}

test("symbolWalker: reference", () => {
  const { program, file } = createOneshotTestProgram(`
  type Num = {
    num: number;
  };
  type T = {
    x: number;
    f(arg: Num): {
      ret: number;
    };
    get text(): string;
    set text(v: string);
  }
  export const x1: T = {
    x: 1,
    get text() {
      return "text";
    },
    set text(v) {
      console.log(v);
    },
    f: (arg: Num) => {
      return {
        ret: arg.num
      }
    },
  };
  `);
  const checker = program.getTypeChecker();
  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  const s0 = exportedSymbols[0];
  const t0 = checker.getTypeOfSymbol(s0);

  const globals = getGlobalsFromFile(checker, file);
  const symbolWalker = getSymbolWalker(checker, globals);

  symbolWalker.walkType(t0);
  const visited = symbolWalker.getReadableVisited();
  // console.log(visited);
  expect(visited.visitedTypes).toEqual(new Set(["(arg: Num) => { ret: number; }", "Num", "T", "{ ret: number; }"]));
  expect(visited.visitedNodes).toEqual(
    new Set([
      "(GetAccessor)get text(): string;",
      "(MethodSignature)f(arg: Num): { ret: number; };",
      "(NumberKeyword)number",
      "(Parameter)arg: Num",
      "(Parameter)v: string",
      "(PropertySignature)num: number;",
      "(PropertySignature)ret: number;",
      "(PropertySignature)x: number;",
      "(SetAccessor)set text(v: string);",
      "(StringKeyword)string",
      "(TypeReference)Num",
    ]),
  );
  expect(visited.visitedSymbols).toEqual(
    new Set([
      "(Symbol)Num",
      "(Symbol)T",
      "(Symbol)f",
      "(TypeLiteral){ num: number; }",
      "(TypeLiteral){ ret: number; }",
      "(TypeLiteral){ x: number; f(arg: Num): { ret: number; }; get text(): string; set text(v: string); }",
    ]),
  );
});

test("symbolWalker: preload primitive union", () => {
  const { program, file } = createOneshotTestProgram(`
  type A = {
    v: number;
  }
  type B = {
    v: string;
  }
  export const v: A | B = { v: 1 }
  `);
  const checker = program.getTypeChecker();
  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  const s0 = exportedSymbols[0];
  const t0 = checker.getTypeOfSymbol(s0);

  const globalSymbolWalker = getSymbolWalker(checker, new Set());
  const globalSymbols = getGlobalsFromFile(checker, file);
  for (const g of globalSymbols) {
    globalSymbolWalker.walkSymbol(g);
  }
  const symbolWalker = getSymbolWalker(checker, globalSymbolWalker.getVisited().visitedSymbols);
  symbolWalker.walkType(t0);
  const visited = symbolWalker.getReadableVisited();
  // console.log(visited);
  expect(visited.visitedTypes).toEqual(new Set(["A", "A | B", "B"]));
  expect(visited.visitedSymbols).toEqual(
    new Set(["(Symbol)A", "(Symbol)B", "(TypeLiteral){ v: number; }", "(TypeLiteral){ v: string; }"]),
  );
  expect(visited.visitedNodes).toEqual(
    new Set([
      "(NumberKeyword)number",
      "(PropertySignature)v: number;",
      "(PropertySignature)v: string;",
      "(StringKeyword)string",
    ]),
  );
});

test("symbolWalker: preload primitive union", () => {
  const { program, file } = createOneshotTestProgram(`
  export const v: number | { v: number } = { v: 1 }
  `);
  const checker = program.getTypeChecker();
  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  const s0 = exportedSymbols[0];
  const t0 = checker.getTypeOfSymbol(s0);

  const globalSymbolWalker = getSymbolWalker(checker, new Set());
  const globalSymbols = getGlobalsFromFile(checker, file);
  for (const g of globalSymbols) {
    globalSymbolWalker.walkSymbol(g);
  }
  const symbolWalker = getSymbolWalker(checker, globalSymbolWalker.getVisited().visitedSymbols);
  symbolWalker.walkType(t0);
  const visited = symbolWalker.getReadableVisited();
  // console.log(visited);
  expect(visited.visitedTypes).toEqual(new Set(["number | { v: number; }", "{ v: number; }"]));
  expect(visited.visitedNodes).toEqual(new Set(["(NumberKeyword)number", "(PropertySignature)v: number"]));
  expect(visited.visitedSymbols).toEqual(new Set(["(TypeLiteral){ v: number }"]));
});

test("symbolWalker: recursive tree", () => {
  const { program, file } = createOneshotTestProgram(`
  type ItemA = {
    value: number;
  }
  type ItemB = {
    value: string;
  }
  type Tree<Item> = {
    item: Item;
    children: Tree<Item>[];
  }
  export const tree: Tree<ItemA | ItemB> = {
    item: {
      value: 1,
    },
    children: [
      {
        item: {
          value: 2
        },
        children: [],
      }
    ]
  };  
  `);
  const checker = program.getTypeChecker();
  const exportedSymbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);
  const s0 = exportedSymbols[0];
  const t0 = checker.getTypeOfSymbol(s0);

  const globalSymbolWalker = getSymbolWalker(checker, new Set());
  const globalSymbols = getGlobalsFromFile(checker, file);
  for (const g of globalSymbols) {
    globalSymbolWalker.walkSymbol(g);
  }

  const symbolWalker = getSymbolWalker(checker, globalSymbolWalker.getVisited().visitedSymbols);
  symbolWalker.walkType(t0);
  const visited = symbolWalker.getReadableVisited();
  // console.log(visited);
  expect(visited.visitedTypes).toEqual(new Set(["Item", "ItemA", "ItemA | ItemB", "ItemB", "Tree<ItemA | ItemB>"]));
  expect(visited.visitedSymbols).toEqual(
    new Set([
      "(Symbol)Item",
      "(Symbol)ItemA",
      "(Symbol)ItemB",
      "(Symbol)Tree",
      "(TypeLiteral){ item: Item; children: Tree<Item>[]; }",
      "(TypeLiteral){ value: number; }",
      "(TypeLiteral){ value: string; }",
    ]),
  );

  expect(visited.visitedNodes).toEqual(
    new Set([
      "(ArrayType)Tree<Item>[]",
      "(NumberKeyword)number",
      "(PropertySignature)children: Tree<Item>[];",
      "(PropertySignature)item: Item;",
      "(PropertySignature)value: number;",
      "(PropertySignature)value: string;",
      "(StringKeyword)string",
      "(TypeReference)Item",
    ]),
  );
});

test.skip("symbolWalker: global generics items", () => {
  const { file, checker } = createOneshotTestProgram(`
  type Item = {
    val: number;
  }
  export const items: Array<Item> = [{val: 1}];

  type Gen = { v: number };
  export const g: Generator<Gen> = function *() {
    yield { v: 1 };
  };  
  `);
  const symbols = checker.getExportsOfModule(checker.getSymbolAtLocation(file)!);

  const globalSymbols = getGlobalsFromFile(checker, file);
  const symbolWalker = getSymbolWalker(checker, globalSymbols);

  symbolWalker.walkType(checker.getTypeOfSymbol(symbols[0]));
  symbolWalker.walkType(checker.getTypeOfSymbol(symbols[1]));

  const visited = symbolWalker.getReadableVisited();
  // console.log(visited);
  expect(visited.visitedTypes).toEqual(
    new Set([
      // types
      "Gen",
      "Item",
    ]),
  );
  expect(visited.visitedSymbols).toEqual(
    new Set([
      // symbols
      "(Symbol)Gen",
      "(Symbol)Item",
      "(TypeLiteral){ v: number }",
      "(TypeLiteral){ val: number; }",
    ]),
  );
  expect(visited.visitedNodes).toEqual(
    new Set([
      // nodes
      "(NumberKeyword)number",
      "(PropertySignature)v: number",
      "(PropertySignature)val: number;",
    ]),
  );
});
