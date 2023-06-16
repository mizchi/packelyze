import { test, expect } from "vitest";
import { createRelatedTypesCollector, findExportSymbols, findGlobalTypes, findGlobalVariables, findScopedSymbols, getImportableModules } from "./analyzer";
import { createTestLanguageService } from "./testHarness";
import { FunctionDeclaration, Type, Node, Symbol, isFunctionDeclaration, isVariableStatement, VariableStatement, isTypeAliasDeclaration, TypeAliasDeclaration, visitEachChild, forEachChild, SyntaxKind, SymbolFlags, LanguageService, SourceFile } from "typescript";
import { getRenamedFileState } from "./manipulator";
import { visitLocalBlockScopeSymbols } from "./nodeUtils";

test("collectRelatedTypes", () => {
  const { service, snapshotManager, normalizePath } = createTestLanguageService();
  const file =  snapshotManager.writeFileSnapshot(
    normalizePath("src/index.ts"),
    `
    export function getInternal<T extends object>(v: number, t: T) {
      type Internal = { v: string, t: T };
      const internal: Internal = { v: "foo", t };
      return internal
    }
    type Exp = {
      public: {
        xxx: number;
      };
      priv: {
        yyy: string;
      }
    }
    export const exp: Exp["public"] = { xxx: 1 };
    `
  );
  const program = service.getProgram()!;
  const checker = program.getTypeChecker();

  const func = file.statements.find((node) => isFunctionDeclaration(node))! as FunctionDeclaration;
  {
    const collector = createRelatedTypesCollector(program);
    const relatedTypes = collector.collectRelatedTypesFromNode(func);
    // expect(relatedTypes.size).toBe(2);

    const relatetTypesNameSet = new Set([...relatedTypes.values()].map(x => checker.typeToString(x)));
    expect(relatetTypesNameSet.has("T")).toBe(true);
    expect(relatetTypesNameSet.has("Internal")).toBe(true);
  }

  const variableStatement = file.statements.find((node) => isVariableStatement(node))! as VariableStatement;
  {
    const collector = createRelatedTypesCollector(program);
    const relatedTypes = collector.collectRelatedTypesFromNode(variableStatement);
    const relatedTypesNameSet = new Set([...relatedTypes.values()].map(x => checker.typeToString(x)));

    expect(relatedTypesNameSet.has("{ xxx: number; }")).toBeTruthy();
    const expDecl = file.statements.find((node) => isTypeAliasDeclaration(node))! as TypeAliasDeclaration;
    const expType = checker.getTypeAtLocation(expDecl);
    expect(relatedTypes.has(expType)).toBe(false);

    const pubSymbol = expType.getProperty("public")!;
    expect(collector.isRelatedTypeFromSymbol(pubSymbol)).toBe(true);

    const pubType = checker.getTypeOfSymbolAtLocation(pubSymbol, expDecl);
    expect(collector.isRelatedType(pubType)).toBe(true);
  }
});

