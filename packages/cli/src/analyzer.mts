import ts from "typescript";

export type AnalyzeResult = {
  reserved: string[];
  privates: string[];
};

export type AnalyzeMode = "module-source" | "isolated-ambient" | "module-ambient" | "isolated-ambient";

export type CollectPropertiesOptions = {
  ambient?: boolean;
  mode?: AnalyzeMode;
  // isolated?: boolean;
};

type AnyDeclaration =
  | ts.VariableStatement
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.ClassDeclaration
  | ts.FunctionDeclaration
  | ts.EnumDeclaration
  | ts.ModuleDeclaration;

function isNameableDeclaration(node: ts.Node): node is AnyDeclaration {
  return (
    ts.isVariableStatement(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isModuleDeclaration(node)
  );
}

function isDeclarationNameReserved(node: ts.Node, ambientMode: boolean): node is AnyDeclaration {
  const underModule = node.parent && ts.isModuleBlock(node.parent);

  if (isNameableDeclaration(node)) {
    if (ambientMode) {
      return !!node.modifiers?.some((m) => {
        return m.kind === ts.SyntaxKind.DeclareKeyword;
      });
    }
    return underModule;
  }
  return false;
}

export function getLocalAmbientModules(
  program: ts.Program,
  rootDir: string,
): Array<{ module: ts.SourceFile; isolated: boolean }> {
  const checker = program.getTypeChecker();
  const ambientModules = checker.getAmbientModules();
  const sources = program.getSourceFiles();

  // check from ambient modules
  const results: { module: ts.SourceFile; isolated: boolean }[] = [];
  for (const ambient of ambientModules) {
    const source = ambient.valueDeclaration?.getSourceFile();
    if (source?.fileName.startsWith(rootDir) && !source?.fileName.includes("/node_modules/")) {
      const isIsolatedAmbient = isIsolatedAmbientModule(source!);
      results.push({ module: source, isolated: isIsolatedAmbient });
    }
  }

  // check from sources
  for (const source of sources) {
    if (
      source.fileName.startsWith(rootDir) &&
      source.fileName.endsWith(".d.ts") &&
      !source.fileName.includes("/node_modules/")
    ) {
      const isIsolatedAmbient = isIsolatedAmbientModule(source);
      const found = results.find((r) => r.module === source);
      if (!found) results.push({ module: source, isolated: isIsolatedAmbient });
    }
  }

  return results;
}

function isHiddenMemberOfClass(node: ts.MethodDeclaration | ts.PropertyDeclaration) {
  const hasPrivateKeyword = node.modifiers?.some((m) => {
    return m.kind === ts.SyntaxKind.PrivateKeyword;
  });
  return hasPrivateKeyword || ts.isPrivateIdentifier(node.name!);
}

const toPropName = (node: ts.Node) => {
  if (ts.isIdentifier(node)) {
    return node.text;
  }
  if (ts.isStringLiteral(node)) {
    return node.text;
  }
  if (ts.isNumericLiteral(node)) {
    return node.text;
  }
};

export function isIsolatedAmbientModule(source: ts.SourceFile): boolean {
  const hasExport = source.statements.some((node) => {
    return ts.isExportDeclaration(node);
  });
  if (hasExport) return false;
  const hasImport = source.statements.some((node) => {
    return ts.isImportDeclaration(node);
  });
  if (hasImport) return false;

  const hasExportedDeclaration = source.statements.some((node) => {
    return (
      isNameableDeclaration(node) &&
      node.modifiers?.some((mod) => {
        return mod.kind === ts.SyntaxKind.ExportKeyword;
      })
    );
  });
  if (hasExportedDeclaration) return false;
  if (isNameableDeclaration(source)) {
    return false;
  }
  return true;
}

export function collectProperties(
  root: ts.Node,
  { ambient: ambientMode = false, mode = "module-source" }: CollectPropertiesOptions = {},
  debug: boolean = false,
): AnalyzeResult {
  const debugLog = (...args: any) => {
    if (debug) {
      console.log(...args);
    }
  };
  const reservedProps: Set<string> = new Set();
  const privateProps: Set<string> = new Set();

  const _traverse = (node: ts.Node, depth: number = 0) => {
    const prefix = " ".repeat(depth * 2);
    const prefix1 = " ".repeat((depth + 1) * 2);
    const underModule = node.parent && ts.isModuleBlock(node.parent);

    debugLog(prefix, "[", ts.SyntaxKind[node.kind], "]", !!underModule);

    // Reserve declaration node name first
    if (isDeclarationNameReserved(node, ambientMode)) {
      // variableStatement or others
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            debugLog(prefix1, "-module-variable | -declare in dts:", decl.name.getText());
            const prop = toPropName(decl.name);
            if (prop) reservedProps.add(prop);
          }
        }
      } else if (node.name) {
        debugLog(prefix1, "-module:", node.name.getText());
        const prop = toPropName(node.name);
        if (prop) reservedProps.add(prop);
      }
    }

    if (ts.isEnumDeclaration(node)) {
      // members
      let currentEnumValue: number | string = 0;
      const isConstEnum = !!node.modifiers?.some((m) => {
        return m.kind === ts.SyntaxKind.ConstKeyword;
      }); // TODO

      for (const member of node.members) {
        if (ts.isIdentifier(member.name)) {
          debugLog(prefix1, "-enum-member:", member.name.getText());
          const prop = toPropName(member.name);
          if (prop) reservedProps.add(prop);
        }
        if (isConstEnum) continue;
        // string literal initializer
        if (member.initializer) {
          if (ts.isStringLiteral(member.initializer)) {
            debugLog(prefix1, "-enum-initializer(string):", member.initializer.getText());
            const prop = toPropName(member.initializer);
            if (prop) reservedProps.add(prop);
          }
          if (ts.isNumericLiteral(member.initializer)) {
            // number literal initializer
            debugLog(prefix1, "-enum-initializer(number):", member.initializer.getText());
            const prop = toPropName(member.initializer);
            if (prop) reservedProps.add(prop);

            // reset enum value
            currentEnumValue = Number(member.initializer.text) + 1;
          }
        } else {
          // no initializer: auto increment
          if (typeof currentEnumValue === "number") {
            reservedProps.add(String(currentEnumValue));
            currentEnumValue++;
          }
        }
      }
    }

    if (ts.isInterfaceDeclaration(node)) {
      for (const member of node.members) {
        if (ts.isMethodSignature(member)) {
          debugLog(prefix1, "-method:", member.name?.getText());
          const prop = toPropName(member.name);
          if (prop) reservedProps.add(prop);
        }
        if (ts.isPropertySignature(member)) {
          debugLog(prefix1, "-property:", member.name?.getText(), "xxx", ts.SyntaxKind[member.name?.kind]);
          const prop = toPropName(member.name);
          if (prop) {
            reservedProps.add(prop);
          }
        }
      }
    }

    if (ts.isClassDeclaration(node)) {
      // keep name
      debugLog(prefix1, "-class:", node.getText());
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member)) {
          debugLog(prefix1, "-method:", member.name?.getText());
          const prop = toPropName(member.name);
          if (isHiddenMemberOfClass(member)) {
            if (prop) privateProps.add(prop);
          } else {
            if (prop) reservedProps.add(prop);
          }
        }

        if (ts.isPropertyDeclaration(member)) {
          const hidden = isHiddenMemberOfClass(member);
          debugLog(prefix, "-property:", member.name?.getText(), hidden);
          const prop = toPropName(member.name);
          if (hidden) {
            if (prop) privateProps.add(prop);
          } else {
            if (prop) reservedProps.add(prop);
          }
        }
      }
    }

    if (ts.isTypeLiteralNode(node)) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member)) {
          debugLog(prefix1, "-typeLiteralProperty:", member.name?.getText(), ts.SyntaxKind[member.name?.kind]);
          const prop = toPropName(member.name);
          if (prop) reservedProps.add(prop);
        }
      }
    }

    // terser will mangle exported names
    // if (ts.isExportDeclaration(node)) {
    //   if (ts.isNamedExports(node.exportClause!)) {
    //     for (const element of node.exportClause.elements) {
    //       debugLog("exports", element.name?.getText());
    //       reserved_keys.add(element.name?.getText());
    //     }
    //   }
    // }
    ts.forEachChild(node, (node) => {
      if (ambientMode && mode === "isolated-ambient" && ts.isModuleDeclaration(root)) {
        // skip isolated inner module analyze
        // Example:
        //   declare const globalvar: number;
        //   declare module "foo" {...} // <- skip
      } else {
        _traverse(node, depth + 1);
      }
    });
  };
  _traverse(root);
  return {
    reserved: Array.from(reservedProps),
    privates: Array.from(privateProps),
  };
}

