import ts from "typescript";

export type AnalyzeResult = {
  reserved: string[];
  privates: string[];
};

export const collectProperties = (
  root: ts.Node,
  debug: boolean = false,
): AnalyzeResult => {
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
    const underModule = node.parent &&
      ts.isModuleBlock(node.parent);
    debugLog(prefix, "[", ts.SyntaxKind[node.kind], "]", !!underModule);

    if (ts.isModuleDeclaration(node)) {
      if (node.name) {
        debugLog(prefix1, "-module:", node.name.getText());
        const prop = toPropName(node.name);
        if (prop) reservedProps.add(prop);
      }
    }

    if (ts.isEnumDeclaration(node)) {
      if (underModule) {
        if (node.name) {
          debugLog(prefix1, "-enum:", node.name.getText());
          const prop = toPropName(node.name);
          if (prop) {
            reservedProps.add(prop);
          }
        }
      }
      for (const member of node.members) {
        if (ts.isIdentifier(member.name)) {
          debugLog(prefix1, "-enum-member:", member.name.getText());
          const prop = toPropName(member.name);
          if (prop) reservedProps.add(prop);
        }
        if (member.initializer && ts.isStringLiteral(member.initializer)) {
          debugLog(
            prefix1,
            "-enum-initializer:",
            member.initializer.getText(),
          );
          const prop = toPropName(member.initializer);
          if (prop) reservedProps.add(prop);
        }
      }
    }

    if (ts.isVariableStatement(node) && underModule) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          debugLog(prefix1, "-module-variable:", decl.name.getText());
          const prop = toPropName(decl.name);
          if (prop) reservedProps.add(prop);
        }
      }
    }

    if (ts.isTypeLiteralNode(node)) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member)) {
          debugLog(
            prefix1,
            "-typeLiteralProperty:",
            member.name?.getText(),
            ts.SyntaxKind[member.name?.kind],
          );
          const prop = toPropName(member.name);
          if (prop) reservedProps.add(prop);
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
          debugLog(
            prefix1,
            "-property:",
            member.name?.getText(),
            "xxx",
            ts.SyntaxKind[member.name?.kind],
          );
          const prop = toPropName(member.name);
          if (prop) {
            reservedProps.add(prop);
          }
        }
      }
      if (underModule) {
        if (node.name) {
          debugLog(prefix1, "-interface:", node.name.getText());
          const prop = toPropName(node.name);
          if (prop) {
            reservedProps.add(prop);
          }
        }
      }
    }
    if (ts.isTypeAliasDeclaration(node)) {
      if (underModule) {
        if (node.name) {
          debugLog(prefix1, "-typeAlias:", node.name.getText());
          const prop = toPropName(node.name);
          if (prop) reservedProps.add(prop);
        }
      }
    }

    if (ts.isClassDeclaration(node)) {
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
          debugLog(
            prefix,
            "-property:",
            member.name?.getText(),
            hidden,
          );
          const prop = toPropName(member.name);
          if (hidden) {
            if (prop) privateProps.add(prop);
          } else {
            if (prop) reservedProps.add(prop);
          }
        }
      }
      if (underModule) {
        if (node.name) {
          debugLog(prefix1, "-class:", node.name.getText());
          const prop = toPropName(node.name);
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
      _traverse(node, depth + 1);
    });
  };
  _traverse(root);
  return {
    reserved: Array.from(reservedProps),
    privates: Array.from(privateProps),
  };
};

function isHiddenMemberOfClass(
  node: ts.MethodDeclaration | ts.PropertyDeclaration,
) {
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
};

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
    const sourceFile = ts.createSourceFile(
      "test.ts",
      source,
      ts.ScriptTarget.ESNext,
      true,
    );
    const ret = collectProperties(sourceFile);
    expect(ret.reserved).toEqual([
      "a",
      "b",
      "c",
      "nested",
      "d",
    ]);
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
    const sourceFile = ts.createSourceFile(
      "test.ts",
      source,
      ts.ScriptTarget.ESNext,
      true,
    );
    const ret = collectProperties(sourceFile);
    expect(ret.reserved).toEqual([
      "a",
      "b",
      "c",
      "nested",
      "d",
    ]);
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
    const sourceFile = ts.createSourceFile(
      "test.ts",
      source,
      ts.ScriptTarget.ESNext,
      true,
    );
    const ret = collectProperties(sourceFile, false);
    expect(ret.reserved).toEqual([
      "a",
      "b",
      "f",
      "g",
    ]);
    expect(ret.privates).toEqual([
      "pf",
      "z",
    ]);
  });

  test("function", () => {
    const source = `
      declare function f(i: { x: number, y: number }): { a: number; b: string; "c": boolean; };
    `;
    const sourceFile = ts.createSourceFile(
      "test.ts",
      source,
      ts.ScriptTarget.ESNext,
      true,
    );
    const ret = collectProperties(sourceFile, false);
    expect(ret.reserved).toEqual([
      "x",
      "y",
      "a",
      "b",
      "c",
    ]);
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
    const sourceFile = ts.createSourceFile(
      "test.ts",
      source,
      ts.ScriptTarget.ESNext,
      true,
    );
    const ret = collectProperties(sourceFile, false);
    expect(ret.reserved).toEqual([
      "A",
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
      };
    `;
    const sourceFile = ts.createSourceFile(
      "test.ts",
      source,
      ts.ScriptTarget.ESNext,
      true,
    );
    const ret = collectProperties(sourceFile);
    expect(ret.reserved).toEqual([
      "AAA",
      "BBB",
      "CCC",
      "StringValue",
    ]);
  });
}