test("collectRelatedTypes: Union & Intersetion StringLiteral", () => {
  const { service, snapshotManager, normalizePath } = createTestLanguageService();
  const file =  snapshotManager.writeFileSnapshot(
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
    type Exp = A | B;
    export const exp: Exp = null as any as Exp;
    `
  );
  const program = service.getProgram()!;
  const checker = program.getTypeChecker();

  const variableStatement = file.statements.find((node) => isVariableStatement(node))! as VariableStatement;
  {
    const collector = createRelatedTypesCollector(program);
    const relatedTypes = collector.collectRelatedTypesFromNode(variableStatement);
    const nameSet = new Set([...relatedTypes.values()].map(x => checker.typeToString(x)));
    expect(nameSet.has("Exp")).toBeTruthy();
    expect(nameSet.has("A")).toBeTruthy();
    expect(nameSet.has("B")).toBeTruthy();
    expect(nameSet.has('"a"')).toBeTruthy();
    expect(nameSet.has('"b"')).toBeTruthy();
  }
});

test("findExportSymbols", () => {
  const { service, snapshotManager, normalizePath } = createTestLanguageService();
  snapshotManager.writeFileSnapshot(
    normalizePath("src/sub.ts"),
    `
    export const sub1 = 1;
    export const sub2 = 2;
    export const sub3 = 3;
    `
  );

  const file =  snapshotManager.writeFileSnapshot(
    normalizePath("src/index.ts"),
    `
    export { sub1 } from "./sub";
    export const a = 1;
    const b = 2;
    const c = 3;
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
  const exportSymbols = findExportSymbols(program, source);

  expect(exportSymbols.map(x => x.getName())).toEqual([
    "sub1", "a", "b", "Foo"
  ]);

  const collector = createRelatedTypesCollector(program);
  for (const symbol of exportSymbols) {
    collector.collectRelatedTypesFromSymbol(symbol);
  }

  const relatedTypes = collector.getRelatedTypes();
  const nameSet = new Set([...relatedTypes.values()].map(x => checker.typeToString(x)));
  expect(nameSet.has("Foo")).toBeTruthy();
  expect(nameSet.has("1")).toBeTruthy();
  expect(nameSet.has("2")).toBeTruthy();
  expect(nameSet.has("3")).toBeFalsy();
});

test.skip("finder: find all locals", () => {
  const code = `
import { sub } from "./sub";

const internal = 1;
export const exported = 2;

function f1() {
  const value = 3;
  return { value };
}

// function f2() {
//   f1();
// }

export function g() {
  const g_internal = 4;
  console.log(g_internal);
  // document;
}

console.log(2);
`;


  const { service, normalizePath, snapshotManager } =
    createTestLanguageService();
  snapshotManager.writeFileSnapshot(normalizePath("src/locals.ts"), code);

  const program = service.getProgram()!;
  const checker = program.getTypeChecker();

  const rootFile = program.getSourceFile(normalizePath("src/locals.ts"));
  const getSymbolNames = (flags: SymbolFlags) =>
    checker.getSymbolsInScope(
      rootFile!,
      flags,
    ).map((s) => s.name);
  const getSymbols = (flags: SymbolFlags) =>
    checker.getSymbolsInScope(
      rootFile!,
      flags,
    );

  expect(getSymbolNames(SymbolFlags.BlockScoped)).toEqual([
    "internal",
    "exported",
  ]);

  const keys = Object.keys(SymbolFlags);
  for (const flags of keys) {
    const flag = SymbolFlags[flags as keyof typeof SymbolFlags];
    if (typeof flag !== "number") {
      continue;
    }
    const symbolNames = getSymbolNames(flag);
    console.log(SymbolFlags[flag], symbolNames.length);
    // expect(getSymbols(flag))
    if (flag === SymbolFlags.FunctionExcludes) {
      console.log("--- FunctionExcludes ---", symbolNames);
      const symbols = getSymbols(flag);
      for (const symbol of symbols) {
        const decledSource = symbol.valueDeclaration?.getSourceFile();
        if (decledSource && decledSource.fileName.includes("/node_modules/")) {
          // console.log('')
        } else if (decledSource == null) {
          // console.log(
          //   "  --- decledSource ---",
          //   symbol.getName(),
          //   decledSource,
          // );
        } else {
          console.log(
            "  --- local ---",
            symbol.getName(),
            decledSource?.fileName.replace(process.cwd() + "/", ""),
          );
        }
        // console.log(
        //   "  --- decledSource ---",
        //   symbol.getName(),
        //   decledSource?.fileName,
        // );
      }
      break;
    }
    if (flag === SymbolFlags.Variable) {
      if (true as any) break;
      console.log("--- Variable ---", symbolNames);
      const symbols = getSymbols(flag);
      for (const symbol of symbols) {
        const decledSource = symbol.valueDeclaration?.getSourceFile();
        if (decledSource && decledSource.fileName.includes("/node_modules/")) {
          // console.log('')
        } else if (decledSource == null) {
          // console.log(
          //   "  --- decledSource ---",
          //   symbol.getName(),
          //   decledSource,
          // );
        } else {
          console.log(
            "  --- local ---",
            symbol.getName(),
            decledSource?.fileName.replace(process.cwd() + "/", ""),
          );
        }
        // console.log(
        //   "  --- decledSource ---",
        //   symbol.getName(),
        //   decledSource?.fileName,
        // );
      }
      break;
      // break;
    }

    if (flag === SymbolFlags.ValueModule) {
      console.log("--- ValueModule ---", symbolNames);
      // break;
    }
  }
});

test("findRenameSymbols", () => {
  const { service, normalizePath, snapshotManager } =
    createTestLanguageService();

  snapshotManager.writeFileSnapshot(
    normalizePath("src/index.ts"),
    `
export const exported = 1;
const local = 1;
{
  const block = 2;
  {
    const nestedBlock = 3;
    class X {
      method() {
        const methodBlock = 4;
      }
    }
  }
}
  `,
  );
  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;

  // visitLocalBlockScopeSymbols(program, source, (symbol, parentBlock, paths, depth) => {
  //   const decl = symbol.valueDeclaration;
  //   console.log("  ".repeat(depth), `[block:local]`, symbol.name, "-", decl && SyntaxKind[decl.kind]);
  // }, 0);
});

test("visitLocalBlockScopeSymbols", () => {
  const { service, normalizePath, snapshotManager } =
    createTestLanguageService();

  snapshotManager.writeFileSnapshot(
    normalizePath("src/index.ts"),
    `
export const exported = 1;
const local = 1;
{
  const block = 2;
}
function f() {
  const func = 3;
}
class X {
  method() {
    const methodBlock = 4;
  }
}
  `);
  const program = service.getProgram()!;
  const sourceFile = program.getSourceFile(normalizePath("src/index.ts"))!;

  const symbols = new Set<Symbol>();
  visitLocalBlockScopeSymbols(program, sourceFile, (symbol) => {
    symbols.add(symbol);
  });

  expect(symbols.size).toBe(7);
  expect([...symbols].map(s => s.name)).toEqual([
    'exported', 'local', 'X', 'block', 'func', 'method', 'methodBlock'
  ]);
});

test("findExportSymbols", () => {
  const { service, normalizePath, snapshotManager } =
    createTestLanguageService();

  snapshotManager.writeFileSnapshot(
    normalizePath("src/index.ts"),
    `
export const exported = 1;
const local = 1;
`
  );
  // const symbols = findExportSymbols(service.getProgram()!, service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!);

  const symbols = findScopedSymbols(service.getProgram()!, service.getProgram()!.getSourceFile(normalizePath("src/index.ts"))!);
  expect(symbols.map(s => s.symbol.name)).toEqual(["exported", "local"]);
});

test("findGlobalVariables", () => {
  const { service, normalizePath, snapshotManager } =
    createTestLanguageService();

  snapshotManager.writeFileSnapshot(
    normalizePath("src/index.ts"),
    `export const exported = 1;`,
  );
  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const vars = findGlobalVariables(program, source);
  expect(vars.map(s => s.name).includes("exported")).toBeFalsy();
  expect(vars.map(s => s.name).includes("Object")).toBeTruthy();
  expect(vars.map(s => s.name).includes("Generator")).toBeFalsy();
});

test("findGlobalTypes", () => {
  const { service, normalizePath, snapshotManager } =
    createTestLanguageService();

  snapshotManager.writeFileSnapshot(
    normalizePath("src/index.ts"),
    `
import { Foo } from "./types";
export type Bar = number;
  `,
  );
  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const types = findGlobalTypes(program, source);
  const names = types.map(s => s.name);

  expect(names.includes("Foo")).toBeFalsy();
  expect(names.includes("Bar")).toBeFalsy();
  expect(names.includes("Generator")).toBeTruthy();
  expect(names.includes("Omit")).toBeTruthy();
  expect(names.includes("Pick")).toBeTruthy();
});

test("findImportableModules", () => {
  const { service, normalizePath, snapshotManager } =
    createTestLanguageService();

  snapshotManager.writeFileSnapshot(
    normalizePath("src/index.ts"),
    `
import { Foo } from "./types";
export type Bar = number;
  `,
  );
  const program = service.getProgram()!;
  const source = program.getSourceFile(normalizePath("src/index.ts"))!;
  const modules = getImportableModules(program, source);
  const names = modules.map(s => s.name);
  // console.log(names);
  expect(names.includes('"foo"')).toBeTruthy();
  expect(names.includes('"bar"')).toBeTruthy();
  expect(names.includes('"node:util"')).toBeTruthy();
});

// function getRenamedFileState(service: LanguageService, source: SourceFile, normalizePath: (path: string) => string) {
//   const program = service.getProgram()!;
//   const scopedSymbols = findScopedSymbols(program, source);

//   const renames: RenameInfo[] = [];

//   const symbolBuilder = createSymbolBuilder();
//   const checker = program.getTypeChecker();

//   const unsafeRenameTargets = collectUnsafeRenameTargets(scopedSymbols);
//   for (const symbol of scopedSymbols) {
//     expect(symbol.symbol.valueDeclaration).toBeTruthy();
//     const decl = symbol.symbol.valueDeclaration!;
//     const locs = findRenameLocations(service, decl.getSourceFile().fileName, decl.getStart());

//     const uname = symbolBuilder.create((newName) => !unsafeRenameTargets.has(newName));
//     renames.push({
//       original: symbol.symbol.getName(),
//       to: uname,
//       locations: locs!,
//     });
//   }

//   const state = getRenameAppliedState(renames, (fname) => {
//     const source = program.getSourceFile(fname);
//     return source && source.text;
//   }, normalizePath);
//   return state;

//   // collect unsafe rename targets
//   function collectUnsafeRenameTargets(scopedSymbols: ScopedSymbol[]) {
//     const unsafeRenameTargets = new Set<string>();
//     // register global names to unsafe
//     for (const gvar of findGlobalVariables(program, source)) {
//       unsafeRenameTargets.add(gvar.name);
//     }
//     // register existed local names to unsafe
//     for (const blockSymbol of scopedSymbols) {
//       const symbols = checker.getSymbolsInScope(blockSymbol.parentBlock, SymbolFlags.BlockScoped);
//       for (const symbol of symbols) {
//         unsafeRenameTargets.add(symbol.name);
//       }
//     }
//     return unsafeRenameTargets;  
//   }
// }