if (import.meta.vitest) {
  const { test, expect } = import.meta.vitest;
  test("type literal", () => {
    const source = `
      export type X = {
        a: number;
        b: string;
        "c": boolean;
        nested: {
          d: number;
        }
      };
    `;
    const sourceFile = ts.createSourceFile("test.ts", source, ts.ScriptTarget.ESNext, true);
    const ret = collectProperties(sourceFile);
    expect(ret.reserved).toEqual(["a", "b", "c", "nested", "d"]);
  });

  test("interface", () => {
    const source = `
      export interface X {
        a: number;
        b: string;
        "c": boolean;
        nested: {
          d: number;
        }
      };
    `;
    const sourceFile = ts.createSourceFile("test.ts", source, ts.ScriptTarget.ESNext, true);
    const ret = collectProperties(sourceFile);
    expect(ret.reserved).toEqual(["a", "b", "c", "nested", "d"]);
  });

  test("class", () => {
    const source = `
      declare class X {
        a: number;
        "b": boolean;
        f(): void;
        "g"(): void;
        private pf(): void;
        private z;
      };
    `;
    const sourceFile = ts.createSourceFile("test.ts", source, ts.ScriptTarget.ESNext, true);
    const ret = collectProperties(sourceFile);
    expect(ret.reserved).toEqual(["a", "b", "f", "g"]);
    expect(ret.privates).toEqual(["pf", "z"]);
  });

  test("function", () => {
    const source = `
      declare function f(i: { x: number, y: number }): { a: number; b: string; "c": boolean; };
    `;
    const sourceFile = ts.createSourceFile("test.ts", source, ts.ScriptTarget.ESNext, true);
    const ret = collectProperties(sourceFile);
    expect(ret.reserved).toEqual(["x", "y", "a", "b", "c"]);
  });

  test("module", () => {
    const source = `
      export module A {
        declare const a: number;
        declare interface I {}
        declare class C {}
        declare module B {
          declare const v: number;
        }
        declare enum E {}
      };
    `;
    const sourceFile = ts.createSourceFile("test.ts", source, ts.ScriptTarget.ESNext, true);
    const ret = collectProperties(sourceFile);
    expect(ret.reserved).toEqual([
      // "A",
      "a",
      "I",
      "C",
      "B",
      "v",
      "E",
    ]);
  });

  test("enum", () => {
    const source = `
      export enum MyEnum {
        AAA,
        BBB,
        CCC = "StringValue",
        DDD = 100,
        EEE
      };
    `;
    const sourceFile = ts.createSourceFile("test.ts", source, ts.ScriptTarget.ESNext, true);
    const ret = collectProperties(sourceFile);
    expect(ret.reserved).toEqual(["AAA", "0", "BBB", "1", "CCC", "StringValue", "DDD", "100", "EEE", "101"]);
  });
  test("const enum", () => {
    const source = `
      export const enum MyEnum {
        AAA,
        BBB,
        CCC = "StringValue",
        DDD = 100,
        EEE
      };
    `;
    const sourceFile = ts.createSourceFile("test.ts", source, ts.ScriptTarget.ESNext, true);
    const ret = collectProperties(sourceFile);
    expect(ret.reserved).toEqual(["AAA", "BBB", "CCC", "DDD", "EEE"]);
  });

  test("ambient", () => {
    const source = `
      var Internal: number;
      declare var Foo: number;
      declare class Bar {};
      declare module Baz {};
      declare enum Qux {};
      declare function f(): void;
    `;
    const sourceFile = ts.createSourceFile("test.ts", source, ts.ScriptTarget.ESNext, true);
    const ret = collectProperties(sourceFile, { ambient: true });
    // console.log("Ambient crawling", ret);
    expect(ret.reserved).toEqual(["Foo", "Bar", "Baz", "Qux", "f"]);
  });
}
