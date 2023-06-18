import ts from "typescript";
import { test, expect } from "vitest";
import { createRelatedTypesCollector, collectExportSymbols, collectGlobalTypes, collectGlobalVariables, collectScopedSymbols, collectImportableModules, createCollector } from "./analyzer";
import { createTestLanguageService } from "./testHarness";
import { createVisitScoped, composeVisitors, findFirstNode } from "./nodeUtils";

test("collectRelatedTypes: infer internal", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
    export function getInternal<T extends object>(v: number, t: T) {
      type Internal = { v: string, t: T };
      type UnusedInternal = { y: number };
      const internal: Internal = { v: "foo", t };
      return internal
    }
    `
  );
  const program = service.getProgram()!;
  const file = program.getSourceFile(normalizePath("src/index.ts"))!;
  const exportedSymbols = collectExportSymbols(program, file);
  const collector = createCollector(program.getTypeChecker());
  for (const symbol of exportedSymbols) {
    collector.visitSymbol(symbol);
  }
  expect(collector.isRelated(
    findFirstNode(program, file.fileName, /type Internal/)!,
  )).toBe(true);
  expect(collector.isRelated(
    findFirstNode(program, file.fileName, /type UnusedInternal/)!,
  )).toBe(false);
});

test("collectRelatedTypes: Partial", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
    type Exp = {
      public: {
        xxx: number;
      };
      priv: {
        yyy: string;
      }
    }
    export const exp: Exp["public"] = { xxx: 1 };

    type PubType = {
      pub: number;
    }
    export const pub: PubType = { pub: 1 };
    `
  );
  const program = service.getProgram()!;
  const file = program.getSourceFile(normalizePath("src/index.ts"))!;

  const exportedSymbols = collectExportSymbols(program, file);
  const collector = createCollector(program.getTypeChecker());
  for (const symbol of exportedSymbols) {
    collector.visitSymbol(symbol);
  }

  expect(
    collector.isRelatedNode(
      findFirstNode(program, file.fileName, /type PubType/)!,
    )
  ).toBe(true);

  expect(
    collector.isRelatedNode(
      findFirstNode(program, file.fileName, /type Exp/)!,
    )
  ).toBe(false);
  expect(
    collector.isRelatedNode(
      findFirstNode(program, file.fileName, /priv:/)!,
    )
  ).toBe(false);

  expect(
    collector.isRelatedNode(
      findFirstNode(program, file.fileName, /public:/)!,
    )
  ).toBe(true);

});


test("collectRelatedTypes: Union & Intersetion StringLiteral", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
    type A = {
      t: 'a';
      v: number;
    };
    type B = {
      t: 'b';
      v: string;
    }
    type C = {
      t: 'c';
    }
    type Exp = A | B;
    export const exp: Exp = null as any as Exp;
    `
  );
  const program = service.getProgram()!;
  const checker = program.getTypeChecker();

  const file = program.getSourceFile(normalizePath("src/index.ts"))!;
  const exportedSymbols = collectExportSymbols(program, file);
  const collector = createCollector(checker);
  for (const symbol of exportedSymbols) {
    collector.visitSymbol(symbol);
  }
  // const variableStatement = file.statements.find((node) => ts.isVariableStatement(node))! as ts.VariableStatement;
  {
    // const collector = createRelatedTypesCollector(program);
    // const identifiers = variableStatement.declarationList.declarations.map(d => d.name);
    // for (const identifier of identifiers) {
    //   const symbol = checker.getSymbolAtLocation(identifier)!;
    //   collector.collectRelatedTypesFromSymbol(symbol);
    // }
    // const relatedTypes = collector.getRelatedTypes();
    // const nameSet = new Set([...relatedTypes.values()].map(x => checker.typeToString(x)));
    expect(collector.isRelatedNode(
      findFirstNode(program, file.fileName, /type Exp/)!,
    )).toBe(true);
    expect(collector.isRelatedNode(
      findFirstNode(program, file.fileName, /type A/)!,
    )).toBe(true);
    expect(collector.isRelatedNode(
      findFirstNode(program, file.fileName, /type B/)!,
    )).toBe(true);
    expect(collector.isRelatedNode(
      findFirstNode(program, file.fileName, /type C/)!,
    )).toBe(false);
    // expect(nameSet.has('"a"')).toBeTruthy();
    // expect(nameSet.has('"b"')).toBeTruthy();
  }
});

test("collectExportSymbols", () => {
  const { service, normalizePath } = createTestLanguageService();
  service.writeSnapshotContent(
    normalizePath("src/sub.ts"),
    `
    export const sub1 = 1;
    export const sub2 = 2;
    export const sub3 = 3;
    `
  );

  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
    export { sub1 } from "./sub";
    export const a = 1;
    const b = 2;
    const c: 3 = 3;
    export {
      b
    }

    export type Foo = {
      b: number;
    }
    `
  );
  const program = service.getProgram()!;
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const exportSymbols = collectExportSymbols(program, source);


  expect(exportSymbols.map(x => x.getName())).toEqual([
    "sub1", "a", "b", "Foo"
  ]);

  // const collector = createRelatedTypesCollector(program);
  const collector = createCollector(checker);
  for (const symbol of exportSymbols) {
    // collector.collectRelatedTypesFromSymbol(symbol);
    collector.visitSymbol(symbol);
  }

  const relatedTypes = collector.getRelatedTypes();
  const nameSet = new Set([...relatedTypes.values()].map(x => checker.typeToString(x)));
  expect(nameSet.has("Foo")).toBeTruthy();
  expect(nameSet.has("1")).toBeTruthy();
  expect(nameSet.has("2")).toBeTruthy();
  // expect(nameSet.has("3")).toBeFalsy();
});

