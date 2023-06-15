import {test, expect} from "vitest";
import {analyzeTopLevelExports, createRelatedTypesCollector, getFunctionSignature} from "./analyzer";
import { createTestLanguageService } from "./testHarness";
import { FunctionDeclaration, Type, Node, Symbol, isFunctionDeclaration, TypeChecker, Program, Signature, isExpression, isVariableStatement, VariableStatement, isTypeAliasDeclaration, TypeAliasDeclaration, visitEachChild, forEachChild } from "typescript";

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
    const relatedTypes = collector.collectRelatedTypes(func);
    expect(relatedTypes.size).toBe(2);
    expect([...relatedTypes.values()].map(x => checker.typeToString(x))).toEqual([
      "T",
      "Internal",
    ]);
  }

  const variableStatement = file.statements.find((node) => isVariableStatement(node))! as VariableStatement;
  {
    const collector = createRelatedTypesCollector(program);
    const relatedTypes = collector.collectRelatedTypes(variableStatement);
    expect([...relatedTypes.values()].map(x => checker.typeToString(x))).toEqual([
      "{ xxx: number; }",
    ]);
    const expDecl = file.statements.find((node) => isTypeAliasDeclaration(node))! as TypeAliasDeclaration;
    const expType = checker.getTypeAtLocation(expDecl);
    expect(relatedTypes.has(expType)).toBe(false);

    const pubSymbol = expType.getProperty("public")!;
    const pubType = checker.getTypeOfSymbolAtLocation(pubSymbol, expDecl);
    expect(relatedTypes.has(pubType)).toBe(true);
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
    const relatedTypes = collector.collectRelatedTypes(variableStatement);
    expect([...relatedTypes.values()].map(x => checker.typeToString(x))).toEqual([
      "Exp", "A", '"a"', "B", '"b"'
    ]);
  }
});