test("visitScoped: exports", () => {
  const { service, normalizePath } =
    createTestLanguageService();

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
  `);
  const program = service.getProgram()!;

  const symbols = new Set<ts.Symbol>();
  const checker = program.getTypeChecker();
  composeVisitors(
    createVisitScoped(checker, (symbol) => {
      symbols.add(symbol);
    })
  )(service.getCurrentSourceFile(normalizePath("src/index.ts"))!);

  expect([...symbols].map(s => s.name)).toEqual([
    'exported', 'local', 'block', "f", 'arg', 'func',  'X', 'method', 'methodBlock'
  ]);
});

test("visitScoped: object member", () => {
  const { service, normalizePath } =
    createTestLanguageService();

  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
type Local = {
  xxx: number,
};
q;const obj: Local = {
  xxx: 1,
}
  `);
  const program = service.getProgram()!;

  const symbols = new Set<ts.Symbol>();
  const checker = program.getTypeChecker();
  composeVisitors(
    createVisitScoped(checker, (symbol) => {
      symbols.add(symbol);
    })
  )(service.getCurrentSourceFile(normalizePath("src/index.ts"))!);

  // expect([...symbols].map(s => s.name)).toEqual([
  //   'Local', 'xxx', 'obj'
  //   // 'exported', 'local', 'block', "f", 'arg', 'func',  'X', 'method', 'methodBlock'
  // ]);
});


test.skip("collectExportSymbols with externals", () => {
  const { service, normalizePath } =
    createTestLanguageService();

  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
    import {parseArgs} from "node:util";

    // const localObj = {
    //   xxx: number;
    //   yyy: number;
    // };

    export function parse(args: string[]) {
      return parseArgs({
        args,
        allowPositionals: true,
        options: {
          name: {
            type: "string",
            alias: "n",
          }
        }
      });
    }
`
  );
  const externals = [
    '"node:util"'
  ];
  const source = service.getCurrentSourceFile(normalizePath("src/index.ts"))!;
  const symbols = collectScopedSymbols(service.getProgram()!, source, externals);
  // TODO: trace external import related symbols
  expect(symbols.map(s => s.symbol.name)).toEqual(["parse", "args", "allowPositionals", "options", "name", "type", "alias"]);
});

test("collectGlobalVariables", () => {
  const { service, normalizePath } =
    createTestLanguageService();

  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `export const exported = 1;`,
  );
  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const vars = collectGlobalVariables(program, source);
  expect(vars.map(s => s.name).includes("exported")).toBeFalsy();
  expect(vars.map(s => s.name).includes("Object")).toBeTruthy();
  expect(vars.map(s => s.name).includes("Generator")).toBeFalsy();
});

test("collectGlobalTypes", () => {
  const { service, normalizePath } =
    createTestLanguageService();

  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
import { Foo } from "./types";
export type Bar = number;
  `,
  );
  service.writeSnapshotContent(
    normalizePath("src/env.d.ts"),
    `
declare type MyGlobal = { v: number };
  `,
  );

  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const types = collectGlobalTypes(program, source);
  const names = types.map(s => s.name);

  expect(names.includes("Foo")).toBeFalsy();
  expect(names.includes("Bar")).toBeFalsy();
  expect(names.includes("Generator")).toBeTruthy();
  expect(names.includes("Omit")).toBeTruthy();
  expect(names.includes("Pick")).toBeTruthy();
  expect(names.includes("MyGlobal")).toBeTruthy();
});

test("collectImportableModules", () => {
  const { service, normalizePath } =
    createTestLanguageService();

  service.writeSnapshotContent(
    normalizePath("src/index.ts"),
    `
import { Foo } from "./types";
export type Bar = number;
  `,
  );
  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const modules = collectImportableModules(program, source);
  const names = modules.map(s => s.name);
  // console.log(names);
  expect(names.includes('"foo"')).toBeTruthy();
  expect(names.includes('"bar"')).toBeTruthy();
  expect(names.includes('"node:util"')).toBeTruthy();
});

